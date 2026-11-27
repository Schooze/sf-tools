import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['scripts/view-harness.tsx'],bundle:true,write:false,platform:'node',format:'esm',target:'node22',packages:'external',plugins:[{name:'snapshot-stores',setup(build){build.onResolve({filter:/^zustand$/},()=>({path:new URL('./snapshot-store.ts',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')}));}}]});
// Import beside node_modules so bundled application code resolves the installed React runtime.
const {writeFile,mkdir}=await import('node:fs/promises');
await mkdir('.cache',{recursive:true});await writeFile('.cache/view-harness.mjs',result.outputFiles[0].text);
const {renderView}=await import('../.cache/view-harness.mjs');
test('all connected views render using the latest device model',()=>{
 for(const [view,label]of [['overview','SF-Motion Simulator'],['configuration','Save to flash'],['motion','PVT point editor'],['telemetry','Telemetry Signals'],['commissioning','Estimate pole pairs'],['diagnostics','Protection events'],['firmware','Update through ST-Link'],['terminal','Terminal &amp; Packet Inspector'],['settings','0.2.0']]){
  const html=renderView(view);assert.ok(html.toLowerCase().includes(label.toLowerCase()),view+' missing '+label);
  assert.ok(!html.includes('1.4.2'),view+' has obsolete firmware identity');
 }
});
test('disconnected overview does not show invented motor readings',()=>{
 const html=renderView('overview',false);assert.ok(html.includes('Connect SIMULATOR'));assert.ok(!html.includes('48.0'));assert.ok(!html.includes('Optimal Range'));
});
