import React, { useState } from 'react';
import { SFBridge } from '../../lib/tauri-bridge';
import { useConnectionStore } from '../../stores/useConnectionStore';
import { useConfigStore } from '../../stores/useConfigStore';
import { runDeviceAction, useDeviceStore } from '../../stores/useDeviceStore';
import { download } from '../../lib/config-model';
import { Page, Card, NumberField, primary, button } from '../../components/common/DeviceUI';
export const CommissioningView: React.FC = () => {
  const { isConnected, busy } = useConnectionStore();
  const [bandwidth, setBandwidth] = useState(500);
  const [running, setRunning] = useState('');
  const [completed, setCompleted] = useState<string[]>([]);
  const [lut, setLut] = useState<number[]>([]);
  const steps = [
    ['calc_pole_pairs', 'Estimate pole pairs and phase direction'],
    ['measure_rs', 'Measure resistance Rs'],
    ['measure_ld', 'Measure inductance Ld'],
    ['measure_lq', 'Measure inductance Lq'],
    ['calibrate_encoder', 'Calibrate absolute encoder'],
    ['auto_bandwidth', 'Compute and write current PI gains'],
    ['measure_cogging', 'Measure cogging torque LUT'],
  ];
  const run = async (action: string) => {
    setRunning(action);
    const result = await runDeviceAction(
      'Commissioning',
      () => SFBridge.runCommissioningAction(action, bandwidth),
      'Completed and configuration read back',
    );
    if (result) {
      useConfigStore.getState().mergeFromDevice(result.config);
      setCompleted((s) => [...s, action]);
      if (result.cogging_lut.length) setLut(result.cogging_lut);
    }
    setRunning('');
  };
  const enabled = useDeviceStore((s) => s.diagnostics?.motor_enabled_acknowledged ?? false);
  const disabled =
    !isConnected || busy || !Number.isFinite(bandwidth) || bandwidth <= 0 || bandwidth > 2000;
  return (
    <Page
      title="Self Commissioning"
      description="One operation at a time. Each measurement waits for self_commissioning_done before reading results."
      actions={
        <button
          className={primary}
          disabled={disabled || !enabled}
          onClick={() => void run('full')}
        >
          {running === 'full' ? 'Waiting for device…' : 'Run full sensored commissioning'}
        </button>
      }
    >
      <Card title="Preparation">
        <p className="text-amber-300 leading-relaxed">
          These operations energize and may rotate the motor. Prepare the mechanical setup and power
          supply before starting. Full commissioning runs pole-pair estimation, Rs, Ld, Lq, encoder
          calibration, then PI tuning. Cogging measurement is a separate operation.
        </p>
        <div className="flex items-center gap-3">
          <button
            className={primary}
            disabled={!isConnected || busy}
            onClick={() =>
              void runDeviceAction(
                'Enable for commissioning',
                async () => {
                  await SFBridge.setMotorEnabled(true, 6);
                  useConfigStore.getState().mergeFromDevice(await SFBridge.readConfig());
                },
                'Motor output enabled in zero-voltage mode',
              )
            }
          >
            Enable output for commissioning
          </button>
          <span className="text-sf-muted">
            {enabled ? 'Enable was acknowledged' : 'Enable output before starting measurements'}
          </span>
        </div>
        <NumberField
          label="Current-loop bandwidth"
          unit="Hz"
          value={bandwidth}
          onChange={setBandwidth}
          disabled={busy}
        />
        <p className="text-sf-subtle">
          E-STOP disables motor output and interrupts SF-Tools waiting. Firmware has no
          commissioning-abort register; an interrupted routine may remain active internally.
        </p>
      </Card>
      <Card title="Individual operations">
        <div className="space-y-3">
          {steps.map(([action, label]) => (
            <div
              key={action}
              className="flex items-center justify-between p-3 rounded-lg bg-background border border-border gap-3"
            >
              <span className="text-white">{label}</span>
              <div className="flex gap-3 items-center">
                {completed.includes(action) && <span className="text-emerald-400">Completed</span>}
                <button
                  className={button}
                  disabled={disabled || (!enabled && action !== 'auto_bandwidth')}
                  onClick={() => void run(action)}
                >
                  {running === action ? 'Waiting for device event…' : 'Run'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      {lut.length > 0 && (
        <Card title={'Cogging LUT · ' + lut.length + '/1024 samples'}>
          <p className="text-sf-muted">
            Finite capture from register 92. Normal streaming is restored after acquisition.
          </p>
          <button
            className={button}
            onClick={() =>
              download(
                'sf-cogging.csv',
                ['index,current_A', ...lut.map((v, i) => i + ',' + v)].join('\n'),
                'text/csv',
              )
            }
          >
            Export LUT CSV
          </button>
          <svg
            viewBox="0 0 1024 120"
            className="w-full h-32 bg-background rounded-lg"
            role="img"
            aria-label="Cogging current LUT"
          >
            <polyline
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              points={lut.map((v, i) => i + ',' + (60 - v * 400)).join(' ')}
            />
          </svg>
        </Card>
      )}
      <Card title="Persistence">
        <p className="text-sf-muted">
          Completed measurements update device values. Use Motor Configuration → Save to flash to
          persist them. Encoder settings require restart where indicated.
        </p>
      </Card>
    </Page>
  );
};
