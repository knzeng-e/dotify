import { it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { createPublicAssetRoutes } from './publicAssets.js';
import { assetFixture } from '../services/bulletinPublicAssets.fixture.js';
import { buildPublicAssetGraph } from '../services/bulletinPublicAssets.js';
it('serves bounded artwork and rejects audio paths, queries and ranges before a read', async t => {
  const c = await assetFixture(t);
  const graph = await buildPublicAssetGraph(c.cover.files, 'cover', c.policy, AbortSignal.timeout(10000));
  const blocks = new Map(graph.blocks.map(b => [b.cid, b.bytes]));
  let reads = 0;
  const app = Fastify();
  t.after(() => app.close());
  await app.register(
    createPublicAssetRoutes({
      read: async cid => {
        reads++;
        return blocks.get(cid)!;
      },
      clear() {}
    })
  );
  const url = `/api/assets/ipfs/${graph.root}/cover/160.webp`;
  const image = await app.inject(url);
  assert.equal(image.statusCode, 200);
  assert.match(image.headers['content-type']!, /image\/webp/);
  assert.match(image.headers['cache-control']!, /immutable/);
  const before = reads;
  for (const path of ['archive/master.bin', '160/segment-000.bin', 'manifest.json', 'release.json?token=secret'])
    assert.equal((await app.inject(`/api/assets/ipfs/${graph.root}/${path}`)).statusCode, 404);
  assert.equal((await app.inject({ url, headers: { range: 'bytes=0-1' } })).statusCode, 404);
  assert.equal(reads, before);
  blocks.set(graph.root, Buffer.from('corrupt'));
  const failure = await app.inject(url);
  assert.equal(failure.statusCode, 502);
  assert.match(failure.headers['cache-control']!, /no-store/);
});
it('caps active relay reads and returns validated public JSON', async t => {
  const c = await assetFixture(t);
  const graph = await buildPublicAssetGraph(
    [{ path: 'release.json', bytes: Buffer.from(JSON.stringify(c.metadata)) }],
    'metadata',
    c.policy,
    AbortSignal.timeout(10000)
  );
  const app = Fastify();
  t.after(() => app.close());
  const blocks = new Map(graph.blocks.map(b => [b.cid, b.bytes]));
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  let started = 0;
  await app.register(
    createPublicAssetRoutes({
      read: async cid => {
        started++;
        await gate;
        return blocks.get(cid)!;
      },
      clear() {}
    })
  );
  const url = `/api/assets/ipfs/${graph.root}/release.json`;
  const a = app.inject(url),
    b = app.inject(url);
  while (started < 2) await new Promise(resolve => setImmediate(resolve));
  assert.equal((await app.inject(url)).statusCode, 503);
  release();
  for (const response of await Promise.all([a, b])) {
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), c.metadata);
  }
});
