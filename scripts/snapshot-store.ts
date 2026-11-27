import {createStore} from 'zustand/vanilla';
// Static render harness: selectors read the current snapshot; no browser subscriptions run.
export function create<T>(initializer:any){const api=createStore<T>(initializer);const bound=(selector:any=(v:any)=>v)=>selector(api.getState());return Object.assign(bound,api);}
