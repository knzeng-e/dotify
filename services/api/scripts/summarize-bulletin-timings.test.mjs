import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, link, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { summarizeBulletinTimings, writeTimingSummary } from './summarize-bulletin-timings.mjs';

const job = '11111111-1111-4111-8111-111111111111';
const otherJob = '22222222-2222-4222-8222-222222222222';
const script = fileURLToPath(new URL('./summarize-bulletin-timings.mjs', import.meta.url));
const phase = (extra = {}) => ({ calls: 2, failures: 0, totalMs: 90, maxMs: 50, peakConcurrency: 2, inFlightAtReport: 0, ...extra });
const event = (extra = {}) => ({
  code: 'BULLETIN_PUBLICATION_TIMING',
  schema: 'dotify.bulletin.publication-timing.v1',
  scope: 'publisher-attempt',
  kind: 'metadata',
  jobId: job,
  outcome: 'succeeded',
  elapsedMs: 60,
  phases: { store: phase(), submitAndFinalize: phase({ totalMs: 80, maxMs: 40 }) },
  milestones: { firstInclusion: { observations: 2, totalMs: 30, maxMs: 20 } },
  ...extra
});
const encode = (...values) => values.map(value => JSON.stringify(value, null, 2)).join('\n');
const fly = value => ({ timestamp: '2026-11-09T22:00:00.123456789Z', instance: 'private-machine', message: JSON.stringify(value) });

test('preserves overlapping counters as individual samples, not wall-time shares or a speed claim', () => {
  const input = encode(event());
  const result = summarizeBulletinTimings(input);
  assert.equal(result.inputSha256, createHash('sha256').update(input).digest('hex'));
  assert.equal(result.samples[0].elapsedMs, 60);
  assert.equal(result.samples[0].phases.store.totalMs, 90);
  assert.equal(result.samples[0].phases.submitAndFinalize.totalMs, 80);
  assert.deepEqual(result.interpretation, {
    elapsedScope: 'publisher-attempt',
    phaseTotalsAreNotAdditive: true,
    duplicateRecordsAreRetained: true,
    endToEndPublicationMeasured: false
  });
});

test('reads actual Fly pretty-object framing and JSONL without leaking envelope or report extras', () => {
  const privateValue = 'PRIVATE-content-key-CID-account-error';
  const one = event({ time: 1794261600000, contentKey: privateValue, hostname: privateValue, err: { message: privateValue } });
  const wrapped = fly(one);
  wrapped.message = JSON.stringify({ ...one, msg: 'quoted } { and escaped \\" text' });
  const input = encode({ message: 'System noise } {' }, wrapped) + '\n' + JSON.stringify(event({ jobId: otherJob }));
  const result = summarizeBulletinTimings(input);
  assert.equal(result.recordCount, 3);
  assert.equal(result.sampleCount, 2);
  assert.deepEqual(
    result.samples.map(x => x.job),
    [1, 2]
  );
  assert.equal(result.samples[0].observedAt, '2026-11-09T22:00:00.123Z');
  const output = JSON.stringify(result);
  for (const text of [privateValue, job, otherJob, 'private-machine', 'hostname', 'contentKey', 'err']) assert.ok(!output.includes(text), text);
});

test('retains duplicate observations and unknown job/kind without inventing an attempt identity', () => {
  const bare = event();
  delete bare.code;
  delete bare.kind;
  delete bare.jobId;
  const result = summarizeBulletinTimings(encode(fly(event()), fly(event()), bare));
  assert.equal(result.sampleCount, 3);
  assert.deepEqual(
    result.samples.map(x => x.job),
    [1, 1, null]
  );
  assert.equal(result.samples[2].kind, null);
});

test('filters a selected job but never exports its UUID', () => {
  const result = summarizeBulletinTimings(encode(event(), event({ jobId: otherJob })), { jobId: otherJob });
  assert.equal(result.sampleCount, 1);
  assert.equal(result.samples[0].job, 1);
  assert.ok(!JSON.stringify(result).includes(otherJob));
  assert.throws(() => summarizeBulletinTimings(encode(event()), { jobId: otherJob }), /No matching/);
  assert.throws(() => summarizeBulletinTimings(encode(event()), { jobId: 'private-invalid-input' }), /Invalid job filter/);
});

test('retains failed and in-flight measurements without pretending missing milestones were zero', () => {
  const result = summarizeBulletinTimings(encode(event({ outcome: 'failed', phases: { store: phase({ failures: 1, inFlightAtReport: 1 }) }, milestones: {} })));
  assert.equal(result.samples[0].outcome, 'failed');
  assert.equal(result.samples[0].phases.store.inFlightAtReport, 1);
  assert.deepEqual(result.samples[0].milestones, {});
});

test('rejects malformed, unsupported or inconsistent timing reports without echoing raw values', () => {
  const invalid = [
    event({ schema: 'future-private-schema' }),
    event({ scope: 'private-scope' }),
    event({ code: 'private-other-code' }),
    event({ kind: 'private-kind' }),
    event({ jobId: 'private-id' }),
    event({ elapsedMs: -1 }),
    event({ elapsedMs: Number.MAX_SAFE_INTEGER + 1 }),
    event({ outcome: 'unknown-private' }),
    event({ phases: { privatePhase: phase() } }),
    event({ phases: { store: phase({ calls: 0 }) } }),
    event({ phases: { store: phase({ failures: 3 }) } }),
    event({ phases: { store: phase({ inFlightAtReport: 2, failures: 1 }) } }),
    event({ phases: { store: phase({ peakConcurrency: 3 }) } }),
    event({ phases: { store: phase({ maxMs: 91 }) } }),
    event({ phases: { store: phase({ extra: 'private-token' }) } }),
    event({ phases: [] }),
    event({ milestones: { privateMilestone: { observations: 1, totalMs: 1, maxMs: 1 } } }),
    event({ milestones: { created: { observations: 0, totalMs: 0, maxMs: 0 } } })
  ];
  for (const value of invalid)
    assert.throws(
      () => summarizeBulletinTimings(encode(value)),
      error => !error.message.includes('private-')
    );
  assert.throws(() => summarizeBulletinTimings(encode({ ...fly(event()), timestamp: 'private-bad-date' })), /Invalid timing observation/);
});

test('bounds input, object and sample counts and rejects truncation/trailing garbage', () => {
  for (const text of ['{} private-token', '{"message":"unfinished', '{"a":}', '[]', '{"code":"BULLETIN_PUBLICATION_TIMING"}'])
    assert.throws(() => summarizeBulletinTimings(text));
  assert.throws(() => summarizeBulletinTimings(encode({ message: 'x'.repeat(64 * 1024) })), /size limit/);
  assert.throws(() => summarizeBulletinTimings(' '.repeat(16 * 1024 * 1024 + 1)), /size limit/);
  assert.throws(() => summarizeBulletinTimings('{}\n'.repeat(10_001)), /excessive/);
  assert.throws(() => summarizeBulletinTimings((JSON.stringify(event()) + '\n').repeat(1_001)), /Too many timing/);
  assert.throws(() => summarizeBulletinTimings(encode({ message: 'ordinary log only' })), /No matching/);
});

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'dotify-timing-report-'));
  try {
    const input = join(directory, 'private input.json');
    const output = join(directory, 'new output.json');
    await writeFile(input, encode(fly(event())), { mode: 0o600 });
    await run({ directory, input, output });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('CLI writes an exclusive private report and keeps stdout free of identifiers', async () => {
  await fixture(async ({ input, output }) => {
    const child = spawnSync(process.execPath, [script, '--input', input, '--output', output, '--job', job], { encoding: 'utf8', timeout: 5_000 });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout.trim(), 'Timing summary written (1 samples).');
    assert.ok(!child.stdout.includes(job));
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    assert.equal(JSON.parse(await readFile(output, 'utf8')).sampleCount, 1);
    const before = await readFile(output);
    await assert.rejects(writeTimingSummary(input, output));
    assert.deepEqual(await readFile(output), before);
  });
});

test('refuses symlinks, hardlinked/public inputs and existing outputs without touching their bytes', async () => {
  await fixture(async ({ directory, input, output }) => {
    const alias = join(directory, 'input-alias');
    await symlink(input, alias);
    await assert.rejects(writeTimingSummary(alias, output));
    await rm(alias);
    await link(input, alias);
    await assert.rejects(writeTimingSummary(input, output), /private owned/);
    await rm(alias);
    await chmod(input, 0o644);
    await assert.rejects(writeTimingSummary(input, output), /private owned/);
    await chmod(input, 0o600);
    await assert.rejects(writeTimingSummary(directory, output), /private owned/);
    await assert.rejects(writeTimingSummary(input, input), /new output/);
    await symlink(input, output);
    const before = await readFile(input);
    await assert.rejects(writeTimingSummary(input, output));
    assert.deepEqual(await readFile(input), before);
  });
});

test('rejects invalid UTF-8 and invalid reports before creating any output; binds a BOM to the input digest', async () => {
  await fixture(async ({ input, output }) => {
    for (const bytes of [Buffer.from([0xff, 0xfe]), Buffer.from(encode(event({ elapsedMs: -1 })))]) {
      await writeFile(input, bytes);
      await assert.rejects(writeTimingSummary(input, output));
      await assert.rejects(stat(output), { code: 'ENOENT' });
    }
    const bytes = Buffer.from('\uFEFF' + encode(event()));
    await writeFile(input, bytes);
    await writeTimingSummary(input, output);
    assert.equal(JSON.parse(await readFile(output, 'utf8')).inputSha256, createHash('sha256').update(bytes).digest('hex'));
  });
});

test('CLI errors and argument refusals never echo a private path or parser payload', async () => {
  const result = spawnSync(process.execPath, [script, '--input', '/private-secret-path', '--output', '/private-output'], { encoding: 'utf8', timeout: 5_000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TIMING_REPORT_REFUSED/);
  assert.ok(!result.stderr.includes('/private-secret-path'));
  const unknown = spawnSync(process.execPath, [script, '--private-token'], { encoding: 'utf8', timeout: 5_000 });
  assert.equal(unknown.status, 1);
  assert.ok(!unknown.stderr.includes('private-token'));
});
