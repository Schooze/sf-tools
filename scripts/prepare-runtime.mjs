import { readFile, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { root } from './paths.mjs';
const lock = await readFile(path.join(root, 'src-tauri/Cargo.lock'), 'utf8');
const version = lock.match(/name = "webview2-com-sys"\r?\nversion = "([^"]+)"/)?.[1];
if (!version) throw Error('webview2-com-sys version missing from Cargo.lock');
const registry = path.join(
  process.env.CARGO_HOME ?? path.join(os.homedir(), '.cargo'),
  'registry',
  'src',
);
let source;
for (const dir of await readdir(registry)) {
  const candidate = path.join(
    registry,
    dir,
    'webview2-com-sys-' + version,
    'x64',
    'WebView2Loader.dll',
  );
  try {
    await readFile(candidate);
    source = candidate;
    break;
  } catch {}
}
if (!source) throw Error('Run cargo fetch first to populate the matching WebView2 runtime loader');
await copyFile(source, path.join(root, 'src-tauri/WebView2Loader.dll'));
console.log('Prepared private embedded WebView2 loader from locked webview2-com-sys ' + version);
