import assert from 'node:assert/strict';
import { it, type TestContext } from 'node:test';
import { mkdtemp, realpath, rm, readFile, writeFile, mkdir, symlink, link, chmod, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { initializeBulletinPublisher, type BulletinPublisherProfile } from './bulletinPublisherProfile.js';
import { BULLETIN_MEDIA_GENESIS } from './bulletinHttpReader.js';
import { initializeStreamingJobs } from './streamingJobs.js';
import { StreamingNonceLedger } from './streamingNonces.js';
import { load, save } from './bulletinMediaState.js';
import { inspectGenerationMigration, stageGenerationMigration, verifyGenerationPackage } from './bulletinGenerationMigration.js';
import { snapshotTree } from './bulletinMigrationSnapshot.js';
import { createStreamingPublicationStore, type PublisherDependencies } from './streamingPublicationStore.js';
async function fixture(t: TestContext) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dotify-generation-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scope = { chainId: 420420417, runtimeAddress: `0x${'22'.repeat(20)}`, contentHash: `0x${'33'.repeat(32)}`, keyVersion: 'dotify-content-key-v2' };
  const budget = { maxBytes: 524288, maxTransactions: 16, minimumLifetimeBlocks: 100 };
  const profile: BulletinPublisherProfile = {
    schema: 'dotify.bulletin.publisher.v1',
    genesis: BULLETIN_MEDIA_GENESIS,
    endpoint: 'wss://bulletin.example',
    account: '5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca',
    directory: join(root, 'publications'),
    seedFile: join(root, 'key', 'DO-NOT-READ.seed'),
    budget,
    pipeline: { concurrency: 2, maxInFlightBytes: 524288 },
    priorRenewalReserve: { transactions: 10, bytes: 1000 },
    pilotScope: scope
  };
  const queue = join(root, 'queue'),
    profileFile = join(root, 'profile.json'),
    extra = join(root, 'old-pinata-queue');
  await save(root, 'profile.json', profile);
  await initializeBulletinPublisher(queue, profile);
  await initializeStreamingJobs(extra);
  const key = Buffer.alloc(32, 7),
    candidate = () => Buffer.from('0102030405060708', 'hex');
  await new StreamingNonceLedger(join(queue, 'nonces'), candidate).reserve(key);
  await new StreamingNonceLedger(join(extra, 'nonces'), () => Buffer.from('1112131415161718', 'hex')).reserve(key);
  const job = 'stream-12345678-1234-4234-8234-123456789abc',
    cid = 'bafk2bzaceamyjzmsnmpmwqzjyyo4boaz76znwpnzmetkob2jdwjdkehq3shgc';
  await save(profile.directory, `${job}.json`, {
    schema: 'dotify.bulletin.media-job.v2',
    genesis: profile.genesis,
    account: profile.account,
    job,
    root: cid,
    scope,
    generation: 'public-cover-v1',
    blocks: [{ cid, bytes: 117 }],
    budget,
    attemptedStores: 2,
    attemptedBytes: 234,
    receipts: { [cid]: { cid, bytes: 117, block: 10, index: 0, expiresAt: 200, finalized: true } },
    pending: {},
    nextNonce: 102,
    pipeline: profile.pipeline,
    ready: true
  });
  await save(profile.directory, 'owner.json', {
    schema: 'dotify.bulletin.media-owner.v2',
    genesis: profile.genesis,
    account: profile.account,
    jobs: [job],
    activeJob: null,
    nextNonce: 102
  });
  await save(profile.directory, 'public-metadata-input.json', { preserved: 'sidecar' });
  const destination = join(root, 'candidate');
  const { pilotScope: _, ...base } = profile;
  const targetProfile: BulletinPublisherProfile = {
    ...base,
    directory: join(destination, 'next', 'publications'),
    priorRenewalReserve: { transactions: 40, bytes: 5000 },
    releasePolicy: {
      schema: 'dotify.bulletin.release-policy.v1',
      artists: [{ owner: `0x${'11'.repeat(20)}`, chainId: scope.chainId, runtimeAddress: scope.runtimeAddress, keyVersion: scope.keyVersion }],
      maxReleases: 2,
      cover: budget,
      metadata: budget,
      total: { maxBytes: budget.maxBytes * 6, maxTransactions: budget.maxTransactions * 6 }
    }
  };
  const request = {
    schema: 'dotify.bulletin.generation-migration.v1',
    sources: [{ profileFile, queue }],
    additionalNonceQueues: [extra],
    externalRenewalReserve: { transactions: 20, bytes: 2000 },
    destination,
    targetProfile
  };
  return { root, profile, queue, profileFile, extra, request, key, job, candidate };
}
it('stages history, unions nonces and carries conservative floors without signer or source mutation', async t => {
  const c = await fixture(t),
    before = await snapshotTree(c.root);
  const { report } = await inspectGenerationMigration(c.request);
  assert.deepEqual(await snapshotTree(c.root), before);
  assert.deepEqual(report.requiredReserve, { transactions: 31, bytes: 3117 });
  assert.equal(report.nonceReservations, 2);
  assert.equal(report.nextNonce, 102);
  assert.equal(report.attemptedStores, 2);
  await stageGenerationMigration(c.request, report.planSha256);
  const dest = c.request.destination;
  assert.equal((await verifyGenerationPackage(dest)).networkWrites, 0);
  assert.deepEqual(await snapshotTree(join(dest, 'history/0/queue')), await snapshotTree(c.queue));
  assert.deepEqual(await snapshotTree(join(dest, 'history/0/publications')), await snapshotTree(c.profile.directory));
  assert.deepEqual(await readFile(join(dest, 'history/0/profile.json')), await readFile(c.profileFile));
  const owner = (await load(join(dest, 'next/publications/owner.json'))) as { nextNonce: number; jobs: string[] };
  assert.equal(owner.nextNonce, 102);
  assert.deepEqual(owner.jobs, []);
  let candidates = 0;
  const reserved = await new StreamingNonceLedger(join(dest, 'next/queue/nonces'), () =>
    ++candidates === 1 ? c.candidate() : Buffer.from('2122232425262728', 'hex')
  ).reserve(c.key);
  assert.equal(reserved.generation, '2122232425262728');
  await assert.rejects(verifyGenerationPackage(dest), /changed state/);
  let signerLoads = 0;
  const deps = {
    loadSigner: async () => {
      signerLoads++;
      return { account: c.profile.account, dispose() {} };
    },
    openSession: () => ({
      transport: { genesis: c.profile.genesis, account: c.profile.account, status: async () => ({ head: 100, authorization: { expiresAt: 10000 } }) },
      close() {}
    })
  } as unknown as PublisherDependencies;
  const publisher = await createStreamingPublicationStore(
    {
      provider: 'bulletin',
      queue: join(dest, 'next/queue'),
      profileFile: join(dest, 'next/profile.json'),
      releaseAssets: true,
      assetAuthority: async () => true
    },
    deps
  );
  await publisher.close();
  assert.equal(signerLoads, 1);
  const inherited = ((await load(join(dest, 'next/queue/nonce-history.json'))) as { reservations: { path: string }[] }).reservations[0];
  await rm(join(dest, 'next/queue/nonces', inherited.path));
  await assert.rejects(
    createStreamingPublicationStore(
      {
        provider: 'bulletin',
        queue: join(dest, 'next/queue'),
        profileFile: join(dest, 'next/profile.json'),
        releaseAssets: true,
        assetAuthority: async () => true
      },
      deps
    )
  );
  assert.equal(signerLoads, 1, 'Missing inherited reservation must stop before signer loading');
});
it('verifies a relocated backup in a fresh process and detects missing or altered state', async t => {
  const c = await fixture(t),
    inspection = await inspectGenerationMigration(c.request);
  const staged = await stageGenerationMigration(c.request, inspection.report.planSha256);
  const backup = join(c.root, 'restored-copy');
  await cp(c.request.destination, backup, { recursive: true });
  const result = await new Promise<{ code: number | null; output: string }>(resolve => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/scripts/prepareBulletinGeneration.ts', 'verify', backup, staged.packageSha256], {
      cwd: process.cwd(),
      env: { ...process.env, MNEMONIC: 'must-not-be-used' }
    });
    let output = '';
    child.stdout.on('data', chunk => (output += chunk));
    child.on('close', code => resolve({ code, output }));
  });
  assert.equal(result.code, 0);
  assert.equal(JSON.parse(result.output).activationReady, false);
  assert.equal(JSON.parse(result.output).trustedDigestMatched, true);
  await assert.rejects(verifyGenerationPackage(backup, '0'.repeat(64)), /trusted review digest/);
  await rm(join(backup, 'next/queue/nonces/ledger.json'));
  await assert.rejects(verifyGenerationPackage(backup), /changed state/);
  await writeFile(join(c.request.destination, 'history/0/publications/public-metadata-input.json'), 'changed', { mode: 0o600 });
  await assert.rejects(verifyGenerationPackage(c.request.destination), /changed state/);
});
it('binds exact source bytes and caps and never overwrites a partial candidate', async t => {
  const c = await fixture(t),
    first = await inspectGenerationMigration(c.request);
  await save(c.profile.directory, 'public-metadata-input.json', { preserved: 'edited' });
  await assert.rejects(stageGenerationMigration(c.request, first.report.planSha256), /plan changed/);
  const second = await inspectGenerationMigration(c.request);
  await mkdir(c.request.destination, { mode: 0o700 });
  await assert.rejects(stageGenerationMigration(c.request, second.report.planSha256), /absent/);
  assert.deepEqual(await snapshotTree(c.request.destination), []);
});
it('refuses pending/barrier/orphaned states and missing nonce custody', async t => {
  const c = await fixture(t),
    file = join(c.profile.directory, 'owner.json'),
    owner = (await load(file)) as object;
  await save(c.profile.directory, 'owner.json', { ...owner, activeJob: c.job });
  await assert.rejects(inspectGenerationMigration(c.request), /barrier/);
  await save(c.profile.directory, 'owner.json', owner);
  const inventory = (await load(join(c.profile.directory, `${c.job}.json`))) as object;
  await save(c.profile.directory, `${c.job}.json`, { ...inventory, pending: { anything: { nonce: 101, afterBlock: 9 } } });
  await assert.rejects(inspectGenerationMigration(c.request), /Pending submission/);
  await save(c.profile.directory, `${c.job}.json`, inventory);
  await save(c.profile.directory, 'stream-00000000-0000-4000-8000-000000000000.json', inventory);
  await assert.rejects(inspectGenerationMigration(c.request), /orphaned/);
  await rm(join(c.profile.directory, 'stream-00000000-0000-4000-8000-000000000000.json'));
  await rm(join(c.queue, 'nonces/ledger.json'));
  await assert.rejects(inspectGenerationMigration(c.request), /nonce history/);
});
it('refuses lower reserves, wrong account, overlapping roots, unsafe links and crash locks', async t => {
  const c = await fixture(t);
  await assert.rejects(
    inspectGenerationMigration({ ...c.request, targetProfile: { ...c.request.targetProfile, priorRenewalReserve: { transactions: 30, bytes: 3117 } } }),
    /lowers/
  );
  await assert.rejects(inspectGenerationMigration({ ...c.request, targetProfile: { ...c.request.targetProfile, account: '5'.repeat(48) } }), /account differs/);
  await assert.rejects(inspectGenerationMigration({ ...c.request, additionalNonceQueues: [c.queue] }), /overlapping/);
  const lock = join(c.profile.directory, 'publisher.lock');
  await writeFile(lock, '{}', { mode: 0o600 });
  await assert.rejects(inspectGenerationMigration(c.request), /lock/);
  await rm(lock);
  const file = join(c.profile.directory, 'public-metadata-input.json'),
    other = join(c.profile.directory, 'unsafe');
  await symlink(file, other);
  await assert.rejects(inspectGenerationMigration(c.request), /link/);
  await rm(other);
  await link(file, other);
  await assert.rejects(inspectGenerationMigration(c.request), /Invalid private/);
  await rm(other);
  await chmod(file, 0o644);
  await assert.rejects(inspectGenerationMigration(c.request), /Invalid private/);
});
it('conservatively carries more than one generation without refunding overlapping obligations', async t => {
  const c = await fixture(t),
    secondQueue = join(c.root, 'queue2'),
    secondDirectory = join(c.root, 'publications2');
  const second = { ...c.profile, directory: secondDirectory };
  await initializeBulletinPublisher(secondQueue, second);
  await save(c.root, 'profile2.json', second);
  const owner = (await load(join(secondDirectory, 'owner.json'))) as object;
  await save(secondDirectory, 'owner.json', { ...owner, nextNonce: 120 });
  const request = {
    ...c.request,
    sources: [...c.request.sources, { profileFile: join(c.root, 'profile2.json'), queue: secondQueue }],
    targetProfile: { ...c.request.targetProfile, priorRenewalReserve: { transactions: 50, bytes: 6000 } }
  };
  const prepared = await inspectGenerationMigration(request);
  assert.equal(prepared.report.nextNonce, 120);
  assert.deepEqual(prepared.report.requiredReserve, { transactions: 41, bytes: 4117 });
  await stageGenerationMigration(request, prepared.report.planSha256);
  assert.equal(((await load(join(request.destination, 'next/publications/owner.json'))) as { nextNonce: number }).nextNonce, 120);
});
it('refuses queued preparation and malformed reservation records before creating a candidate', async t => {
  const c = await fixture(t),
    scope = c.profile.pilotScope!,
    time = Date.now();
  const job = {
    id: '12345678-1234-4234-8234-123456789abc',
    owner: `0x${'11'.repeat(20)}`,
    scope,
    state: 'encoding',
    attempts: 1,
    createdAt: time,
    updatedAt: time,
    sourceBytes: 117,
    sourceGeneration: '0102030405060708'
  };
  await save(c.queue, 'jobs.json', { schema: 'dotify.streaming.jobs.v1', jobs: [job] });
  await assert.rejects(inspectGenerationMigration(c.request), /Quiesce/);
  await save(c.queue, 'jobs.json', { schema: 'dotify.streaming.jobs.v1', jobs: [{ ...job, state: 'failed', sourceGeneration: '9999999999999999' }] });
  await assert.rejects(inspectGenerationMigration(c.request), /lacks permanent/);
  await save(c.queue, 'jobs.json', { schema: 'dotify.streaming.jobs.v1', jobs: [] });
  const entries = await snapshotTree(join(c.extra, 'nonces'));
  const reservation = entries.find(e => e.path.includes('/') && e.sha256 !== null)!;
  await writeFile(join(c.extra, 'nonces', reservation.path), '{}', { mode: 0o600 });
  await assert.rejects(inspectGenerationMigration(c.request), /Invalid nonce reservation/);
});
