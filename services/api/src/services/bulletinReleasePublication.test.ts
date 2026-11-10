import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { blake2b } from '@noble/hashes/blake2';
import sharp from 'sharp';
import { assetFixture } from './bulletinPublicAssets.fixture.js';
import { createResponsiveCover } from './coverVariants.js';
import { createStreamingPublicationStore, retainedPublicationReserve } from './streamingPublicationStore.js';
import { StreamingJobs } from './streamingJobs.js';
import { PublicationAdmissionError } from './publicationAdmission.js';
import { releaseJob, createReleaseAdmission, admissionDigest } from './bulletinReleaseAdmission.js';
import { publicationBinding } from './bulletinPublisherProfile.js';
import { extendBulletinAdmission } from './bulletinAdmissionExtension.js';
import { load } from './bulletinMediaState.js';
import { verifyReleaseDependencies } from './bulletinReleasePublication.js';
const signal = () => AbortSignal.timeout(10000);
const scopeFor = (master: Buffer, c: Awaited<ReturnType<typeof assetFixture>>) => ({
  ...c.policy.scope,
  contentHash: `0x${Buffer.from(blake2b(master, { dkLen: 32 })).toString('hex')}`
});
const encoded = {
  durationSeconds: 8,
  integratedLufs: -18,
  gainDb: 2,
  renditions: ([96, 160, 320] as const).map(bitrateKbps => ({ bitrateKbps, init: Buffer.from('structural fixture'), segments: [Buffer.alloc(48, 1)] }))
};
function queueFor(
  c: Awaited<ReturnType<typeof assetFixture>>,
  store: Awaited<ReturnType<typeof createStreamingPublicationStore>>,
  transcode = async () => encoded
) {
  return new StreamingJobs({
    directory: c.queue,
    deriveKey: () => Buffer.alloc(32, 27),
    authority: async () => true,
    transcode,
    assertCanPrepare: store.assertCanPrepare,
    admitPreparation: store.admitPreparation,
    pin: store.pin,
    canDiscard: store.canDiscard
  });
}
function metadataFor(c: Awaited<ReturnType<typeof assetFixture>>, contentHash: string, audioCID: string, coverCID: string) {
  return { ...c.metadata, track: { ...c.metadata.track, contentHash }, assets: { ...c.metadata.assets, audioCID, coverCID } };
}
const filesFor = (value: unknown) => [{ path: 'release.json', bytes: Buffer.from(JSON.stringify(value)) }];
it('uses an exact extension window for audio, cover and metadata, retains it on restart and refuses a retrospective edit', async t => {
  const c = await assetFixture(t, true),
    master = Buffer.alloc(64, 77),
    scope = scopeFor(master, c);
  const profileBytes = await readFile(c.profileFile);
  const admission = createReleaseAdmission({
    directory: c.profile.directory,
    profileSha256: publicationBinding(c.profile).profileSha256,
    policy: c.profile.releasePolicy!,
    audio: c.profile.budget
  });
  const writeWindow = { concurrency: 16, maxInFlightBytes: 4 * 1024 * 1024 };
  await extendBulletinAdmission(
    {
      schema: 'dotify.bulletin.release-extension.v1',
      profileFile: c.profileFile,
      queue: c.queue,
      expectedProfileSha256: publicationBinding(c.profile).profileSha256,
      expectedAdmissionSha256: admissionDigest(await admission.validate()),
      owner: c.owner.address,
      scope,
      writeWindow
    },
    true
  );
  let store = await createStreamingPublicationStore(c.options, c.deps);
  const queue = queueFor(c, store);
  await queue.start(false);
  const job = await queue.enqueue({ owner: c.owner.address, scope, master });
  await queue.runNext();
  const ready = queue.get(job.id, c.owner.address, scope.chainId)!;
  assert.equal(ready.state, 'ready');
  const cover = await store.pinAsset!(c.cover.files, 'cover', { ...c.owner, contentHash: scope.contentHash, keyVersion: scope.keyVersion }, signal());
  await store.pinAsset!(filesFor(metadataFor(c, scope.contentHash, ready.result!.ref, `${cover}/cover/640.webp`)), 'metadata', c.owner, signal());
  const owner = (await load(join(c.profile.directory, 'owner.json'))) as { jobs: string[] };
  assert.equal(owner.jobs.length, 3);
  for (const id of owner.jobs) {
    const inventory = (await load(join(c.profile.directory, id + '.json'))) as { pipeline: unknown };
    assert.deepEqual(inventory.pipeline, { ...c.profile.pipeline, writeWindow });
  }
  assert.deepEqual(await readFile(c.profileFile), profileBytes);
  await queue.stop();
  await store.close();
  store = await createStreamingPublicationStore(c.options, c.deps);
  await store.close();
  const file = join(c.profile.directory, 'release-admission.json'),
    ledger = JSON.parse(await readFile(file, 'utf8'));
  ledger.extensions[0].writeWindow.concurrency = 8;
  await writeFile(file, JSON.stringify(ledger));
  await assert.rejects(createStreamingPublicationStore(c.options, c.deps), /pipeline changed/);
});
it('admits another release while this process is actively writing, then serializes both through the same cursor', async t => {
  const c = await assetFixture(t, true),
    original = c.transport.store;
  let release = () => {},
    entered = () => {},
    first = true;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const started = new Promise<void>(resolve => {
    entered = resolve;
  });
  c.transport.store = async (...args) => {
    if (first) {
      first = false;
      entered();
      await gate;
    }
    return original(...args);
  };
  const store = await createStreamingPublicationStore(c.options, c.deps),
    queue = queueFor(c, store);
  await queue.start(false);
  try {
    const one = Buffer.alloc(64, 8),
      two = Buffer.alloc(64, 9);
    const job = await queue.enqueue({ owner: c.owner.address, scope: scopeFor(one, c), master: one });
    const publishing = queue.runNext();
    await started;
    let next;
    try {
      next = await queue.enqueue({ owner: c.owner.address, scope: scopeFor(two, c), master: two });
    } finally {
      release();
    }
    await publishing;
    assert(next);
    assert.equal(queue.get(job.id, c.owner.address, c.policy.scope.chainId)?.state, 'ready');
    await queue.runNext();
    assert.equal(queue.get(next.id, c.owner.address, c.policy.scope.chainId)?.state, 'ready');
    assert(c.peak <= 2);
  } finally {
    release();
    await queue.stop();
    await store.close();
  }
});
it('refuses an audio graph beyond its whole-part cap before any write session can store it', async t => {
  const c = await assetFixture(t, true, { maxBytes: 512 * 1024, maxTransactions: 1, minimumLifetimeBlocks: 100 });
  const store = await createStreamingPublicationStore(c.options, c.deps),
    queue = queueFor(c, store);
  await queue.start(false);
  const master = Buffer.alloc(64, 7),
    scope = scopeFor(master, c);
  const job = await queue.enqueue({ owner: c.owner.address, scope, master });
  await queue.runNext();
  assert.equal(queue.get(job.id, c.owner.address, scope.chainId)?.reason, 'PUBLICATION_NOT_ADMITTED');
  assert.equal(c.writes, 0);
  const owner = (await load(join(c.profile.directory, 'owner.json'))) as { jobs: string[] };
  assert.equal(owner.jobs.length, 0);
  await queue.stop();
  await store.close();
});
it('bounds dependency reads and cancels stalled retention preflight before any store', async t => {
  const c = await assetFixture(t, true);
  const abort = new AbortController();
  let requests = 0;
  c.transport.lookup = async (_cid, signal) => {
    requests++;
    queueMicrotask(() => abort.abort(new Error('Synthetic cancellation')));
    return new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      if (signal.aborted) reject(signal.reason);
    });
  };
  await assert.rejects(
    verifyReleaseDependencies(c.transport, [{ budget: c.profile.budget, blocks: ['a', 'b', 'c'].map(cid => ({ cid, bytes: 1 })) }], abort.signal),
    /Synthetic cancellation/
  );
  assert.equal(requests, 2);
  assert.equal(c.writes, 0);
});
it('publishes two audio/cover/metadata releases through one cursor and recovers references across restart', async t => {
  const c = await assetFixture(t, true);
  let store = await createStreamingPublicationStore(c.options, c.deps);
  const queue = queueFor(c, store);
  await queue.start(false);
  await assert.rejects(
    store.pinAsset!(
      c.cover.files,
      'cover',
      { ...c.owner, address: `0x${'99'.repeat(20)}`, contentHash: c.policy.scope.contentHash, keyVersion: c.policy.scope.keyVersion },
      signal()
    ),
    PublicationAdmissionError
  );
  assert.equal(c.writes, 0);
  const references: Array<{ scope: ReturnType<typeof scopeFor>; cover: string; metadata: string; value: ReturnType<typeof metadataFor> }> = [];
  for (const index of [1, 2]) {
    const master = Buffer.alloc(64, index),
      scope = scopeFor(master, c);
    const cover =
      index === 1
        ? c.cover
        : await createResponsiveCover(
            await sharp({ create: { width: 32, height: 32, channels: 3, background: '#ff7788' } })
              .png()
              .toBuffer(),
            'png'
          );
    const [job, coverRoot] = await Promise.all([
      queue.enqueue({ owner: c.owner.address, scope, master }),
      store.pinAsset!(cover.files, 'cover', { ...c.owner, contentHash: scope.contentHash, keyVersion: scope.keyVersion }, signal())
    ]);
    assert.equal(`stream-${job.id}`, releaseJob(scope, 'audio'));
    await queue.runNext();
    const ready = queue.get(job.id, c.owner.address, scope.chainId)!;
    assert.equal(ready.state, 'ready');
    assert(ready.result);
    // Current Studio stores bare CIDs/paths; explicit ipfs/protected refs also
    // identify exactly the same objects. Reject other roots in either form.
    const value = metadataFor(
      c,
      scope.contentHash,
      index === 1 ? ready.result.ref.split('ipfs://')[1] : ready.result.ref,
      index === 1 ? `${coverRoot}/cover/640.webp` : `ipfs://${coverRoot}/cover/640.webp`
    );
    const metadata = await store.pinAsset!(filesFor(value), 'metadata', c.owner, signal());
    references.push({ scope, cover: coverRoot, metadata, value });
  }
  const count = c.writes;
  assert((await retainedPublicationReserve(c.profile)).transactions > c.profile.priorRenewalReserve.transactions);
  const owner = (await load(join(c.profile.directory, 'owner.json'))) as { jobs: string[]; activeJob: string | null; nextNonce: number };
  assert.equal(owner.jobs.length, 6);
  assert.equal(owner.activeJob, null);
  assert.equal(owner.nextNonce, 10 + count);
  assert(c.peak <= 2);
  await assert.rejects(store.assertCanPrepare!(scopeFor(Buffer.alloc(64, 3), c), undefined, c.owner.address), PublicationAdmissionError);
  const before = await readFile(join(c.profile.directory, 'release-admission.json'));
  const wrongAudio = { ...references[1].value, assets: { ...references[1].value.assets, audioCID: references[0].value.assets.audioCID } };
  await assert.rejects(store.pinAsset!(filesFor(wrongAudio), 'metadata', c.owner, signal()), /Metadata audio/);
  const wrongCover = { ...references[1].value, assets: { ...references[1].value.assets, coverCID: references[0].value.assets.coverCID } };
  await assert.rejects(store.pinAsset!(filesFor(wrongCover), 'metadata', c.owner, signal()), /Metadata cover/);
  const edited = { ...references[1].value, track: { ...references[1].value.track, title: 'Different immutable details' } };
  await assert.rejects(store.pinAsset!(filesFor(edited), 'metadata', c.owner, signal()), /different release details/);
  assert.deepEqual(await readFile(join(c.profile.directory, 'release-admission.json')), before);
  assert.equal(c.writes, count);
  const lookup = c.transport.lookup;
  c.transport.lookup = async (cid, s) => {
    const receipt = await lookup(cid, s);
    return receipt ? { ...receipt, expiresAt: 1001 } : null;
  };
  await assert.rejects(store.pinAsset!(filesFor(references[0].value), 'metadata', c.owner, signal()), /retention/);
  assert.equal(c.writes, count, 'Expired dependencies must not trigger metadata stores or renewals');
  c.transport.lookup = lookup;
  await queue.stop();
  await store.close();
  store = await createStreamingPublicationStore(c.options, c.deps);
  for (const r of references)
    assert.equal(await store.pinAsset!(filesFor({ ...r.value, createdAt: '2026-11-08T12:00:00.000Z' }), 'metadata', c.owner, signal()), r.metadata);
  assert.equal(c.writes, count, 'Response-loss retries must not broadcast another store');
  await store.close();
});
it('keeps an ambiguous store charged, blocks another release and reconciles the same ciphertext exactly once', async t => {
  const c = await assetFixture(t, true);
  const original = c.transport.store;
  const submitted = new Map<string, number>();
  let lose = true,
    encodes = 0;
  c.transport.store = async (block, intent, s) => {
    submitted.set(block.cid, (submitted.get(block.cid) ?? 0) + 1);
    const receipt = await original(block, intent, s);
    if (lose) {
      lose = false;
      throw new Error('Synthetic lost response after inclusion');
    }
    return receipt;
  };
  let store = await createStreamingPublicationStore(c.options, c.deps);
  let queue = queueFor(c, store, async () => {
    encodes++;
    return encoded;
  });
  await queue.start(false);
  const master = Buffer.alloc(64, 4),
    scope = scopeFor(master, c),
    job = await queue.enqueue({ owner: c.owner.address, scope, master });
  await queue.runNext();
  assert.equal(queue.get(job.id, c.owner.address, scope.chainId)?.state, 'failed');
  const before = await readFile(join(c.profile.directory, 'release-admission.json'));
  await assert.rejects(store.admitPreparation!(scopeFor(Buffer.alloc(64, 5), c), c.owner.address), PublicationAdmissionError);
  await assert.rejects(
    store.pinAsset!(c.cover.files, 'cover', { ...c.owner, contentHash: scopeFor(Buffer.alloc(64, 5), c).contentHash, keyVersion: scope.keyVersion }, signal()),
    /reconciliation/
  );
  assert.deepEqual(await readFile(join(c.profile.directory, 'release-admission.json')), before);
  await queue.stop();
  await store.close();
  store = await createStreamingPublicationStore(c.options, c.deps);
  queue = queueFor(c, store, async () => {
    encodes++;
    return encoded;
  });
  await queue.start(false);
  await queue.retry(job.id, c.owner.address, scope.chainId);
  await queue.runNext();
  assert.equal(queue.get(job.id, c.owner.address, scope.chainId)?.state, 'ready');
  assert.equal(encodes, 1);
  assert([...submitted.values()].every(count => count === 1));
  await queue.stop();
  await store.close();
});
it('requires explicit asset selection, immutable policy and intact admission history before reading a signer', async t => {
  const c = await assetFixture(t, true);
  let reads = 0;
  const deps = {
    ...c.deps,
    loadSigner: async (...args: Parameters<typeof c.deps.loadSigner>) => {
      reads++;
      return c.deps.loadSigner(...args);
    }
  };
  await assert.rejects(createStreamingPublicationStore({ ...c.options, releaseAssets: false }, deps), /explicit Bulletin public assets/);
  assert.equal(reads, 0);
  const file = join(c.profile.directory, 'release-admission.json'),
    state = JSON.parse(await readFile(file, 'utf8'));
  await writeFile(file, JSON.stringify({ ...state, profileSha256: '0'.repeat(64) }), { mode: 0o600 });
  await assert.rejects(createStreamingPublicationStore(c.options, deps), /profile changed/);
  await assert.rejects(access(join(c.profile.directory, 'publisher.lock')), { code: 'ENOENT' });
  assert.equal(reads, 0);
  await writeFile(file, JSON.stringify(state), { mode: 0o600 });
  await writeFile(c.profileFile, JSON.stringify({ ...c.profile, releasePolicy: { ...c.profile.releasePolicy, maxReleases: 3 } }), { mode: 0o600 });
  await assert.rejects(createStreamingPublicationStore(c.options, deps), /profile changed/);
  assert.equal(reads, 0);
});
