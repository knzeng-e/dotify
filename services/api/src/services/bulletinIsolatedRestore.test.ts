import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fixture, tree } from './bulletinPreparedRecovery.fixture.js';
import { inspectBulletinCheckpoint, copyBulletinCheckpoint, verifyBulletinCheckpoint } from './bulletinCheckpoint.js';
import { restoreIsolatedBulletinCheckpoint, verifyIsolatedBulletinRestore } from './bulletinIsolatedRestore.js';
import { checkpointHash } from './bulletinCheckpointFiles.js';
import { assertPublicationBinding, publicationBinding } from './bulletinPublisherProfile.js';
import { decryptStreamingObject, parseStreamingManifest, verifyStreamingManifest } from './streamingFormat.js';
import { streamingKeyFingerprint } from './streamingNonces.js';
import { StreamingJobs } from './streamingJobs.js';
import { createStreamingPublicationStore } from './streamingPublicationStore.js';

async function generated(t: TestContext, mode: 'standard' | 'compact' = 'standard', pruned = false) {
  const parent = await realpath(tmpdir());
  const c = await fixture(t, mode, parent);
  await c.execute((await c.inspect()).planSha256);
  await mkdir(join(c.root, 'keys'), { mode: 0o700 });
  await writeFile(c.profile.seedFile, 'never-copy-test-signer', { mode: 0o600 });
  await writeFile(join(c.root, 'content-key.json'), 'never-copy-test-master', { mode: 0o600 });
  if (pruned) {
    const normal = new StreamingJobs({
      directory: c.queue,
      deriveKey: () => assert.fail('No key for ready pruning'),
      authority: async () => assert.fail('No authority for ready pruning'),
      transcode: async () => assert.fail('No encoding'),
      pin: async () => assert.fail('No publishing'),
      now: () => Date.now() + 8 * 24 * 60 * 60_000
    });
    try {
      await normal.start(false);
      await normal.runNext();
    } finally {
      await normal.stop();
    }
  }
  const before = await tree(c.root);
  const root = await mkdtemp(join(parent, 'dotify-isolated-restore-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const checkpoint = join(root, 'checkpoint');
  const destination = join(root, 'restored');
  const planned = await inspectBulletinCheckpoint(c.options);
  const copied = await copyBulletinCheckpoint({ ...c.options, destination: checkpoint, expectedPlanSha256: planned.report.planSha256 });
  const options = { checkpoint, destination, expectedManifestSha256: copied.manifestSha256, signal: c.options.signal };
  return { c, root, checkpoint, destination, before, plan: planned.plan, copied, options };
}

for (const mode of ['standard', 'compact'] as const) {
  test(`${mode}: recover exact private data after source loss, authenticate retained synthetic audio and refuse ordinary writer bindings`, async t => {
    const x = await generated(t, mode);
    const checkpointBefore = await tree(x.checkpoint);
    await rm(x.c.root, { recursive: true, force: true });
    const result = await restoreIsolatedBulletinCheckpoint(x.options);
    assert.equal(result.writerActivationAllowed, false);
    assert.equal(result.secretsIncluded, false);
    assert.equal(result.canonicalHistoryChecked, false);
    assert.equal(result.ciphertextAuthenticated, false); // The CLI never loads a key.
    assert.deepEqual(await tree(x.checkpoint), checkpointBefore);
    assert.deepEqual((await readdir(x.destination)).sort(), ['checkpoint.json', 'data', 'restore.json']);
    for (const file of x.plan.files) {
      const suffix = ['profile.json', 'queue/publication-store.json', 'publisher/publisher.json'].includes(file.path) ? '.checkpoint' : '';
      const path = join(x.destination, 'data', `${file.path}${suffix}`);
      const bytes = await readFile(path);
      assert.equal(bytes.toString('hex'), x.before[file.path]);
      assert.ok(!bytes.includes(Buffer.from('never-copy-test-')));
      const info = await stat(path);
      assert.equal(info.mode & 0o077, 0);
      assert.equal(info.nlink, 1);
    }
    await assert.rejects(readFile(join(x.destination, 'data', 'profile.json')), /ENOENT/);
    await assert.rejects(assertPublicationBinding(join(x.destination, 'data', 'queue'), x.c.profile), /Streaming publication profile changed/);
    await assert.rejects(assertPublicationBinding(join(x.destination, 'data', 'queue')), /cannot be opened with Pinata/);
    // Independently exercise the publisher barrier through the normal binding
    // contract, even if a caller prepares another queue with matching settings.
    const probe = join(x.root, 'probe-queue');
    await mkdir(probe, { mode: 0o700 });
    const relocated = { ...x.c.profile, directory: join(x.destination, 'data', 'publisher') };
    await writeFile(join(probe, 'publication-store.json'), JSON.stringify(publicationBinding(relocated)), { mode: 0o600 });
    await assert.rejects(assertPublicationBinding(probe, relocated), /Bulletin publication profile changed/);
    const probeProfile = join(x.root, 'probe-profile.json');
    await writeFile(probeProfile, JSON.stringify(relocated), { mode: 0o600 });
    const noPublisher = {
      loadSigner: async () => assert.fail('Restore must refuse before signer loading'),
      openSession: () => assert.fail('Restore must never open a transport')
    };
    const options = {
      provider: 'bulletin' as const,
      queue: join(x.destination, 'data', 'queue'),
      profileFile: probeProfile,
      releaseAssets: true,
      contentKeyVault: x.c.vault,
      assetAuthority: async () => true
    };
    await assert.rejects(createStreamingPublicationStore(options, noPublisher), /Streaming publication profile changed/);
    await assert.rejects(createStreamingPublicationStore({ ...options, queue: probe }, noPublisher), /Bulletin publication profile changed/);
    await assert.rejects(createStreamingPublicationStore({ provider: 'pinata', queue: options.queue }, noPublisher), /cannot be opened with Pinata/);

    await assert.rejects(readFile(x.c.profile.seedFile), /ENOENT/);
    const output = join(x.destination, 'data', 'queue', 'jobs', x.c.options.jobId, 'output');
    const manifest = parseStreamingManifest(await readFile(join(output, 'manifest.json')));
    // Test-only public key, supplied explicitly outside the production restore.
    verifyStreamingManifest(manifest, x.c.key, x.c.scope);
    for (const object of [manifest.master, ...manifest.renditions.flatMap(r => [r.init, ...r.segments])]) {
      const plain = decryptStreamingObject(await readFile(join(output, object.path)), x.c.key, manifest, object);
      assert.deepEqual(
        plain,
        object.kind === 'master'
          ? Buffer.from('generated fixture only')
          : object.kind === 'init'
            ? Buffer.from('structural init')
            : Buffer.alloc(64, object.index + 1)
      );
    }
    const jobs = JSON.parse(await readFile(join(x.destination, 'data', 'queue', 'jobs.json'), 'utf8'));
    const fingerprint = streamingKeyFingerprint(x.c.key);
    for (const generation of [manifest.generation, jobs.jobs[0].sourceGeneration]) {
      const reservation = JSON.parse(await readFile(join(x.destination, 'data', 'queue', 'nonces', fingerprint, `${generation}.json`), 'utf8'));
      assert.deepEqual(reservation, { schema: 'dotify.streaming.nonce-ledger.v1', fingerprint, generation });
    }
    // Verification remains self-contained after both the live sources and the
    // original hashed-object checkpoint are absent.
    await rm(x.checkpoint, { recursive: true });
    assert.deepEqual(await verifyIsolatedBulletinRestore(x.destination, x.copied.manifestSha256, x.options.signal), result);
  });

  test(`${mode}: restore a normally pruned ready store without fabricating ciphertext, counters or reservations`, async t => {
    const x = await generated(t, mode, true);
    assert.equal(x.plan.queueJobs, 0);
    await rm(x.c.root, { recursive: true, force: true });
    const result = await restoreIsolatedBulletinCheckpoint(x.options);
    assert.equal(result.queueJobs, 0);
    assert.equal(result.inventories, 1);
    assert.deepEqual(await readdir(join(x.destination, 'data', 'queue', 'jobs')), []);
    assert.equal((await readFile(join(x.destination, 'data', 'publisher', `${x.c.name}.json`))).toString('hex'), x.before[`publisher/${x.c.name}.json`]);
    assert.deepEqual(await verifyIsolatedBulletinRestore(x.destination, x.copied.manifestSha256, x.options.signal), result);
  });
}

test('bad digest, existing destination, overlapping original/input paths and cancellation refuse without changing source or existing data', async t => {
  const x = await generated(t);
  const before = await tree(x.root);
  await assert.rejects(restoreIsolatedBulletinCheckpoint({ ...x.options, expectedManifestSha256: '00'.repeat(32) }), /separately retained/);
  await assert.rejects(readdir(x.destination), /ENOENT/);
  for (const destination of [join(x.checkpoint, 'nested'), join(x.c.queue, 'nested'), x.c.root])
    await assert.rejects(restoreIsolatedBulletinCheckpoint({ ...x.options, destination }), /overlaps/);
  await assert.rejects(restoreIsolatedBulletinCheckpoint({ ...x.options, signal: AbortSignal.abort() }), { name: 'AbortError' });
  assert.deepEqual(await tree(x.root), before);
  const manifestPath = join(x.checkpoint, 'checkpoint.json');
  const originalManifest = await readFile(manifestPath);
  const oversized = JSON.parse(originalManifest.toString('utf8'));
  const profileEntry = oversized.plan.files.find((entry: { path: string }) => entry.path === 'profile.json');
  oversized.plan.totalBytes += 2 * 1024 * 1024 + 1 - profileEntry.bytes;
  profileEntry.bytes = 2 * 1024 * 1024 + 1;
  oversized.planSha256 = checkpointHash(JSON.stringify(oversized.plan));
  const manifestBytes = Buffer.from(JSON.stringify(oversized));
  await writeFile(manifestPath, manifestBytes);
  await assert.rejects(
    restoreIsolatedBulletinCheckpoint({ ...x.options, expectedManifestSha256: checkpointHash(manifestBytes) }),
    /logical JSON exceeds bound/
  );
  await assert.rejects(readdir(x.destination), /ENOENT/);
  await writeFile(manifestPath, originalManifest);
  await mkdir(x.destination, { mode: 0o700 });
  await writeFile(join(x.destination, 'sentinel'), 'keep', { mode: 0o600 });
  await assert.rejects(restoreIsolatedBulletinCheckpoint(x.options), /EEXIST/);
  assert.equal(await readFile(join(x.destination, 'sentinel'), 'utf8'), 'keep');
});

test('restored verification refuses changed data, changed barriers, missing empty directories, links and an incomplete marker', async t => {
  const x = await generated(t, 'compact');
  await restoreIsolatedBulletinCheckpoint(x.options);
  const verify = () => verifyIsolatedBulletinRestore(x.destination, x.copied.manifestSha256, x.options.signal);
  const file = join(x.destination, 'data', 'queue', 'jobs.json');
  const original = await readFile(file);
  await writeFile(file, Buffer.from('{}'));
  await assert.rejects(verify(), /differs from checkpoint/);
  await writeFile(file, original);
  const guard = join(x.destination, 'data', 'publisher', 'publisher.json');
  const barrier = await readFile(guard);
  await writeFile(guard, await readFile(`${guard}.checkpoint`));
  await assert.rejects(verify(), /barrier changed/);
  await writeFile(guard, barrier);
  await rm(join(x.destination, 'data', 'queue', 'incoming'), { recursive: true });
  await assert.rejects(verify(), /Missing restored directory/);
  await mkdir(join(x.destination, 'data', 'queue', 'incoming'), { mode: 0o700 });
  await rm(file);
  await symlink(join(x.c.root, 'profile.json'), file);
  await assert.rejects(verify(), /refuses links/);
  await rm(file);
  await writeFile(file, original, { mode: 0o600 });
  await writeFile(join(x.destination, 'INCOMPLETE'), 'unfinished', { mode: 0o600 });
  await assert.rejects(verify(), /Incomplete/);
});

test('hash-consistent but unsettled data leaves a guarded incomplete restore, never a successful reconstruction', async t => {
  const x = await generated(t);
  const manifestFile = join(x.checkpoint, 'checkpoint.json');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  const entry = manifest.plan.files.find((file: { path: string }) => file.path === 'publisher/owner.json');
  const ownerFile = join(x.checkpoint, 'objects', `${entry.sha256}.bin`);
  const owner = JSON.parse(await readFile(ownerFile, 'utf8'));
  owner.activeJob = x.c.name;
  const bytes = Buffer.from(JSON.stringify(owner));
  manifest.plan.totalBytes += bytes.length - entry.bytes;
  entry.bytes = bytes.length;
  const oldHash = entry.sha256;
  entry.sha256 = checkpointHash(bytes);
  await writeFile(join(x.checkpoint, 'objects', `${entry.sha256}.bin`), bytes, { mode: 0o600 });
  if (!manifest.plan.files.some((file: { sha256: string }) => file.sha256 === oldHash)) await rm(ownerFile);
  manifest.planSha256 = checkpointHash(JSON.stringify(manifest.plan));
  const encoded = Buffer.from(JSON.stringify(manifest));
  await writeFile(manifestFile, encoded);
  const digest = checkpointHash(encoded); // Simulated untrusted producer, not an operator recommendation.
  await verifyBulletinCheckpoint(x.checkpoint, digest, x.options.signal); // Byte integrity alone passes.
  const before = await tree(x.checkpoint);
  await assert.rejects(restoreIsolatedBulletinCheckpoint({ ...x.options, expectedManifestSha256: digest }), /Active publisher/);
  assert.deepEqual(await tree(x.checkpoint), before);
  assert.ok(await readFile(join(x.destination, 'INCOMPLETE')));
  await assert.rejects(verifyIsolatedBulletinRestore(x.destination, digest, x.options.signal), /Incomplete/);
  await assert.rejects(assertPublicationBinding(join(x.destination, 'data', 'queue'), x.c.profile), /profile changed/);
});

test('restore CLI needs no application environment, key or original sources and prints only filtered results', async t => {
  const x = await generated(t);
  await rm(x.c.root, { recursive: true, force: true });
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ['--import', 'tsx', 'src/scripts/checkpointBulletinCustody.ts', ...args], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH }
    });
  const restored = run('restore', x.checkpoint, x.destination, x.copied.manifestSha256);
  assert.equal(restored.status, 0, restored.stderr);
  const report = JSON.parse(restored.stdout);
  assert.equal(report.writerActivationAllowed, false);
  assert.equal(report.ciphertextAuthenticated, false);
  assert.ok(!restored.stdout.includes(x.root) && !restored.stdout.includes(x.c.root));
  await rm(x.checkpoint, { recursive: true });
  const verified = run('verify-restored', x.destination, x.copied.manifestSha256);
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(JSON.parse(verified.stdout).planSha256, report.planSha256);
  const refused = run('verify-restored', x.destination, '00'.repeat(32));
  assert.equal(refused.status, 1);
  assert.equal(refused.stdout, '');
  assert.ok(refused.stderr.startsWith('BULLETIN_CHECKPOINT_STOPPED:') && !refused.stderr.includes(x.root));
});
