import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import App from '../src/app/App';
import {useAppStore} from '../src/stores/useAppStore';
import {useConfigStore} from '../src/stores/useConfigStore';
import {useConnectionStore} from '../src/stores/useConnectionStore';
import {DEFAULT_MOTOR_CONFIG} from '../src/lib/config-model';
import type {AppView} from '../src/types';
export function renderView(view:AppView,connected=true){
 useConfigStore.getState().loadConfig({...DEFAULT_MOTOR_CONFIG});
 useAppStore.setState({currentView:view});
 useConnectionStore.setState({isConnected:connected,deviceInfo:connected?{name:'SF-Motion Simulator',hardware_version:null,firmware_version:'0.3.0',device_id:'0',node_id:0,is_simulator:true,capabilities:[],firmware_commit:'2e58c94'}:null});
 return renderToStaticMarkup(<App/>);
}
