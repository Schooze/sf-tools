import React from 'react';
import { useConnectionStore } from '../../stores/useConnectionStore';
import { SFBridge } from '../../lib/tauri-bridge';
import { FIRMWARE_COMMIT } from '../../lib/config-model';
import { Page, Card, button } from '../../components/common/DeviceUI';
import { runDeviceAction } from '../../stores/useDeviceStore';
export const FirmwareView: React.FC = () => {
  const c = useConnectionStore();
  return (
    <Page
      title="Firmware Manager"
      description="Version discovery and the official ST-Link update workflow."
      actions={
        <button
          className={button}
          disabled={!c.isConnected || c.busy}
          onClick={() =>
            void runDeviceAction('Read version', async () => {
              const info = await SFBridge.getDeviceInfo();
              useConnectionStore.setState({ deviceInfo: info });
            })
          }
        >
          Read version
        </button>
      }
    >
      <Card title="Connected controller">
        <dl className="grid md:grid-cols-3 gap-5">
          <div>
            <dt className="text-sf-muted">Firmware</dt>
            <dd className="text-lg font-mono text-white mt-1">
              {c.deviceInfo?.firmware_version ?? 'Not connected'}
            </dd>
          </div>
          <div>
            <dt className="text-sf-muted">Active node</dt>
            <dd className="text-lg font-mono text-white mt-1">{c.deviceInfo?.node_id ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sf-muted">Hardware revision</dt>
            <dd className="text-white mt-1">
              {c.deviceInfo?.hardware_version ?? 'Not exposed by firmware'}
            </dd>
          </div>
        </dl>
      </Card>
      <Card title="Supported firmware source">
        <p className="text-sf-muted">SF-Motion 0.3.0 · 21 November 2026</p>
        <a
          className="text-blue-400 underline break-all"
          href={'https://github.com/sirojudinMunir/sf-motion/commit/' + FIRMWARE_COMMIT}
          target="_blank"
          rel="noreferrer"
        >
          {FIRMWARE_COMMIT}
        </a>
      </Card>
      <Card title="Update through ST-Link">
        <p className="text-amber-300 leading-relaxed">
          This firmware has no USB flashing or bootloader command. SF-Tools cannot verify or flash a
          binary through its motor-control protocol.
        </p>
        <ol className="list-decimal pl-5 space-y-3 text-sf-text">
          <li>Disable the motor and disconnect SF-Tools.</li>
          <li>Connect ST-Link to the STM32F405 board following the board wiring instructions.</li>
          <li>
            Open the firmware project in PlatformIO and build it using <code>pio run</code>.
          </li>
          <li>
            Upload using <code>pio run -t upload</code>, then restart the controller.
          </li>
          <li>Reconnect SF-Tools and read its actual firmware version.</li>
        </ol>
        <a
          className="text-blue-400 underline"
          href="https://github.com/sirojudinMunir/sf-motion#upload-firmware"
          target="_blank"
          rel="noreferrer"
        >
          Open SF-Motion update documentation
        </a>
      </Card>
    </Page>
  );
};
