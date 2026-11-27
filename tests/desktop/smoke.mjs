import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {
  version,
  testCache,
  windowsOutput,
  validationOutput,
  portableFilename,
} from '../../scripts/paths.mjs';
const fixture = path.join(testCache, 'desktop-smoke-' + Date.now());
await mkdir(fixture, { recursive: true });
const executable = path.join(fixture, 'sf-tools.exe');
await copyFile(path.join(windowsOutput, portableFilename), executable);
const server = net.createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await new Promise((resolve) => server.close(resolve));
const app = spawn(executable, [], {
  cwd: fixture,
  windowsHide: true,
  stdio: 'ignore',
  env: {
    ...process.env,
    SF_TOOLS_RUNTIME_DIR: path.join(fixture, 'runtime'),
    WEBVIEW2_USER_DATA_FOLDER: path.join(fixture, 'profile'),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:
      '--remote-debugging-port=' + port + ' --remote-debugging-address=127.0.0.1',
  },
});
let socket;
let id = 0;
const pending = new Map();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await pause(150);
  }
  throw Error('Timed out: ' + label);
}
function command(method, params = {}) {
  const current = ++id;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(current);
      reject(Error('CDP timeout: ' + method));
    }, 10000);
    pending.set(current, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject,
    });
    socket.send(JSON.stringify({ id: current, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
try {
  const target = await until(async () => {
    try {
      const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
      return targets.find((t) => t.type === 'page' && /tauri/.test(t.url));
    } catch {
      return null;
    }
  }, 'own SF-Tools WebView');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const response = JSON.parse(event.data);
    const p = pending.get(response.id);
    if (p) {
      pending.delete(response.id);
      if (response.error) p.reject(Error(JSON.stringify(response.error)));
      else p.resolve(response.result);
    }
  });
  await until(
    () => evaluate('document.body?.innerText.includes("Connect SIMULATOR")'),
    'application UI',
  );
  await evaluate(
    '[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Connect SIMULATOR"))?.click()',
  );
  await until(
    () =>
      evaluate(
        'document.body.innerText.includes("SF-Motion Simulator") && document.body.innerText.includes("Bus voltage")',
      ),
    'simulator connected through UI',
  );
  const overview = await evaluate('document.body.innerText');
  await evaluate(
    '[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Motion Control")?.click()',
  );
  await until(
    () => evaluate('document.body.innerText.includes("PVT point editor")'),
    'Motion Control page',
  );
  const screenshot = await command('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    path.join(validationOutput, 'desktop-smoke.png'),
    Buffer.from(screenshot.data, 'base64'),
  );
  await evaluate(
    '[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Settings")?.click()',
  );
  await until(
    () => evaluate('document.body.innerText.includes("Application: ' + version + '")'),
    'new application version',
  );
  const report = {
    ok: true,
    application_version: version,
    cases: [
      'single EXE starts native WebView UI',
      'connect simulator through actual UI',
      'Motion Control page renders',
      'Settings shows ' + version,
    ],
    fixture,
    overview: overview.includes('0.3.0') ? 'firmware 0.3.0 visible' : 'firmware text unavailable',
  };
  // Return the CDP response before closing its WebView transport.
  await evaluate('setTimeout(() => window.__TAURI_INTERNALS__.invoke("window_close"), 100); true');
  await until(() => app.exitCode !== null, 'test application exits', 10000);
  if (app.exitCode !== 0) throw Error('Application exited with code ' + app.exitCode);
  report.cases.push('test application exits successfully');
  await writeFile(
    path.join(validationOutput, 'desktop-validation.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  if (app.exitCode === null)
    spawnSync('taskkill', ['/PID', String(app.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
}
