export type MotorConfig = Record<string, number>;
export interface PortDetail { name:string; description:string; is_virtual:boolean }
export interface DeviceInfo {
 name:string; hardware_version:string|null; firmware_version:string; device_id:string;
 node_id:number; is_simulator:boolean; capabilities:string[]; firmware_commit:string;
}
export interface TelemetrySample { timestamp_ms:number; node_id:number; values:Record<string,number>; updated_ms:Record<string,number> }
export interface PlotterSignalInfo { id:string; name:string; unit:string; color:string; code:number }
export interface DeviceEvent { sequence:number; timestamp_ms:number; node_id:number; code:number; name:string }
export interface Packet { timestamp_ms:number; direction:string; hex:string }
export interface Diagnostics {
 motor_enabled_acknowledged:boolean; connected:boolean; error:string|null; packets_rx:number; packets_tx:number; malformed:number; timeouts:number;
 busy:boolean; events:DeviceEvent[]; packets:Packet[];
}
export interface ApplyResult { applied:MotorConfig; failed:Record<string,string> }
export interface ConnectionResult { info:DeviceInfo; config:MotorConfig }
export interface CommissionResult { config:MotorConfig; cogging_lut:number[] }
export interface PvtPoint { position_deg:number; velocity_deg_s:number }
export interface PvtResult { uploaded:number; requested:number; error:string|null }
export type AppView='overview'|'configuration'|'motion'|'telemetry'|'commissioning'|'diagnostics'|'firmware'|'terminal'|'settings';
export interface ToastMessage { id:string; type:'info'|'success'|'warning'|'error'; title:string; message?:string; timestamp:number }
