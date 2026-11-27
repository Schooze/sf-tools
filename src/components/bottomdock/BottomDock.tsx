import React,{useState} from 'react';
import {AlertOctagon,Terminal,Send} from 'lucide-react';
import {useConnectionStore} from '../../stores/useConnectionStore';
import {useConfigStore} from '../../stores/useConfigStore';
import {useAppStore} from '../../stores/useAppStore';
import {SFBridge} from '../../lib/tauri-bridge';
import {MOTOR_MODES} from '../../lib/config-model';
import {runDeviceAction} from '../../stores/useDeviceStore';
import {button,input} from '../common/DeviceUI';
export const BottomDock:React.FC=()=>{
 const [command,setCommand]=useState('');const [stopping,setStopping]=useState(false);const c=useConnectionStore();const mode=useConfigStore(s=>s.deviceConfig.motor_mode);const app=useAppStore();
 const estop=async()=>{
  setStopping(true);
  try{await SFBridge.emergencyStop();app.addToast('warning','E-STOP acknowledged','Motor disable and PVT stop acknowledged by the active node.');void SFBridge.readConfig().then(cfg=>useConfigStore.getState().mergeFromDevice(cfg)).catch(()=>{});}
  catch(e){app.addToast('error','E-STOP not confirmed',String(e));}finally{setStopping(false);}
 };
 return <div className="p-3 border-t border-border bg-sidebar/80 flex-shrink-0 space-y-2">
 <div className="flex items-center justify-between text-[11px]"><span className="text-sf-muted">{c.isConnected?c.selectedPort+' · node '+c.nodeId+' · '+(MOTOR_MODES.find(m=>m.value===mode)?.label??'Unknown mode'):'Disconnected'}{c.deviceInfo?.is_simulator?' · SIMULATOR':''}{c.busy?' · Device operation in progress':''}</span>
 <button className={button+' border-red-500/40 text-red-400 bg-red-500/10'} disabled={!c.isConnected||stopping} onClick={()=>void estop()}><AlertOctagon size={12} className="inline mr-1"/>{stopping?'Disabling…':'E-STOP'}</button></div>
 <form className="flex gap-2 max-w-4xl mx-auto" onSubmit={e=>{e.preventDefault();const cmd=command.trim();if(!cmd)return;setCommand('');void runDeviceAction('Terminal',async()=>{const result=await SFBridge.executeTerminal(cmd);if(!/^(help|read|status|get_param|reboot)(\s|$)/.test(cmd)){try{useConfigStore.getState().mergeFromDevice(await SFBridge.readConfig());}catch{}}return result;}).then(result=>{if(result)app.addToast('info','Command result',result);});}}>
 <button type="button" className={button} title="Open terminal" onClick={()=>app.setCurrentView('terminal')}><Terminal size={14}/></button><input aria-label="Quick hardware command" value={command} onChange={e=>setCommand(e.target.value)} className={input} placeholder="read actual_rpm · set_speed 100 · help"/><button className={button} disabled={!c.isConnected||c.busy||!command.trim()}><Send size={14}/></button>
 </form></div>;
};
