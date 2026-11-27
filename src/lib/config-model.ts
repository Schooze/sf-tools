import catalog from '../../shared/registers.json';
import type { MotorConfig, ApplyResult, PvtPoint } from '../types';
export interface RegisterSpec {
 address:number; name:string; format:string|null; read:boolean; write:boolean; streaming:boolean;
 config:boolean; default?:number; unit:string; group:string; effect?:string; note?:string; editable?:boolean;
}
export const REGISTERS=catalog.registers as RegisterSpec[];
export const CONFIG_REGISTERS=REGISTERS.filter(r=>r.config);
export const MOTOR_MODES=catalog.motor_modes;
export const FOC_MODES=catalog.foc_modes;
export const FIRMWARE_COMMIT=catalog.firmware_commit;
export const DEFAULT_MOTOR_CONFIG:MotorConfig=Object.fromEntries(CONFIG_REGISTERS.map(r=>[r.name,r.default!]));
export function validateValue(r:RegisterSpec,value:number):string|null {
 if(!Number.isFinite(value)||!Number.isFinite(Math.fround(value)))return 'Enter a finite number';
 if(r.format==='<B'&&(!Number.isInteger(value)||value<0||value>255))return 'Enter an integer from 0 to 255';
 if(r.format==='<I'&&(!Number.isInteger(value)||value<0||value>4294967295))return 'Enter an unsigned 32-bit integer';
 if(r.address===13&&![0,1,2,3].includes(value))return 'Invalid FOC mode';
 if(r.address===14&&![0,1,2,3,4,6].includes(value))return 'Audio mode is unavailable';
 if([46,47,87,91,102,104].includes(r.address)&&![0,1].includes(value))return 'Use 0 or 1';
 if([15,16,21,22,23,86,88,89,97,98,99,100,101].includes(r.address)&&value<=0)return 'Must be positive';
 if([17,18,19,20,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,43,44,80,81,82].includes(r.address)&&value<0)return 'Must be non-negative';
 if(r.address===45&&value>0)return 'Must be non-positive';
 return null;
}
export function validateConfig(c:MotorConfig):Record<string,string>{
 const errors:Record<string,string>={};
 for(const [k,v]of Object.entries(c)){
  const r=CONFIG_REGISTERS.find(r=>r.name===k);
  if(!r)errors[k]='Unknown parameter';else {const e=validateValue(r,v);if(e)errors[k]=e;}
 }
 if(Math.fround(c.under_voltage)>=Math.fround(c.over_voltage))errors.under_voltage='Must be below over-voltage';
 if(Math.fround(c.i2t_i_rated)>Math.fround(c.i2t_i_max))errors.i2t_i_rated='Must not exceed I²t maximum';
 return errors;
}
export function dirtyKeys(local:MotorConfig,device:MotorConfig){
 return new Set(Object.keys(local).filter(k=>local[k]!==device[k]));
}
export function mergeApply(local:MotorConfig,device:MotorConfig,result:ApplyResult,submitted:MotorConfig=local){
 const nextDevice={...device,...result.applied};
 const nextLocal={...local};
 for(const [key,value]of Object.entries(result.applied))if(local[key]===submitted[key])nextLocal[key]=value;
 return {deviceConfig:nextDevice,localConfig:nextLocal,dirtyKeys:dirtyKeys(nextLocal,nextDevice)};
}
const legacy:Record<string,string>={
 max_current:'limit_current',max_voltage:'over_voltage',
 pid_id_kp:'id_kp',pid_id_ki:'id_ki',pid_id_deadband:'id_deadband',
 pid_iq_kp:'iq_kp',pid_iq_ki:'iq_ki',pid_iq_deadband:'iq_deadband',
 pid_speed_kp:'speed_kp',pid_speed_ki:'speed_ki',pid_speed_out_max:'speed_out_max',pid_speed_deadband:'speed_deadband',
 pid_pos_kp:'position_kp',pid_pos_ki:'position_ki',pid_pos_kd:'position_kd',pid_pos_out_max:'position_out_max',pid_pos_deadband:'position_deadband',pid_pos_d_fc:'position_d_filter_fc',
 field_weakening_enable:'fw_enable',
};
export function importProfile(text:string,base:MotorConfig){
 const p=JSON.parse(text);
 if(!p||![1,2].includes(p.format)||!p.parameters||typeof p.parameters!=='object'||Array.isArray(p.parameters))throw Error('Invalid .sfconfig profile');
 const parameters={...base};const warnings:string[]=[];
 for(const [old,value]of Object.entries(p.parameters)){
  const key=p.format===1?(legacy[old]??old):old;
  const r=CONFIG_REGISTERS.find(r=>r.name===key);
  if(!r||r.editable===false){warnings.push('Skipped '+old);continue;}
  if(typeof value!=='number')throw Error('Invalid value for '+old);
  let v=value;
  if(p.format===1&&key==='motor_mode'){
   const map:Record<number,number>={0:1,1:2,2:3,4:5,5:6,6:0};
   if(map[v]===undefined||map[v]===5){warnings.push('Skipped unsupported legacy motor mode');continue;}v=map[v];
  }
  const error=validateValue(r,v);if(error)throw Error(key+': '+error);
  parameters[key]=v;
 }
 const errors=validateConfig(parameters);if(Object.keys(errors).length)throw Error(Object.entries(errors).map(([k,v])=>k+': '+v).join('; '));
 return {parameters,warnings};
}
export function parsePvt(text:string):PvtPoint[]{
 const lines=text.trim().split(/\r?\n/);
 if(lines[0]?.trim()==='position_deg,velocity_deg_s')lines.shift();
 if(!lines.length||lines.length>256)throw Error('Use 1–256 points');
 return lines.map((line,i)=>{
  const fields=line.split(',');if(fields.length!==2||fields.some(x=>!x.trim()))throw Error('Invalid CSV row '+(i+1));
  const [p,v]=fields.map(Number);
  if(!Number.isFinite(p)||!Number.isFinite(Math.fround(p))||!Number.isInteger(v)||v< -32768||v>32767)throw Error('Row '+(i+1)+': finite position and int16 velocity required');
  return {position_deg:p,velocity_deg_s:v};
 });
}
export function freshValue(sample:{values:Record<string,number>;updated_ms:Record<string,number>}|null,key:string,now=Date.now()){
 if(!sample||now-(sample.updated_ms[key]??0)>1000)return undefined;
 return sample.values[key];
}
export function download(name:string,text:string,type='text/plain'){
 const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
