import React from 'react';
import {useDeviceStore} from '../../stores/useDeviceStore';
import {useConnectionStore} from '../../stores/useConnectionStore';
import {Page,Card} from '../../components/common/DeviceUI';
export const DiagnosticsView:React.FC=()=>{
 const d=useDeviceStore(s=>s.diagnostics);const {nodeId,isConnected}=useConnectionStore();const events=d?.events.filter(e=>e.node_id===nodeId)??[];
 return <Page title="Diagnostics & Events" description="Observed communication counters and firmware events. Event history is not a query of active fault registers.">
 <div className="grid md:grid-cols-4 gap-4">{[['Packets RX',d?.packets_rx],['Packets TX',d?.packets_tx],['Malformed / discarded bytes',d?.malformed],['Response timeouts',d?.timeouts]].map(([k,v])=><Card key={String(k)} title={String(k)}><span className="text-2xl font-mono text-white">{v??0}</span></Card>)}</div>
 <Card title="Transport"><p className={isConnected?'text-emerald-400':'text-sf-muted'}>{isConnected?'Connected':'Disconnected'} · {d?.busy?'Device operation in progress':'Idle'}</p>{d?.error&&<p className="text-red-400">{d.error}</p>}<p className="text-sf-subtle">The USB protocol has no CRC. Firmware exposes no temperature reading, active fault-register query, or clear-fault command. Protection events record what was received during this session.</p></Card>
 <Card title={'Node '+nodeId+' event history'}>{events.length?<div className="space-y-2">{[...events].reverse().map(e=><div key={e.sequence} className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-background border border-border"><span className="text-sf-muted font-mono">{new Date(e.timestamp_ms).toLocaleTimeString()}</span><span className={e.code>=2?'text-red-400':'text-blue-300'}>{e.name}</span><span className="text-sf-subtle">Code {e.code} · node {e.node_id}</span></div>)}</div>:<p className="text-sf-muted">No events received. This does not establish that the device has no faults.</p>}</Card>
 </Page>;
};
