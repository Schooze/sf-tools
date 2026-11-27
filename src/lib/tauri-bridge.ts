import { invoke } from '@tauri-apps/api/core';
import type {
  DeviceInfo,
  MotorConfig,
  PortDetail,
  TelemetrySample,
  Diagnostics,
  ApplyResult,
  ConnectionResult,
  CommissionResult,
  PvtPoint,
  PvtResult,
} from '../types';
export { DEFAULT_MOTOR_CONFIG } from './config-model';
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
async function call<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri)
    throw Error(
      'Device access requires the SF-Tools desktop app. The simulator is available in the desktop app.',
    );
  return invoke<T>(name, args);
}
export const SFBridge = {
  listPorts: () =>
    isTauri
      ? call<PortDetail[]>('list_ports')
      : Promise.resolve([
          { name: 'SIMULATOR', description: 'Simulator requires desktop app', is_virtual: true },
        ]),
  connectDevice: (port: string, baudrate = 115200, nodeId = 0) =>
    call<DeviceInfo>('connect_device', { port, baudrate, nodeId }),
  disconnectDevice: () => call<boolean>('disconnect_device'),
  selectNode: (nodeId: number) => call<ConnectionResult>('select_node', { nodeId }),
  getDeviceInfo: () => call<DeviceInfo>('get_device_info'),
  readConfig: () => call<MotorConfig>('read_config'),
  writeConfig: (config: MotorConfig) => call<ApplyResult>('write_config', { config }),
  saveConfig: () => call<MotorConfig>('save_config'),
  restoreDefaults: () => call<ConnectionResult>('restore_defaults'),
  readRegister: (address: number) => call<number[]>('read_register', { address }),
  writeRegister: (address: number, values: number[]) =>
    call<boolean>('write_register', { address, values }),
  setMotorMode: (mode: number) => call<boolean>('set_motor_mode', { mode }),
  setMotorEnabled: (enabled: boolean, mode = 0) =>
    call<boolean>('set_motor_enabled', { enabled, mode }),
  setSetpoint: (mode: number, value: number) => call<boolean>('set_setpoint', { mode, value }),
  setControlReferences: (mode: number, values: number[]) =>
    call<boolean>('set_control_references', { mode, values }),
  emergencyStop: () => call<boolean>('emergency_stop'),
  setTelemetryChannels: (addresses: number[]) =>
    call<boolean>('set_telemetry_channels', { addresses }),
  getTelemetrySample: () => call<TelemetrySample>('get_telemetry_sample'),
  getDiagnostics: () => call<Diagnostics>('get_diagnostics'),
  runCommissioningAction: (action: string, bandwidth = 500) =>
    call<CommissionResult>('run_commissioning_action', { action, bandwidth }),
  uploadPvt: (points: PvtPoint[]) => call<PvtResult>('upload_pvt', { points }),
  runPvt: (run: boolean) => call<boolean>('run_pvt', { run }),
  moveTrajectory: (target: number, velocity: number, acceleration: number, jerk: number) =>
    call<boolean>('move_trajectory', { target, velocity, acceleration, jerk }),
  executeTerminal: (command: string) => call<string>('execute_terminal', { command }),
};
