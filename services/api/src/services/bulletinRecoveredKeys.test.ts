import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, realpath, rm, chmod, rename, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fixture, tree } from './bulletinPreparedRecovery.fixture.js';
import { copyBulletinCheckpoint, inspectBulletinCheckpoint } from './bulletinCheckpoint.js';
import { restoreIsolatedBulletinCheckpoint, verifyIsolatedBulletinRestore } from './bulletinIsolatedRestore.js';
import { verifyRecoveredBulletinKeys } from './bulletinRecoveredKeys.js';
import { StreamingJobs } from './streamingJobs.js';
import { streamingKeyFingerprint } from './streamingNonces.js';

const publicMaster = '43'.repeat(32);
const keyBytes = (masters: Record<string, string> = { 'dotify-content-key-v3': publicMaster }) =>
  JSON.stringify({ schema: 'dotify.content-key-recovery.v1', masters });
async function prepared(t: TestContext, mode: 'standard' | 'compact' = 'standard', change?: (c: Awaited<ReturnType<typeof fixture>>) => Promise<void>) {
  const parent = await realpath(tmpdir()),
    c = await fixture(t, mode, parent);
  await c.execute((await c.inspect()).planSha256);
  await change?.(c);
  const root = await mkdtemp(join(parent, 'dotify-recovered-keys-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const checkpoint = join(root, 'checkpoint'),
    directory = join(root, 'restored'),
    plan = await inspectBulletinCheckpoint(c.options);
  const copied = await copyBulletinCheckpoint({ ...c.options, destination: checkpoint, expectedPlanSha256: plan.report.planSha256 });
  await restoreIsolatedBulletinCheckpoint({ checkpoint, destination: directory, expectedManifestSha256: copied.manifestSha256, signal: c.options.signal });
  await rm(c.root, { recursive: true });
  await rm(checkpoint, { recursive: true });
  await mkdir(join(root, 'recovered-keys'), { mode: 0o700 });
  const keyFile = join(root, 'recovered-keys', 'versions.json');
  await writeFile(keyFile, keyBytes(), { mode: 0o600 });
  return { c, root, directory, keyFile, options: { directory, keyFile, expectedManifestSha256: copied.manifestSha256, signal: c.options.signal } };
}
for (const mode of ['standard', 'compact'] as const)
  test(`${mode}: explicit recovered keys authenticate every source/object with originals absent and no writes`, async t => {
    const x = await prepared(t, mode),
      before = await tree(x.root),
      r = await verifyRecoveredBulletinKeys(x.options);
    assert.equal(r.authenticatedObjects, 14);
    assert.equal(r.retainedAudioInventories, 1);
    assert.equal(r.prunedAudioInventories, 0);
    assert.equal(r.nonceReservationsChecked, 2);
    assert.equal(r.requiredVersionsPresent, 1);
    assert.deepEqual(r.authenticatedKeyVersions, ['dotify-content-key-v3']);
    assert.equal(r.ciphertextAuthenticated, true);
    assert.equal(r.allAudioCiphertextRetained, true);
    for (const flag of [
      'writerActivationAllowed',
      'canonicalHistoryChecked',
      'independentStorageVerified',
      'keyBackupOriginVerified',
      'signerLoaded',
      'serviceStarted'
    ] as const)
      assert.equal(r[flag], false);
    assert.deepEqual(await tree(x.root), before);
    const output = JSON.stringify(r);
    assert.ok(!output.includes(publicMaster) && !output.includes(x.root) && !output.includes(x.c.scope.contentHash));
    await assert.rejects(readFile(x.c.profileFile), /ENOENT/);
  });
test('missing/wrong versions and unsafe keys refuse, without falling back to application environment', async t => {
  const x = await prepared(t),
    before = await tree(x.directory);
  for (const bytes of [
    keyBytes({ 'dotify-content-key-v2': publicMaster }),
    keyBytes({ 'dotify-content-key-v3': '44'.repeat(32) }),
    '{}',
    keyBytes({ 'dotify-content-key-v1': publicMaster })
  ]) {
    await writeFile(x.keyFile, bytes);
    await assert.rejects(verifyRecoveredBulletinKeys(x.options));
  }
  await writeFile(x.keyFile, keyBytes());
  await chmod(x.keyFile, 0o644);
  await assert.rejects(verifyRecoveredBulletinKeys(x.options), /Unsafe checkpoint metadata/);
  await chmod(x.keyFile, 0o600);
  const link = join(x.root, 'recovered-keys', 'linked.json');
  await symlink(x.keyFile, link);
  await assert.rejects(verifyRecoveredBulletinKeys({ ...x.options, keyFile: link }));
  await assert.rejects(verifyRecoveredBulletinKeys({ ...x.options, keyFile: join(x.directory, 'unexpected.json') }), /overlap/);
  const child = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/scripts/verifyRecoveredBulletinKeys.ts', x.directory, x.options.expectedManifestSha256, join(x.root, 'missing-keys')],
    { encoding: 'utf8', env: { PATH: process.env.PATH, CONTENT_KEY_MASTER_SECRETS: JSON.stringify({ 'dotify-content-key-v3': publicMaster }) } }
  );
  assert.equal(child.status, 1);
  assert.equal(child.stdout, '');
  assert.match(child.stderr, /^BULLETIN_RECOVERED_KEYS_STOPPED:/);
  assert.ok(!child.stderr.includes(x.root) && !child.stderr.includes(publicMaster));
  assert.deepEqual(await tree(x.directory), before);
});
for (const corruption of ['source', 'manifest', 'segment'] as const)
  test(`hash-consistent ${corruption} corruption still fails cryptographic readback`, async t => {
    const x = await prepared(t, 'standard', async c => {
      const folder = join(c.queue, 'jobs', c.options.jobId),
        file =
          corruption === 'source'
            ? join(folder, 'source.bin')
            : corruption === 'manifest'
              ? join(folder, 'output', 'manifest.json')
              : join(folder, 'output', '320', 'segment-002.bin');
      const bytes = await readFile(file);
      if (corruption === 'manifest') {
        const m = JSON.parse(bytes.toString('utf8'));
        m.authentication.tag = m.authentication.tag === '00'.repeat(16) ? '11'.repeat(16) : '00'.repeat(16);
        await writeFile(file, JSON.stringify(m));
      } else {
        bytes[0] ^= 1;
        await writeFile(file, bytes);
      }
    });
    await verifyIsolatedBulletinRestore(x.directory, x.options.expectedManifestSha256, x.options.signal);
    const before = await tree(x.root);
    await assert.rejects(verifyRecoveredBulletinKeys(x.options));
    assert.deepEqual(await tree(x.root), before);
  });
test('reservation under the wrong key fingerprint refuses although keyless reconstruction passes', async t => {
  const x = await prepared(t, 'compact', async c => {
    const manifest = JSON.parse(await readFile(join(c.queue, 'jobs', c.options.jobId, 'output', 'manifest.json'), 'utf8')),
      correct = streamingKeyFingerprint(c.key),
      wrong = 'aa'.repeat(32);
    await mkdir(join(c.queue, 'nonces', wrong), { mode: 0o700 });
    const target = join(c.queue, 'nonces', wrong, `${manifest.generation}.json`);
    await rename(join(c.queue, 'nonces', correct, `${manifest.generation}.json`), target);
    await writeFile(target, JSON.stringify({ schema: 'dotify.streaming.nonce-ledger.v1', fingerprint: wrong, generation: manifest.generation }));
  });
  await assert.rejects(verifyRecoveredBulletinKeys(x.options), /Missing restored metadata/);
});
test('normal ciphertext pruning reports partial history, never full audio recovery', async t => {
  const x = await prepared(t, 'standard', async c => {
    const jobs = new StreamingJobs({
      directory: c.queue,
      deriveKey: () => assert.fail('No key'),
      authority: async () => assert.fail('No authority'),
      transcode: async () => assert.fail('No encoding'),
      pin: async () => assert.fail('No publishing'),
      now: () => Date.now() + 8 * 24 * 60 * 60_000
    });
    try {
      await jobs.start(false);
      await jobs.runNext();
    } finally {
      await jobs.stop();
    }
  });
  const r = await verifyRecoveredBulletinKeys(x.options);
  assert.equal(r.authenticatedObjects, 0);
  assert.equal(r.prunedAudioInventories, 1);
  assert.equal(r.retainedAudioInventories, 0);
  assert.equal(r.ciphertextAuthenticated, false);
  assert.equal(r.allAudioCiphertextRetained, false);
  assert.deepEqual(r.authenticatedKeyVersions, []);
  assert.equal(r.writerActivationAllowed, false);
});
test('CLI needs explicit recovered versions only, emits filtered counts and respects cancellation', async t => {
  const x = await prepared(t, 'compact'),
    child = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/scripts/verifyRecoveredBulletinKeys.ts', x.directory, x.options.expectedManifestSha256, x.keyFile],
      { encoding: 'utf8', env: { PATH: process.env.PATH } }
    );
  assert.equal(child.status, 0, child.stderr);
  const r = JSON.parse(child.stdout);
  assert.equal(r.authenticatedObjects, 14);
  assert.equal(r.writerActivationAllowed, false);
  assert.ok(!child.stdout.includes(publicMaster) && !child.stdout.includes(x.root));
  await assert.rejects(verifyRecoveredBulletinKeys({ ...x.options, signal: AbortSignal.abort() }), { name: 'AbortError' });
});
