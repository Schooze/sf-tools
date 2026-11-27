import React from 'react';
import {useConnectionStore} from '../../stores/useConnectionStore';
import {useConfigStore} from '../../stores/useConfigStore';
import {useTelemetryStore} from '../../stores/useTelemetryStore';
import {useAppStore} from '../../stores/useAppStore';
import {Page,Card,primary,button} from '../../components/common/DeviceUI';
import {freshValue,MOTOR_MODES} from '../../lib/config-model';
import {SfLogo} from '../../components/common/SfLogo';
export const OverviewView:React.FC=()=>{
 const c=useConnectionStore();const sample=useTelemetryStore(s=>s.latestSample);const cfg=useConfigStore(s=>s.deviceConfig);const navigate=useAppStore(s=>s.setCurrentView);
 if(!c.isConnected)return <div className="h-full flex items-center justify-center text-center p-8"><div className="max-w-lg space-y-5"><div className="flex justify-center"><SfLogo size={64}/></div><h1 className="text-xl font-semibold text-white">SF-Motion Controller Studio</h1><p className="text-xs leading-relaxed text-sf-muted">Connect an SF-Motion 0.3.0 controller over USB, choose its node, or use the explicit local simulator.</p><button className={primary} disabled={c.isConnecting} onClick={()=>void c.connect()}>{c.isConnecting?'Connecting…':'Connect '+c.selectedPort+' · node '+c.nodeId}</button></div></div>;
 return <Page title={c.deviceInfo?.name??'SF-Motion'} description={c.selectedPort+' · node '+c.nodeId+' · firmware '+c.deviceInfo?.firmware_version+(c.deviceInfo?.is_simulator?' · SIMULATOR':'')} actions={<button className={primary} onClick={()=>navigate('motion')}>Motion Control</button>}>
 <div className="grid md:grid-cols-4 gap-4">{[['v_bus','Bus voltage','V'],['iq','Torque current','A'],['actual_rpm','Motor velocity','RPM'],['actual_angle','Mechanical position','deg']].map(([key,title,unit])=>{const value=freshValue(sample,key);return <Card key={key} title={title}><div className="text-2xl font-mono text-white">{value===undefined?'—':value.toFixed(2)} <span className="text-xs text-sf-muted">{unit}</span></div><p className="text-sf-subtle">{value===undefined?'No fresh sample; select this telemetry channel':'Received from active node'}</p></Card>;})}</div>
 <Card title="Controller"><div className="grid md:grid-cols-3 gap-3 text-sf-muted"><p>Mode: <span className="text-white">{MOTOR_MODES.find(m=>m.value===cfg.motor_mode)?.label??'Unavailable'}</span></p><p>Current limit: <span className="text-white">{cfg.limit_current??'—'} A</span></p><p>Hardware revision: <span className="text-white">{c.deviceInfo?.hardware_version??'Not exposed by firmware'}</span></p></div></Card>
 <Card title="Workflows"><div className="grid md:grid-cols-3 gap-3">{(['configuration','telemetry','commissioning']as const).map(v=><button key={v} className={button} onClick={()=>navigate(v)}>{v==='configuration'?'Motor Configuration':v==='telemetry'?'Realtime Telemetry':'Self Commissioning'}</button>)}</div><p className="text-sf-subtle">Measurements and faults come from the device. No temperature or hardware fault-register query is exposed by this firmware.</p></Card>
 </Page>;
};
