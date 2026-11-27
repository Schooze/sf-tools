import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { readFileSync } from 'node:fs';
const { outputFiles } = buildSync({
  entryPoints: ['src/lib/config-model.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node22',
});
const m = await import(
  'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')
);
test('catalog fills upstream version and PVT omissions and preserves access', () => {
  const upstream = JSON.parse(
    readFileSync('shared/firmware/SFMotionRegisters.upstream.json', 'utf8'),
  );
  for (const r of upstream.registers) {
    const x = m.REGISTERS.find((x) => x.address === r.address);
    assert.equal(x.name, r.name);
    assert.equal(x.format, r.format);
    assert.equal(x.read, r.read);
    assert.equal(x.write, r.write);
    assert.equal(x.streaming, r.streaming);
  }
  assert.equal(m.REGISTERS.find((r) => r.address === 1).format, '<3B');
  assert.equal(m.REGISTERS.find((r) => r.address === 103).format, '<fh');
  assert.equal(m.MOTOR_MODES.find((r) => r.value === 0).label, 'Disable');
  assert.equal(m.MOTOR_MODES.find((r) => r.value === 4).label, 'Impedance');
});
test('profile v1 maps old modes and only known parameters', () => {
  const r = m.importProfile(
    JSON.stringify({
      format: 1,
      parameters: { motor_mode: 0, max_current: 4, max_rpm: 1000, pid_id_kp: 0.4 },
    }),
    m.DEFAULT_MOTOR_CONFIG,
  );
  assert.equal(r.parameters.motor_mode, 1);
  assert.equal(r.parameters.limit_current, 4);
  assert.equal(r.parameters.id_kp, 0.4);
  assert.ok(!('max_rpm' in r.parameters));
  assert.ok(r.warnings.includes('Skipped max_rpm'));
});
test('malformed profiles, invalid flags and protection relationships are rejected', () => {
  assert.throws(() =>
    m.importProfile('{"format":2,"parameters":{"kv":"no"}}', m.DEFAULT_MOTOR_CONFIG),
  );
  assert.ok(m.validateConfig({ ...m.DEFAULT_MOTOR_CONFIG, under_voltage: 30 }).under_voltage);
  assert.ok(m.validateConfig({ ...m.DEFAULT_MOTOR_CONFIG, mtpa_enable: 4 }).mtpa_enable);
  assert.ok(m.validateConfig({ ...m.DEFAULT_MOTOR_CONFIG, kv: NaN }).kv);
});
test('partial apply leaves failed fields dirty and keeps newer user edits', () => {
  const device = { kv: 270, rs: 0 };
  const local = { kv: 310, rs: 0.2 };
  const r = m.mergeApply(
    local,
    device,
    { applied: { kv: 300 }, failed: { rs: 'timeout' } },
    { kv: 300, rs: 0.2 },
  );
  assert.equal(r.deviceConfig.kv, 300);
  assert.equal(r.localConfig.kv, 310);
  assert.ok(r.dirtyKeys.has('rs'));
  assert.ok(r.dirtyKeys.has('kv'));
  const cast = m.mergeApply(
    { rs: 0.1 },
    { rs: 0 },
    { applied: { rs: Math.fround(0.1) }, failed: {} },
    { rs: 0.1 },
  );
  assert.equal(cast.dirtyKeys.size, 0);
});
test('PVT CSV validates integer velocities and capacity', () => {
  assert.deepEqual(m.parsePvt('position_deg,velocity_deg_s\n-20,32767\n10,-32768'), [
    { position_deg: -20, velocity_deg_s: 32767 },
    { position_deg: 10, velocity_deg_s: -32768 },
  ]);
  for (const input of ['0,32768', '0,1.5', 'NaN,0', '1,', '', Array(257).fill('0,0').join('\n')])
    assert.throws(() => m.parsePvt(input));
});
test('telemetry distinguishes missing, stale and actual zero', () => {
  assert.equal(m.freshValue(null, 'iq', 1000), undefined);
  const s = { values: { iq: 0 }, updated_ms: { iq: 500 } };
  assert.equal(m.freshValue(s, 'iq', 1000), 0);
  assert.equal(m.freshValue(s, 'iq', 1501), undefined);
});
test('new profiles round trip without changing parameter names', () => {
  const parameters = { ...m.DEFAULT_MOTOR_CONFIG, rs: 0.084, motor_mode: 4 };
  assert.deepEqual(
    m.importProfile(JSON.stringify({ format: 2, parameters }), m.DEFAULT_MOTOR_CONFIG).parameters,
    parameters,
  );
});
