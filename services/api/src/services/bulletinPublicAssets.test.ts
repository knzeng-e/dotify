import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assetFixture } from './bulletinPublicAssets.fixture.js';
import { buildPublicAssetGraph, initializePublicAssetPolicy, readPublicAsset, publicAssetJob } from './bulletinPublicAssets.js';
import { createStreamingPublicationStore } from './streamingPublicationStore.js';
import { load, ownerSchema } from './bulletinMediaState.js';
const signal = () => AbortSignal.timeout(10000);
it('publishes and reads both public assets with one account cursor, preserves audio binding and reuses receipts after restart', async t => {
  const c = await assetFixture(t);
  const before = await readFile(join(c.queue, 'publication-store.json'));
  let store = await createStreamingPublicationStore(c.options, c.deps);
  const metadataFiles = [{ path: 'release.json', bytes: Buffer.from(JSON.stringify(c.metadata)) }];
  const [cover, metadata] = await Promise.all([
    store.pinAsset!(c.cover.files, 'cover', c.owner, signal()),
    store.pinAsset!(metadataFiles, 'metadata', c.owner, signal())
  ]);
  const writes = c.writes;
  assert.ok(writes > 0);
  assert.ok(c.peak <= 2);
  const read = (cid: string) => c.transport.readBlock(cid, signal());
  assert.deepEqual(
    (await readPublicAsset(read, cover, 'cover/640.webp', signal())).bytes,
    Buffer.from(c.cover.files.find(f => f.path === 'cover/640.webp')!.bytes)
  );
  assert.deepEqual(JSON.parse((await readPublicAsset(read, metadata, 'release.json', signal())).bytes.toString()), c.metadata);
  const owner = ownerSchema.parse(await load(join(c.profile.directory, 'owner.json')));
  assert.equal(owner.jobs.length, 2);
  assert.equal(owner.activeJob, null);
  assert.equal(owner.nextNonce, 10 + writes);
  assert.ok(c.reserves.some(r => r.transactions > c.profile.priorRenewalReserve.transactions));
  await store.close();
  store = await createStreamingPublicationStore(c.options, c.deps);
  assert.equal(await store.pinAsset!(c.cover.files, 'cover', c.owner, signal()), cover);
  assert.equal(await store.pinAsset!(metadataFiles, 'metadata', c.owner, signal()), metadata);
  assert.equal(c.writes, writes);
  assert.equal(
    await store.pinAsset!(
      [{ path: 'release.json', bytes: Buffer.from(JSON.stringify({ ...c.metadata, createdAt: '2026-11-02T12:00:00.000Z' })) }],
      'metadata',
      c.owner,
      signal()
    ),
    metadata
  );
  assert.equal(c.writes, writes);
  assert.deepEqual(await readFile(join(c.queue, 'publication-store.json')), before);
  await store.close();
});
it('rejects changed authority, policy, invalid image/metadata and undersized caps before any store', async t => {
  const c = await assetFixture(t);
  const store = await createStreamingPublicationStore(c.options, c.deps);
  await assert.rejects(store.pinAsset!(c.cover.files, 'cover', { ...c.owner, address: `0x${'aa'.repeat(20)}` }, signal()), /approved pilot/);
  c.allowed = false;
  await assert.rejects(store.pinAsset!(c.cover.files, 'cover', c.owner, signal()), /authority/);
  c.allowed = true;
  await assert.rejects(buildPublicAssetGraph(c.cover.files, 'cover', { ...c.policy, cover: { ...c.policy.cover, maxTransactions: 1 } }, signal()), /cap/);
  await assert.rejects(
    buildPublicAssetGraph(
      c.cover.files.map(f => ({ ...f, bytes: Buffer.from('secret key') })),
      'cover',
      c.policy,
      signal()
    ),
    /image/
  );
  await assert.rejects(
    buildPublicAssetGraph(
      [{ path: 'release.json', bytes: Buffer.from(JSON.stringify({ ...c.metadata, contentKey: 'secret' })) }],
      'metadata',
      c.policy,
      signal()
    )
  );
  await writeFile(c.policyFile, JSON.stringify({ ...c.policy, owner: `0x${'aa'.repeat(20)}` }), { mode: 0o600 });
  await assert.rejects(store.pinAsset!(c.cover.files, 'cover', c.owner, signal()), /policy changed/);
  assert.equal(c.writes, 0);
  await store.close();
});
it('preserves uncertain nonce intents across restart and blocks another asset until reconciliation', async t => {
  const c = await assetFixture(t);
  c.fail = true;
  let store = await createStreamingPublicationStore(c.options, c.deps);
  await assert.rejects(store.pinAsset!(c.cover.files, 'cover', c.owner, signal()), /uncertain store/);
  const attempted = c.writes;
  assert.ok(attempted > 0);
  await store.close();
  store = await createStreamingPublicationStore(c.options, c.deps);
  await assert.rejects(store.pinAsset!(c.cover.files, 'cover', c.owner, signal()), /unresolved/);
  await assert.rejects(
    store.pinAsset!([{ path: 'release.json', bytes: Buffer.from(JSON.stringify(c.metadata)) }], 'metadata', c.owner, signal()),
    /reconciliation/
  );
  assert.equal(c.writes, attempted);
  await store.close();
});
it('provisions an asset allowance once and refuses a live publisher lock', async t => {
  const c = await assetFixture(t);
  await assert.rejects(initializePublicAssetPolicy(c.profile, c.policy), /EEXIST/);
  const store = await createStreamingPublicationStore(c.options, c.deps);
  await assert.rejects(initializePublicAssetPolicy(c.profile, c.policy), /EEXIST/);
  await store.close();
});
it('admits one immutable cover and never widens the audio pilot to public files', async t => {
  const c = await assetFixture(t);
  const store = await createStreamingPublicationStore(c.options, c.deps);
  await store.pinAsset!(c.cover.files, 'cover', c.owner, signal());
  const count = c.writes;
  const changed = c.cover.files.map(f => (f.path === 'cover/640.webp' ? { ...f, bytes: c.cover.files[0].bytes } : f));
  await assert.rejects(store.pinAsset!(changed, 'cover', c.owner, signal()), /already owns/);
  const graph = await buildPublicAssetGraph(c.cover.files, 'cover', c.policy, signal());
  await assert.rejects(store.pin(c.cover.files, publicAssetJob('cover', graph.root), signal()), /manifest required/);
  assert.equal(c.writes, count);
  await store.close();
});
