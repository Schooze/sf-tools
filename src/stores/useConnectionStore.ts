import { create } from 'zustand';
import type { DeviceInfo,PortDetail } from '../types';
import { SFBridge } from '../lib/tauri-bridge';
import { useAppStore } from './useAppStore';
import { useConfigStore } from './useConfigStore';
import { useTelemetryStore } from './useTelemetryStore';
interface ConnectionStore {
 isConnected:boolean;isConnecting:boolean;selectedPort:string;baudrate:number;nodeId:number;
 availablePorts:PortDetail[];deviceInfo:DeviceInfo|null;busy:boolean;
 setSelectedPort:(port:string)=>void;setBaudrate:(baud:number)=>void;setNodeId:(node:number)=>Promise<void>;
 fetchPorts:()=>Promise<void>;connect:()=>Promise<boolean>;disconnect:()=>Promise<void>;connectionLost:(error:string)=>void;
}
const toast=(t:'success'|'error'|'warning'|'info',title:string,m?:string)=>useAppStore.getState().addToast(t,title,m);
export const useConnectionStore=create<ConnectionStore>((set,get)=>({
 isConnected:false,isConnecting:false,selectedPort:'SIMULATOR',baudrate:115200,nodeId:0,availablePorts:[],deviceInfo:null,busy:false,
 setSelectedPort:port=>{if(!get().isConnected)set({selectedPort:port});},
 setBaudrate:baud=>{if(!get().isConnected)set({baudrate:baud});},
 setNodeId:async node=>{
  if(!Number.isInteger(node)||node<0||node>255){toast('error','Node must be 0–255');return;}
  if(get().busy||get().isConnecting||useConfigStore.getState().isSaving||useConfigStore.getState().isLoading){toast('warning','Operation in progress');return;}
  if(!get().isConnected){set({nodeId:node});return;}
  if(node===get().nodeId)return;
  set({isConnecting:true});await useTelemetryStore.getState().stopStreaming();
  useTelemetryStore.getState().clearHistory();useConfigStore.getState().reset();
  try{
   const result=await SFBridge.selectNode(node);set({nodeId:node,deviceInfo:result.info,isConnecting:false});
   useConfigStore.getState().loadConfig(result.config);await useTelemetryStore.getState().startStreaming();
  }catch(e){get().connectionLost(String(e));}
 },
 fetchPorts:async()=>{try{set({availablePorts:await SFBridge.listPorts()});}catch(e){toast('error','Port scan failed',String(e));}},
 connect:async()=>{
  const {selectedPort,baudrate,nodeId}=get();set({isConnecting:true});
  try{
   const info=await SFBridge.connectDevice(selectedPort,baudrate,nodeId);
   useConfigStore.getState().loadConfig(await SFBridge.readConfig());
   set({isConnected:true,isConnecting:false,deviceInfo:info});useTelemetryStore.getState().clearHistory();
   await useTelemetryStore.getState().startStreaming();toast('success','Connected',selectedPort+' · node '+nodeId+' · firmware '+info.firmware_version);return true;
  }catch(e){try{await SFBridge.disconnectDevice();}catch{}get().connectionLost(String(e));return false;}
 },
 disconnect:async()=>{
  if(get().busy){toast('warning','Operation in progress','Use E-STOP to interrupt before disconnecting');return;}
  await useTelemetryStore.getState().stopStreaming();
  try{await SFBridge.disconnectDevice();}catch(e){toast('error','Disconnect error',String(e));}
  set({isConnected:false,deviceInfo:null,isConnecting:false});useConfigStore.getState().reset();useTelemetryStore.getState().clearHistory();
 },
 connectionLost:error=>{
  set({isConnected:false,isConnecting:false,deviceInfo:null,busy:false});
  void useTelemetryStore.getState().stopStreaming(false);useTelemetryStore.getState().clearHistory();useConfigStore.getState().reset();
  toast('error','Connection unavailable',error);
 },
}));
