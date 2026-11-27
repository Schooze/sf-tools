import {useConfigStore} from '../../stores/useConfigStore';
import React,{useState,useEffect} from 'react';
import {SFBridge} from '../../lib/tauri-bridge';
import {useConnectionStore} from '../../stores/useConnectionStore';
import {useDeviceStore} from '../../stores/useDeviceStore';
import {Page,Card,primary,button,input} from '../../components/common/DeviceUI';
export const TerminalView:React.FC=()=>{
 const [command,setCommand]=useState('help');const [logs,setLogs]=useState<string[]>([]);const [packets,setPackets]=useState(false);
 useEffect(()=>{const clear=()=>setLogs([]);window.addEventListener('sf-tools-clear-terminal',clear);return()=>window.removeEventListener('sf-tools-clear-terminal',clear);},[]);
 const {isConnected,busy}=useConnectionStore();const d=useDeviceStore(s=>s.diagnostics);
 const run=async()=>{const cmd=command.trim();if(!cmd)return;setLogs(l=>[...l,'> '+cmd]);setCommand('');
  useConnectionStore.setState({busy:true});
  try{const result=await SFBridge.executeTerminal(cmd);setLogs(l=>[...l,result]);if(!/^(help|read|status|get_param|reboot)(\s|$)/.test(cmd)){try{useConfigStore.getState().mergeFromDevice(await SFBridge.readConfig());}catch{}}}
  catch(e){setLogs(l=>[...l,'Error: '+String(e)]);}
  finally{useConnectionStore.setState({busy:false});void useDeviceStore.getState().refresh();}
 };
 return <Page title="Terminal & Packet Inspector" description="Commands use the real register transport. Packet bytes below are captured by the transport worker." actions={<div className="flex gap-2"><button className={button} onClick={()=>setPackets(!packets)}>{packets?'Hide packets':'Show packets'}</button><button className={button} onClick={()=>setLogs([])}>Clear output</button></div>}>
 <Card title="Terminal"><pre className="min-h-48 max-h-96 overflow-auto whitespace-pre-wrap select-text text-xs font-mono text-sf-text">{logs.join('\n\n')||'Type help for supported commands.'}</pre><form className="flex gap-2" onSubmit={e=>{e.preventDefault();void run();}}><input aria-label="Terminal command" className={input} value={command} onChange={e=>setCommand(e.target.value)} placeholder="read actual_rpm"/><button className={primary} disabled={busy||(!isConnected&&command.trim()!=='help')}>Run</button></form></Card>
 {packets&&<Card title="Actual TX / RX frames"><pre className="max-h-96 overflow-auto text-[11px] font-mono text-blue-300 select-text whitespace-pre-wrap">{d?.packets.map((p,i)=>new Date(p.timestamp_ms).toLocaleTimeString()+'.'+String(p.timestamp_ms%1000).padStart(3,'0')+' '+p.direction+' '+p.hex).join('\n')||'No packets captured.'}</pre></Card>}
 </Page>;
};
