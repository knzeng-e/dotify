import assert from 'node:assert/strict';
import { it, type TestContext } from 'node:test';
import { realpath, readFile, readdir, writeFile, stat, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { blake2b } from '@noble/hashes/blake2';
import { assetFixture } from './bulletinPublicAssets.fixture.js';
import { initializeFreshBulletinDevelopment } from './freshBulletinDevelopment.js';
import { load } from './bulletinMediaState.js';
import { publisherProfileSchema } from './bulletinPublisherProfile.js';
import { createStreamingPublicationStore } from './streamingPublicationStore.js';
import { deriveContentKeyBytes } from './keyVault.js';
import { StreamingJobs } from './streamingJobs.js';
import { parseStreamingManifest, verifyStreamingManifest, decryptStreamingObject } from './streamingFormat.js';
async function fixture(t: TestContext) {
  const old = await assetFixture(t, true),
    root = await realpath(old.root),
    destination = join(root, 'fresh');
  const profile = {
    ...old.profile,
    directory: join(destination, 'publications'),
    releasePolicy: { ...old.profile.releasePolicy!, artists: old.profile.releasePolicy!.artists.map(a => ({ ...a, keyVersion: 'dotify-content-key-v3' })) }
  };
  const request = {
    schema: 'dotify.bulletin.fresh-development.v1',
    destination,
    retiredKeyVersions: ['dotify-content-key-v2'],
    accountNonceFloor: 1120,
    profile
  };
  return { old, root, request, destination };
}
async function provision(t: TestContext) {
  const c = await fixture(t),
    report = await initializeFreshBulletinDevelopment(c.request);
  const secrets = (await load(join(c.destination, 'content-key.json'))) as Record<string, string>;
  const vault = { contentKeyMasterSecret: '11'.repeat(32), contentKeyMasterSecrets: JSON.stringify(secrets), contentKeyActiveVersion: report.keyVersion };
  const nextNonce = c.old.transport.nextNonce;
  c.old.transport.nextNonce = async signal => {
    const observed = await nextNonce(signal);
    return { ...observed, nonce: Math.max(observed.nonce, 1120) };
  };
  const options = { ...c.old.options, queue: join(c.destination, 'queue'), profileFile: join(c.destination, 'profile.json'), contentKeyVault: vault };
  return { ...c, report, secrets, vault, options };
}
it('creates a separate private key domain and empty publication state without opening damaged historical queues', async t => {
  const c = await fixture(t),
    oldOwner = await readFile(join(c.old.profile.directory, 'owner.json'));
  // Reproduce the review's terminal historical job with a missing permanent
  // source-generation reservation. Fresh setup must neither import nor seal it.
  const time = Date.now(),
    oldJobs = {
      schema: 'dotify.streaming.jobs.v1',
      jobs: [
        {
          id: '12345678-1234-4234-8234-123456789abc',
          owner: c.old.owner.address,
          scope: c.old.policy.scope,
          state: 'failed',
          attempts: 3,
          createdAt: time,
          updatedAt: time,
          sourceBytes: 96,
          sourceGeneration: '0102030405060708'
        }
      ]
    };
  await writeFile(join(c.old.queue, 'jobs.json'), JSON.stringify(oldJobs), { mode: 0o600 });
  const report = await initializeFreshBulletinDevelopment(c.request);
  assert.equal(report.activated, false);
  assert.equal(report.networkWrites, 0);
  assert.equal(report.accountStateVerified, false);
  const secrets = (await load(join(c.destination, 'content-key.json'))) as Record<string, string>;
  assert.match(secrets[report.keyVersion], /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(report).includes(secrets[report.keyVersion]));
  assert.equal((await stat(join(c.destination, 'content-key.json'))).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(join(c.destination, 'queue/nonces')), ['ledger.json']);
  assert.deepEqual(((await load(join(c.destination, 'publications/owner.json'))) as { jobs: string[]; nextNonce: number }).jobs, []);
  assert.equal(((await load(join(c.destination, 'publications/owner.json'))) as { nextNonce: number }).nextNonce, 1120);
  assert.deepEqual(await readFile(join(c.old.profile.directory, 'owner.json')), oldOwner);
  assert.deepEqual(await load(join(c.old.queue, 'jobs.json')), oldJobs);
  assert.deepEqual(await readdir(join(c.old.queue, 'nonces')), ['ledger.json']);
  assert.equal(((await load(join(c.destination, 'profile.json'))) as { priorRenewalReserve: unknown }).priorRenewalReserve !== null, true);
});
it('refuses the old active version or wrong master before any publication session or signer is opened', async t => {
  const c = await provision(t);
  let signerLoads = 0,
    sessions = 0;
  const deps = {
    ...c.old.deps,
    loadSigner: async (...args: Parameters<typeof c.old.deps.loadSigner>) => {
      signerLoads++;
      return c.old.deps.loadSigner(...args);
    },
    openSession: (...args: Parameters<typeof c.old.deps.openSession>) => {
      sessions++;
      return c.old.deps.openSession(...args);
    }
  };
  await assert.rejects(
    createStreamingPublicationStore({ ...c.options, contentKeyVault: { ...c.vault, contentKeyActiveVersion: 'dotify-content-key-v2' } }, deps),
    /version is not configured/
  );
  await assert.rejects(
    createStreamingPublicationStore(
      { ...c.options, contentKeyVault: { ...c.vault, contentKeyMasterSecrets: JSON.stringify({ 'dotify-content-key-v3': '77'.repeat(32) }) } },
      deps
    ),
    /differs/
  );
  assert.equal(signerLoads, 0);
  assert.equal(sessions, 0);
  const store = await createStreamingPublicationStore(c.options, deps);
  await store.close();
  assert.equal(signerLoads, 1);
});
it('publishes two new-domain releases with covers/metadata and authenticates output while preserving old-version keys', async t => {
  const c = await provision(t),
    store = await createStreamingPublicationStore(c.options, c.old.deps);
  let preparedFiles: { path: string; bytes: Uint8Array }[] = [];
  const queue = new StreamingJobs({
    directory: c.options.queue,
    deriveKey: s => deriveContentKeyBytes(s, c.vault),
    authority: async () => true,
    transcode: async () => ({
      durationSeconds: 8,
      integratedLufs: -18,
      gainDb: 2,
      renditions: ([96, 160, 320] as const).map(bitrateKbps => ({ bitrateKbps, init: Buffer.from('fixture'), segments: [Buffer.alloc(48, 1)] }))
    }),
    assertCanPrepare: store.assertCanPrepare,
    admitPreparation: store.admitPreparation,
    pin: async (files, name, signal) => {
      preparedFiles = files;
      return store.pin(files, name, signal);
    },
    canDiscard: store.canDiscard
  });
  await queue.start(false);
  try {
    for (const value of [8, 9]) {
      const master = Buffer.alloc(96, value),
        contentHash = `0x${Buffer.from(blake2b(master, { dkLen: 32 })).toString('hex')}`;
      const scope = { ...c.old.policy.scope, contentHash, keyVersion: 'dotify-content-key-v3' };
      const oldKey = deriveContentKeyBytes({ ...scope, keyVersion: 'dotify-content-key-v2' }, c.vault)!;
      const retained = deriveContentKeyBytes(
        { ...scope, keyVersion: 'dotify-content-key-v2' },
        { ...c.vault, contentKeyActiveVersion: 'dotify-content-key-v2' }
      )!;
      assert.deepEqual(oldKey, retained);
      const key = deriveContentKeyBytes(scope, c.vault)!;
      assert.notDeepEqual(key, oldKey);
      const job = await queue.enqueue({ owner: c.old.owner.address, scope, master });
      await queue.runNext();
      const ready = queue.get(job.id, c.old.owner.address, scope.chainId);
      assert.equal(ready?.state, 'ready');
      assert(ready?.result?.ref.includes('key-v3:'));
      const manifest = parseStreamingManifest(preparedFiles.find(f => f.path === 'manifest.json')!.bytes);
      verifyStreamingManifest(manifest, key, scope);
      assert.throws(() => verifyStreamingManifest(manifest, oldKey, scope));
      assert.deepEqual(decryptStreamingObject(preparedFiles.find(f => f.path === manifest.master.path)!.bytes, key, manifest, manifest.master), master);
      const owner = { ...c.old.owner, contentHash, keyVersion: scope.keyVersion };
      const cover = await store.pinAsset!(c.old.cover.files, 'cover', owner, AbortSignal.timeout(10000));
      const metadata = {
        ...c.old.metadata,
        track: { ...c.old.metadata.track, contentHash },
        assets: { ...c.old.metadata.assets, keyVersion: scope.keyVersion, audioCID: ready!.result!.ref, coverCID: `${cover}/cover/640.webp` }
      };
      await store.pinAsset!([{ path: 'release.json', bytes: Buffer.from(JSON.stringify(metadata)) }], 'metadata', owner, AbortSignal.timeout(10000));
    }
    const owner = (await load(join(c.request.profile.directory, 'owner.json'))) as { jobs: string[]; nextNonce: number };
    assert.equal(owner.jobs.length, 6);
    assert.ok(owner.nextNonce >= 1120);
  } finally {
    await queue.stop();
    await store.close();
  }
});
it('refuses reused versions, mixed domains and existing destinations without replacing any state', async t => {
  const c = await fixture(t);
  await assert.rejects(initializeFreshBulletinDevelopment({ ...c.request, retiredKeyVersions: ['dotify-content-key-v3'] }), /must follow/);
  await assert.rejects(
    initializeFreshBulletinDevelopment({
      ...c.request,
      profile: {
        ...c.request.profile,
        releasePolicy: {
          ...c.request.profile.releasePolicy,
          artists: [
            ...c.request.profile.releasePolicy.artists,
            { ...c.request.profile.releasePolicy.artists[0], runtimeAddress: `0x${'44'.repeat(20)}`, keyVersion: 'dotify-content-key-v4' }
          ]
        }
      }
    }),
    /one fresh active/
  );
  await mkdir(c.destination, { mode: 0o700 });
  await writeFile(join(c.destination, 'keep'), 'keep', { mode: 0o600 });
  await assert.rejects(initializeFreshBulletinDevelopment(c.request), /absent destination/);
  assert.equal(await readFile(join(c.destination, 'keep'), 'utf8'), 'keep');
  assert.equal(
    publisherProfileSchema.safeParse({ ...c.old.profile, freshContentKey: { version: 'dotify-content-key-v3', masterSha256: 'a'.repeat(64) } }).success,
    false
  );
});

it('runs the fresh CLI without printing the generated secret', async t => {
  const c = await fixture(t),
    file = join(c.root, 'request.json');
  await writeFile(file, JSON.stringify(c.request), { mode: 0o600 });
  const result = await new Promise<{ code: number | null; output: string }>(resolve => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/scripts/initializeFreshBulletinDevelopment.ts', file], {
      cwd: process.cwd(),
      env: process.env
    });
    let output = '';
    child.stdout.on('data', data => (output += data));
    child.stderr.on('data', data => (output += data));
    child.on('close', code => resolve({ code, output }));
  });
  assert.equal(result.code, 0);
  assert.equal(JSON.parse(result.output).networkWrites, 0);
  const keys = (await load(join(c.destination, 'content-key.json'))) as Record<string, string>;
  assert.ok(!result.output.includes(keys['dotify-content-key-v3']));
});
