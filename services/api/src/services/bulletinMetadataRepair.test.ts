import assert from 'node:assert/strict';
import { it, type TestContext } from 'node:test';
import { readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { assetFixture } from './bulletinPublicAssets.fixture.js';
import { PreparedReleaseConflictError, prepareMetadataNameRepair } from './bulletinMetadataRepair.js';
import { createStreamingPublicationStore } from './streamingPublicationStore.js';
import { load, ownerSchema, jobSchema } from './bulletinMediaState.js';
import type { PublisherDependencies } from './streamingPublicationStore.js';
const signal = () => AbortSignal.timeout(10000);
const files = (value: unknown) => [{ path: 'release.json', bytes: Buffer.from(JSON.stringify(value)) }];
async function fixture(t: TestContext) {
  const c = await assetFixture(t);
  c.metadata.track.artistName = 'Unknown artist';
  c.metadata.track.description = 'An eight-second synthetic test.';
  const store = await createStreamingPublicationStore(c.options, c.deps);
  const cover = await store.pinAsset!(c.cover.files, 'cover', c.owner, signal());
  const root = await store.pinAsset!(files(c.metadata), 'metadata', c.owner, signal());
  await store.close();
  const options = { ...c.options, metadataRepairAuthority: async () => true };
  const input = { profile: c.profile, queue: c.queue, policyFile: c.policyFile, artistName: 'Thot Nzeng', signal: signal() };
  const snapshot = async () => {
    const names = (await readdir(c.profile.directory)).filter(name => name !== 'publisher.lock' && name !== 'metadata-name-repair.json');
    return Promise.all(names.sort().map(async name => [name, (await readFile(join(c.profile.directory, name))).toString('hex')]));
  };
  return { ...c, c, options, input, snapshot, root, cover };
}
it('inspects without persistent mutation or stores, then admits one exact graph and preserves all original data across restart/retry', async t => {
  const { c, options, input, snapshot, cover } = await fixture(t);
  const before = await snapshot();
  const writes = c.writes;
  const result = await prepareMetadataNameRepair(input, async () => true);
  assert.deepEqual(await snapshot(), before);
  assert.equal(c.writes, writes);
  const repair = result.plan.repair;
  assert.equal(repair.budget.maxTransactions, 2);
  await prepareMetadataNameRepair({ ...input, admitPlan: result.planSha256 }, async () => true);
  assert.deepEqual(await snapshot(), before);
  assert.equal(c.writes, writes);
  let store = await createStreamingPublicationStore(options, c.deps);
  const root = await store.pinAsset!(files({ ...repair.manifest, createdAt: '2026-11-03T00:00:00.000Z' }), 'metadata', c.owner, signal());
  assert.equal(root, repair.newRoot);
  assert.equal(c.writes, writes + 2);
  const owner = ownerSchema.parse(await load(join(c.profile.directory, 'owner.json')));
  assert.equal(owner.jobs.length, 3);
  assert.equal(owner.activeJob, null);
  const jobs = await Promise.all(owner.jobs.map(name => load(join(c.profile.directory, name + '.json')).then(jobSchema.parse)));
  const replacement = jobs.find(job => job.root === root)!;
  assert.deepEqual(replacement.budget, repair.budget);
  assert.equal(replacement.attemptedStores, 2);
  assert.equal(replacement.attemptedBytes, repair.budget.maxBytes);
  for (const [name, hex] of before) {
    if (name === 'owner.json') continue;
    assert.equal((await readFile(join(c.profile.directory, name))).toString('hex'), hex, name);
  }
  const reserve = c.reserves[c.reserves.length - 1];
  assert.ok(reserve.transactions >= c.profile.priorRenewalReserve.transactions + 2 + c.cover.files.length);
  assert.equal(await store.pinAsset!(c.cover.files, 'cover', c.owner, signal()), cover);
  await store.close();
  store = await createStreamingPublicationStore(options, c.deps);
  assert.equal(await store.pinAsset!(files(repair.manifest), 'metadata', c.owner, signal()), root);
  assert.equal(c.writes, writes + 2);
  await store.close();
});
it('rejects unapproved changes and an already registered runtime before any replacement store', async t => {
  const { c, options, input } = await fixture(t);
  const inspected = await prepareMetadataNameRepair(input, async () => true);
  const value = inspected.plan.repair.manifest;
  let store = await createStreamingPublicationStore(options, c.deps);
  const writes = c.writes;
  await assert.rejects(store.pinAsset!(files(value), 'metadata', c.owner, signal()), /different release details/);
  await store.close();
  await prepareMetadataNameRepair({ ...input, admitPlan: inspected.planSha256 }, async () => true);
  store = await createStreamingPublicationStore({ ...options, metadataRepairAuthority: async () => false }, c.deps);
  await assert.rejects(store.pinAsset!(files(value), 'metadata', c.owner, signal()), /unregistered release/);
  await store.close();
  store = await createStreamingPublicationStore(options, c.deps);
  for (const changed of [
    c.metadata,
    { ...value, track: { ...value.track, title: 'Another title' } },
    { ...value, royalties: [{ recipient: c.owner.address, bps: 10000 }] }
  ]) {
    await assert.rejects(store.pinAsset!(files(changed), 'metadata', c.owner, signal()), PreparedReleaseConflictError);
  }
  assert.equal(c.writes, writes);
  await store.close();
});
it('refuses live leases, stale plans, changed authority, invalid names and a second admission without changing counters', async t => {
  const { c, options, input, snapshot } = await fixture(t);
  const before = await snapshot();
  let store = await createStreamingPublicationStore(options, c.deps);
  await assert.rejects(
    prepareMetadataNameRepair(input, async () => true),
    /EEXIST/
  );
  await store.close();
  const originalFile = join(c.profile.directory, 'public-metadata-input.json');
  const originalBytes = await readFile(originalFile);
  await writeFile(originalFile, JSON.stringify({ ...c.metadata, track: { ...c.metadata.track, artistName: 'An actual artist' } }), { mode: 0o600 });
  await assert.rejects(
    prepareMetadataNameRepair(input, async () => true),
    /Only the Unknown artist/
  );
  await writeFile(originalFile, originalBytes, { mode: 0o600 });
  for (const artistName of ['', ' Unknown ', 'Unknown artist', 'é'.repeat(401)]) {
    await assert.rejects(prepareMetadataNameRepair({ ...input, artistName }, async () => true));
  }
  await assert.rejects(
    prepareMetadataNameRepair(input, async () => false),
    /unregistered release check/
  );
  const inspected = await prepareMetadataNameRepair(input, async () => true);
  await assert.rejects(
    prepareMetadataNameRepair({ ...input, admitPlan: '0'.repeat(64) }, async () => true),
    /plan changed/
  );
  assert.deepEqual(await snapshot(), before);
  let observations = 0;
  await assert.rejects(
    prepareMetadataNameRepair({ ...input, admitPlan: inspected.planSha256 }, async () => ++observations === 1),
    /changed before admission/
  );
  await prepareMetadataNameRepair({ ...input, admitPlan: inspected.planSha256 }, async () => true);
  await assert.rejects(
    prepareMetadataNameRepair({ ...input, admitPlan: inspected.planSha256 }, async () => true),
    /EEXIST/
  );
  assert.deepEqual(await snapshot(), before);
});
it('refuses a plan after nonce state changes and refuses an existing writer barrier', async t => {
  const { c, input } = await fixture(t);
  const inspected = await prepareMetadataNameRepair(input, async () => true);
  const file = join(c.profile.directory, 'owner.json');
  const saved = await readFile(file);
  const owner = JSON.parse(saved.toString());
  await writeFile(file, JSON.stringify({ ...owner, nextNonce: owner.nextNonce + 1 }), { mode: 0o600 });
  await assert.rejects(
    prepareMetadataNameRepair({ ...input, admitPlan: inspected.planSha256 }, async () => true),
    /plan changed/
  );
  await writeFile(file, saved, { mode: 0o600 });
  const lock = join(c.profile.directory, 'writer.lock');
  await writeFile(lock, '{}', { mode: 0o600 });
  await assert.rejects(
    prepareMetadataNameRepair(input, async () => true),
    /writer lock/
  );
  await rm(lock);
});

it('keeps unknown stores charged and blocks replay across restart', async t => {
  const { c, options, input } = await fixture(t);
  const inspected = await prepareMetadataNameRepair(input, async () => true);
  await prepareMetadataNameRepair({ ...input, admitPlan: inspected.planSha256 }, async () => true);
  c.fail = true;
  let store = await createStreamingPublicationStore(options, c.deps);
  await assert.rejects(store.pinAsset!(files(inspected.plan.repair.manifest), 'metadata', c.owner, signal()), /uncertain store/);
  const writes = c.writes;
  await store.close();
  c.fail = false;
  store = await createStreamingPublicationStore(options, c.deps);
  await assert.rejects(store.pinAsset!(files(inspected.plan.repair.manifest), 'metadata', c.owner, signal()), /unresolved/);
  assert.equal(c.writes, writes);
  await store.close();
});
it('reconciles a lost acknowledgement without duplicate stores and keeps the exact additional allowance', async t => {
  const { c, options, input } = await fixture(t);
  const inspected = await prepareMetadataNameRepair(input, async () => true);
  await prepareMetadataNameRepair({ ...input, admitPlan: inspected.planSha256 }, async () => true);
  const base = c.transport.store;
  let lose = true;
  c.transport.store = async (...args) => {
    const receipt = await base(...args);
    if (lose) {
      lose = false;
      throw new Error('lost acknowledgement');
    }
    return receipt;
  };
  const before = c.writes;
  let store = await createStreamingPublicationStore(options, c.deps);
  await assert.rejects(store.pinAsset!(files(inspected.plan.repair.manifest), 'metadata', c.owner, signal()), /lost acknowledgement/);
  await store.close();
  store = await createStreamingPublicationStore(options, c.deps);
  assert.equal(await store.pinAsset!(files(inspected.plan.repair.manifest), 'metadata', c.owner, signal()), inspected.plan.repair.newRoot);
  assert.equal(c.writes, before + 2);
  await store.close();
});
it('refuses corrupt or changed permits before signer load or publication, and never overwrites the original manifest', async t => {
  const { c, options, input } = await fixture(t);
  const inspected = await prepareMetadataNameRepair(input, async () => true);
  await prepareMetadataNameRepair({ ...input, admitPlan: inspected.planSha256 }, async () => true);
  let store = await createStreamingPublicationStore(options, c.deps);
  const permit = join(c.profile.directory, 'metadata-name-repair.json');
  const saved = await readFile(permit);
  await writeFile(permit, JSON.stringify({ ...inspected.plan.repair, budget: { ...inspected.plan.repair.budget, maxTransactions: 10 } }), { mode: 0o600 });
  await assert.rejects(store.pinAsset!(files(inspected.plan.repair.manifest), 'metadata', c.owner, signal()), /binding, bytes or allowance/);
  await store.close();
  let signers = 0;
  const deps: PublisherDependencies = {
    ...c.deps,
    loadSigner: async p => {
      signers++;
      return c.deps.loadSigner(p);
    }
  };
  await assert.rejects(createStreamingPublicationStore(options, deps), /binding, bytes or allowance/);
  assert.equal(signers, 0);
  await writeFile(permit, '{', { mode: 0o600 });
  await assert.rejects(createStreamingPublicationStore(options, deps), SyntaxError);
  assert.equal(signers, 0);
  await writeFile(permit, saved, { mode: 0o600 });
  await assert.rejects(createStreamingPublicationStore(c.options, deps), /unregistered-release check required/);
  assert.equal(signers, 0);
  await writeFile(permit, saved, { mode: 0o600 });
  store = await createStreamingPublicationStore(options, c.deps);
  await store.pinAsset!(files(inspected.plan.repair.manifest), 'metadata', c.owner, signal());
  await store.close();
  await rm(permit);
  await assert.rejects(createStreamingPublicationStore(options, deps), /permit missing/);
  assert.equal(signers, 0);
  await assert.rejects(
    prepareMetadataNameRepair(input, async () => true),
    /already started/
  );
});

it('offers the saved snapshot without writes, but never for another owner, runtime, chain or audio', async t => {
  const { c, options, input, snapshot } = await fixture(t);
  const inspected = await prepareMetadataNameRepair(input, async () => true);
  await prepareMetadataNameRepair({ ...input, admitPlan: inspected.planSha256 }, async () => true);
  const store = await createStreamingPublicationStore(options, c.deps);
  try {
    const before = await snapshot();
    const writes = c.writes;
    const expected = inspected.plan.repair.manifest;
    const draft = {
      ...expected,
      assets: { ...expected.assets, coverCID: '' },
      track: { ...expected.track, title: 'filename', description: 'New note', priceDot: '1.2' }
    };
    await assert.rejects(store.pinAsset!(files(draft), 'metadata', c.owner, signal()), error => {
      assert.ok(error instanceof PreparedReleaseConflictError);
      assert.deepEqual(error.fields, ['title', 'description', 'cover', 'listening access or price']);
      assert.deepEqual(error.preparedRelease, { owner: c.owner.address, runtimeAddress: c.owner.runtimeAddress, chainId: c.owner.chainId, manifest: expected });
      return true;
    });
    const requests = [
      [draft, { ...c.owner, address: '0x' + '99'.repeat(20) }],
      [draft, { ...c.owner, runtimeAddress: '0x' + '99'.repeat(20) }],
      [draft, { ...c.owner, chainId: c.owner.chainId + 1 }],
      [{ ...draft, track: { ...draft.track, contentHash: '0x' + '99'.repeat(32) } }, c.owner],
      [{ ...draft, assets: { ...draft.assets, audioCID: 'different-audio' } }, c.owner],
      [{ ...draft, assets: { ...draft.assets, keyVersion: 'dotify-content-key-v3' } }, c.owner]
    ] as const;
    for (const [manifest, owner] of requests) {
      await assert.rejects(store.pinAsset!(files(manifest), 'metadata', owner, signal()), error => {
        assert.ok(!(error instanceof PreparedReleaseConflictError));
        return true;
      });
    }
    assert.equal(c.writes, writes);
    assert.deepEqual(await snapshot(), before);
    assert.equal(await store.pinAsset!(files(expected), 'metadata', c.owner, signal()), inspected.plan.repair.newRoot);
    assert.equal(c.writes, writes + 2);
    await store.pinAsset!(files(expected), 'metadata', c.owner, signal());
    assert.equal(c.writes, writes + 2);
  } finally {
    await store.close();
  }
});
