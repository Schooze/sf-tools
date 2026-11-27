import React, { useState, useRef } from 'react';
import { useConfigStore } from '../../stores/useConfigStore';
import { useConnectionStore } from '../../stores/useConnectionStore';
import { CONFIG_REGISTERS, MOTOR_MODES, FOC_MODES } from '../../lib/config-model';
import { Page, Card, NumberField, button, primary, input } from '../../components/common/DeviceUI';
export const ConfigView: React.FC = () => {
  const c = useConfigStore();
  const { isConnected, busy } = useConnectionStore();
  const [group, setGroup] = useState('Motor');
  const file = useRef<HTMLInputElement>(null);
  const groups = [...new Set(CONFIG_REGISTERS.map((r) => r.group))];
  const disabled = !isConnected || busy || c.isLoading || c.isSaving;
  return (
    <Page
      title="Motor Configuration"
      description="Apply and verify register values, then save to flash separately."
      actions={
        <div className="flex gap-2">
          <button className={button} onClick={() => file.current?.click()}>
            Import
          </button>
          <button className={button} onClick={c.exportProfile}>
            Export
          </button>
          <button
            className={button}
            disabled={disabled}
            onClick={() => void c.readFromDevice().catch(() => {})}
          >
            Read device
          </button>
        </div>
      }
    >
      <input
        type="file"
        accept=".sfconfig,.json"
        ref={file}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) c.importProfile(await f.text());
          e.target.value = '';
        }}
      />
      {!c.loaded && (
        <p className="text-amber-300">
          Connect and read a device before applying a profile. Displayed values are firmware
          defaults.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <button key={g} className={g === group ? primary : button} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>
      <Card title={group}>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {CONFIG_REGISTERS.filter((r) => r.group === group).map((r) => {
            const options =
              r.name === 'motor_mode' ? MOTOR_MODES : r.name === 'foc_mode' ? FOC_MODES : null;
            const flag = [46, 47, 87, 91].includes(r.address);
            return (
              <div key={r.name} className="space-y-1">
                {options || flag ? (
                  <label className="block space-y-1.5">
                    <span className="text-sf-muted">
                      {r.name.replaceAll('_', ' ')}{' '}
                      {c.dirtyKeys.has(r.name) && <span className="text-amber-300">●</span>}
                    </span>
                    <select
                      aria-label={r.name}
                      className={input}
                      value={c.localConfig[r.name] ?? 0}
                      disabled={busy || c.isSaving || c.isLoading || r.editable === false}
                      onChange={(e) => c.updateParameter(r.name, Number(e.target.value))}
                    >
                      {options ? (
                        options.map((o) => (
                          <option
                            key={o.value}
                            value={o.value}
                            disabled={'disabled' in o && o.disabled === true}
                          >
                            {o.value}: {o.label}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value={0}>0 · Off / Normal</option>
                          <option value={1}>1 · On / Inverted</option>
                        </>
                      )}
                    </select>
                  </label>
                ) : (
                  <NumberField
                    label={r.name.replaceAll('_', ' ') + (c.dirtyKeys.has(r.name) ? ' ●' : '')}
                    value={c.localConfig[r.name]}
                    onChange={(v) => c.updateParameter(r.name, v)}
                    disabled={busy || c.isSaving || c.isLoading || r.editable === false}
                    unit={r.unit}
                    error={c.errors[r.name]}
                  />
                )}
                {r.note && (
                  <p className="text-[11px] text-amber-300/80 leading-relaxed">{r.note}</p>
                )}
                {r.effect === 'stored' && (
                  <p className="text-[10px] text-sf-subtle">
                    Stored setting · not an immediate hardware change
                  </p>
                )}
                {c.errors[r.name] && (options || flag) && (
                  <p className="text-red-400">{c.errors[r.name]}</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-sidebar border border-border sticky bottom-0">
        <span className="text-sf-muted mr-auto">
          {c.dirtyKeys.size} changed · flash persistence is separate
        </span>
        <button className={button} disabled={disabled || !c.loaded} onClick={c.discardChanges}>
          Revert edits
        </button>
        <button
          className={button}
          disabled={disabled || !c.loaded}
          onClick={() => void c.restoreDefaults()}
        >
          Restore device defaults
        </button>
        <button
          className={primary}
          disabled={
            disabled ||
            !c.loaded ||
            !c.dirtyKeys.size ||
            Object.keys(c.errors).some((k) => !c.dirtyKeys.has(k))
          }
          onClick={() => void c.writeToDevice()}
        >
          {c.isSaving ? 'Working…' : 'Apply to device'}
        </button>
        <button
          className={button}
          disabled={disabled || !c.loaded || c.dirtyKeys.size > 0}
          onClick={() => void c.saveToFlash()}
        >
          Save to flash
        </button>
      </div>
    </Page>
  );
};
