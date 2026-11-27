import {openUrl} from '@tauri-apps/plugin-opener';
import {isTauri} from './tauri-bridge';
export function installExternalLinks(){
 const handler=(event:MouseEvent)=>{
  const anchor=(event.target as Element)?.closest?.('a');
  if(isTauri&&anchor?.href?.startsWith('https://')){
   event.preventDefault();void openUrl(anchor.href).catch(error=>console.error('Open link failed',error));
  }
 };
 document.addEventListener('click',handler);return()=>document.removeEventListener('click',handler);
}
