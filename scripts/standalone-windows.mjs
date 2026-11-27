import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { root, version } from './paths.mjs';
export const staging = path.join(root, 'src-tauri/target/standalone');
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${path.basename(command)} exited with ${result.status}`);
}
export async function buildStandalone() {
  await mkdir(staging, { recursive: true });
  const core = path.join(staging, 'sf-tools-core.exe');
  const loader = path.join(root, 'src-tauri/WebView2Loader.dll');
  await copyFile(path.join(root, 'src-tauri/target/release/sf-tools.exe'), core);
  const payloadId = createHash('sha256')
    .update(await readFile(core))
    .update(await readFile(loader))
    .digest('hex')
    .slice(0, 24);
  const env = {
    ...process.env,
    SF_TOOLS_CORE_PATH: core,
    SF_TOOLS_LOADER_PATH: loader,
    SF_TOOLS_APP_VERSION: version,
    SF_TOOLS_PAYLOAD_ID: payloadId,
    SF_TOOLS_TEST_ROOT: path.join(staging, 'tests'),
  };
  const source = path.join(root, 'packaging/windows/launcher.rs');
  const tests = path.join(staging, 'launcher-tests.exe');
  run('rustc', ['--edition=2021', '--test', source, '-o', tests], { env });
  run(tests, [], { env });
  const builds = path.join(root, 'src-tauri/target/release/build');
  let resource;
  for (const folder of await readdir(builds)) {
    if (!folder.startsWith('sf-tools-')) continue;
    const directory = path.join(builds, folder, 'out');
    try {
      const rc = await readFile(path.join(directory, 'resource.rc'), 'utf8');
      if (rc.includes(`VALUE "ProductVersion", "${version}"`)) {
        resource = path.join(directory, 'libresource.a');
        break;
      }
    } catch {}
  }
  if (!resource) throw Error('Matching Windows application resources were not generated');
  const executable = path.join(staging, 'sf-tools.exe');
  run(
    'rustc',
    [
      '--edition=2021',
      source,
      '-O',
      '-C',
      'strip=symbols',
      '-C',
      `link-arg=${resource}`,
      '-o',
      executable,
    ],
    { env },
  );
  const metadata = {
    application_version: version,
    payload_id: payloadId,
    packaging: 'single-file launcher with verified embedded components',
  };
  await writeFile(path.join(staging, 'packaging.json'), JSON.stringify(metadata, null, 2) + '\n');
  return { executable, core, metadata };
}
