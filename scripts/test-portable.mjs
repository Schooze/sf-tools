import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile, readdir, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { root, version, windowsOutput, validationOutput, portableFilename } from './paths.mjs';
const release = windowsOutput;
const metadata = JSON.parse(await readFile(path.join(validationOutput, 'packaging.json'), 'utf8'));
assert.equal(metadata.application_version, version);

// Check the PE import directory directly, without requiring dumpbin/objdump on CI.
function imports(buffer) {
  assert.equal(buffer.toString('ascii', 0, 2), 'MZ');
  const pe = buffer.readUInt32LE(0x3c);
  assert.equal(buffer.readUInt32LE(pe), 0x4550);
  const optional = pe + 24;
  const directory = optional + (buffer.readUInt16LE(optional) === 0x20b ? 112 : 96);
  const count = buffer.readUInt16LE(pe + 6);
  const sections = optional + buffer.readUInt16LE(pe + 20);
  const offset = (rva) => {
    for (let i = 0; i < count; i++) {
      const section = sections + i * 40;
      const start = buffer.readUInt32LE(section + 12);
      const size = Math.max(buffer.readUInt32LE(section + 8), buffer.readUInt32LE(section + 16));
      if (rva >= start && rva < start + size)
        return buffer.readUInt32LE(section + 20) + rva - start;
    }
    throw Error('Invalid PE address');
  };
  const importRva = buffer.readUInt32LE(directory + 8);
  if (!importRva) return [];
  let descriptor = offset(importRva);
  const names = [];
  while (buffer.readUInt32LE(descriptor + 12)) {
    const start = offset(buffer.readUInt32LE(descriptor + 12));
    const end = buffer.indexOf(0, start);
    names.push(buffer.toString('ascii', start, end));
    descriptor += 20;
  }
  return names;
}
const imported = imports(await readFile(path.join(release, portableFilename)));
assert.ok(
  !imported.some((name) => name.toLowerCase() === 'webview2loader.dll'),
  'Portable launcher must not import WebView2Loader.dll',
);
const fixture = path.join(root, 'src-tauri/target/portable-tests', randomUUID());
const runtime = path.join(fixture, 'private runtime cache');
const env = {
  ...process.env,
  SF_TOOLS_RUNTIME_DIR: runtime,
  PATH: [path.join(process.env.SystemRoot, 'System32'), process.env.SystemRoot].join(
    path.delimiter,
  ),
};
await mkdir(fixture, { recursive: true });
async function launch(folder, label) {
  const directory = path.join(fixture, folder);
  await mkdir(directory, { recursive: true });
  const exe = path.join(directory, 'sf-tools.exe');
  await copyFile(path.join(release, portableFilename), exe);
  assert.deepEqual(await readdir(directory), ['sf-tools.exe']);
  const report = path.join(fixture, label + ' report.json');
  const result = spawnSync(exe, ['--self-test', report], {
    cwd: directory,
    env,
    windowsHide: true,
    timeout: 30000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, label + ': ' + String(result.stderr));
  const validation = JSON.parse(await readFile(report, 'utf8'));
  assert.equal(validation.ok, true);
  assert.equal(validation.application_version, version);
  assert.deepEqual(
    await readdir(directory),
    ['sf-tools.exe'],
    'No companion file may be written beside the copied executable',
  );
  return validation;
}
const validation = await launch('Fresh Desktop', 'cold-cache');
const cache = path.join(runtime, version + '-' + metadata.payload_id);
const loader = path.join(cache, 'WebView2Loader.dll');
const firstModified = (await stat(loader)).mtimeMs;
await launch('Moved to another folder', 'warm-cache-relocation');
assert.equal((await stat(loader)).mtimeMs, firstModified, 'An intact loader should be reused');
await writeFile(loader, 'incomplete cached loader');
await launch('Fresh Desktop', 'repaired-cache');
assert.ok((await stat(loader)).size > 10000, 'Corrupt cached loader must be restored');
await writeFile(
  path.join(validationOutput, 'validation.json'),
  JSON.stringify(validation, null, 2) + '\n',
);
const report = {
  ok: true,
  application_version: version,
  standalone_imports: imported,
  cases: ['cold cache with only EXE', 'moved EXE with warm cache', 'repair corrupt cached loader'],
  fixture,
};
await writeFile(
  path.join(validationOutput, 'portable-validation.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
