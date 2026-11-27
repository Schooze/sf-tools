import { copyFile, mkdir, readdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import './prepare-runtime.mjs';
import { staging, run, buildStandalone } from './standalone-windows.mjs';
import {
  root,
  windowsOutput,
  validationOutput,
  portableFilename,
  installerFilename,
} from './paths.mjs';

const cli = path.join(root, 'node_modules/@tauri-apps/cli/tauri.js');
const cargoExecutable = path.join(root, 'src-tauri/target/release/sf-tools.exe');
// Keep Cargo's output as the private engine between builds.
run(process.execPath, [cli, 'build', '--no-bundle', '--', '--offline', '--locked']);
const { executable, core, metadata } = await buildStandalone();
const release = windowsOutput;
await mkdir(release, { recursive: true });
await mkdir(validationOutput, { recursive: true });
await copyFile(executable, path.join(release, portableFilename));
try {
  // Installed and portable distributions use the same standalone entry point.
  await copyFile(executable, cargoExecutable);
  run(process.execPath, [cli, 'bundle', '--bundles', 'nsis', '--ci']);
} finally {
  // Never accidentally embed an older launcher as the next build's engine.
  await copyFile(core, cargoExecutable);
}
const installers = await readdir(path.join(root, 'src-tauri/target/release/bundle/nsis'));
const installer = installers.find(
  (file) => file.endsWith('.exe') && file.includes('_' + metadata.application_version + '_'),
);
if (!installer) throw Error('Version-matched NSIS installer missing');
await copyFile(
  path.join(root, 'src-tauri/target/release/bundle/nsis', installer),
  path.join(release, installerFilename),
);
await rm(path.join(release, 'WebView2Loader.dll'), { force: true });
await copyFile(path.join(staging, 'packaging.json'), path.join(validationOutput, 'packaging.json'));
const lines = [];
for (const name of [portableFilename, installerFilename])
  lines.push(
    createHash('sha256')
      .update(await readFile(path.join(release, name)))
      .digest('hex') +
      '  ' +
      name,
  );
await writeFile(path.join(release, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
run(process.execPath, [path.join(root, 'scripts/test-portable.mjs')]);
console.log(
  'Published and verified single-file portable EXE and matching NSIS installer in artifacts/windows/',
);
