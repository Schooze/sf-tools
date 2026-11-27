import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);
const result = await build({
  entryPoints: ['tests/frontend/view-harness.tsx'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  plugins: [
    {
      name: 'snapshot-stores',
      setup(build) {
        build.onResolve({ filter: /^zustand$/ }, () => ({
          path: fileURLToPath(new URL('./snapshot-store.ts', import.meta.url)),
        }));
      },
    },
  ],
});
// Import beside node_modules so bundled application code resolves the installed React runtime.
const { writeFile, mkdir } = await import('node:fs/promises');
await mkdir('artifacts/test-cache', { recursive: true });
await writeFile('artifacts/test-cache/view-harness.mjs', result.outputFiles[0].text);
const { renderView } = await import('../../artifacts/test-cache/view-harness.mjs');
test('all connected views render using the latest device model', () => {
  for (const [view, label] of [
    ['overview', 'SF-Motion Simulator'],
    ['configuration', 'Save to flash'],
    ['motion', 'PVT point editor'],
    ['telemetry', 'Telemetry Signals'],
    ['commissioning', 'Estimate pole pairs'],
    ['diagnostics', 'Protection events'],
    ['firmware', 'Update through ST-Link'],
    ['terminal', 'Terminal &amp; Packet Inspector'],
    ['settings', version],
  ]) {
    const html = renderView(view);
    assert.ok(html.toLowerCase().includes(label.toLowerCase()), view + ' missing ' + label);
    assert.ok(!html.includes('1.4.2'), view + ' has obsolete firmware identity');
  }
});
test('disconnected overview does not show invented motor readings', () => {
  const html = renderView('overview', false);
  assert.ok(html.includes('Connect SIMULATOR'));
  assert.ok(!html.includes('48.0'));
  assert.ok(!html.includes('Optimal Range'));
});
