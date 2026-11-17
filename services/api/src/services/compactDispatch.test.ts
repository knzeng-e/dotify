import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { it } from 'node:test';
import { CID } from 'multiformats/cid';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { parseStreamingReference, formatStreamingReference } from './streamingReference.js';
import { contentKeyVersionForAudioRef } from './keyVault.js';
import { createMediaDeliveryReader } from './mediaDelivery.js';
import { createMediaRoutes } from '../routes/media.js';
import { BULLETIN_MEDIA_GENESIS } from './bulletinHttpReader.js';
import { parseStreamingManifest, decryptStreamingObject } from './streamingFormat.js';
import type { CatalogSnapshot } from './catalog/types.js';
const v = JSON.parse(await readFile(new URL('../../../../web/src/features/catalog/fixtures/compactMedia.json', import.meta.url), 'utf8'));
const parse = (ref: string) => parseStreamingReference(ref, value => CID.parse(value));
const ref = formatStreamingReference(v.root, v.scope.keyVersion, 'rendition-pack-v1', value => CID.parse(value));
it('keeps the physical version explicit and independent of encryption/key versions', () => {
  assert.equal(ref, `dotify:enc:v3:${v.scope.keyVersion.replace('dotify-content-', '')}:bulletin-pack-v1://${v.root}`);
  assert.deepEqual(parse(ref), { root: v.root, keyVersion: v.scope.keyVersion, layout: 'rendition-pack-v1' });
  assert.equal(contentKeyVersionForAudioRef(ref), v.scope.keyVersion);
  const legacy = ref.replace('bulletin-pack-v1', 'ipfs');
  assert.equal(parse(legacy)?.layout, 'unixfs-files-v1');
  for (const invalid of [
    ref + '/96/init.bin',
    ref + '?layout=old',
    ref.replace('pack-v1', 'pack-v2'),
    ref.replace('key-v3', 'key-v1'),
    ref.replace(v.root, 'Qm' + 'a'.repeat(44)),
    ref.replace(v.root, 'b' + 'a'.repeat(58))
  ])
    assert.equal(parse(invalid), null);
});
async function fixture(limited = false) {
  let active = true,
    wrongScope = false,
    conflicting = false,
    noKey = false;
  const calls: string[] = [],
    scopes: unknown[] = [];
  const reader = createMediaDeliveryReader({
    bulletinRpcUrl: 'https://bulletin.example',
    deriveKey: scope => {
      scopes.push(scope);
      return noKey ? null : Buffer.from(v.keyHex, 'hex');
    },
    fetchImpl: async (url, init) => {
      assert.equal(String(url), 'https://bulletin.example');
      const rpc = JSON.parse(String(init?.body));
      calls.push(rpc.method + ':' + rpc.params[0]);
      return Response.json({
        jsonrpc: '2.0',
        id: rpc.id,
        result: rpc.method === 'chain_getBlockHash' ? BULLETIN_MEDIA_GENESIS : '0x' + v.blocks[rpc.params[0]]
      });
    }
  });
  const app = Fastify();
  if (limited) await app.register(rateLimit);
  await app.register(
    createMediaRoutes({
      catalog: {
        getSnapshot: () => {
          const release = {
            active,
            encrypted: true,
            audioRef: ref,
            runtimeAddress: v.scope.runtimeAddress,
            hash: wrongScope ? '0x' + '44'.repeat(32) : v.scope.contentHash
          };
          return {
            chainId: v.scope.chainId,
            releases: [release, ...(conflicting ? [{ ...release, runtimeAddress: '0x' + '77'.repeat(20) }] : [])]
          } as CatalogSnapshot;
        }
      },
      reader
    })
  );
  return {
    app,
    reader,
    calls,
    scopes,
    setActive: (x: boolean) => (active = x),
    setWrongScope: () => (wrongScope = true),
    setConflicting: () => (conflicting = true),
    setNoKey: () => (noKey = true)
  };
}
it('serves authenticated compact ciphertext through its own catalog route, for every quality and later segment', async () => {
  const c = await fixture();
  try {
    const manifest = parseStreamingManifest(Buffer.from(v.manifestHex, 'hex'));
    const response = await c.app.inject(`/api/media/${v.root}/compact-v1/manifest.json`);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.rawPayload, Buffer.from(v.manifestHex, 'hex'));
    for (const rendition of manifest.renditions)
      for (const object of [rendition.init, ...rendition.segments]) {
        const response = await c.app.inject(`/api/media/${v.root}/compact-v1/${object.path}`);
        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['cache-control'], 'no-store');
        assert.deepEqual(decryptStreamingObject(response.rawPayload, Buffer.from(v.keyHex, 'hex'), manifest, object), Buffer.from(v.plain[object.path], 'hex'));
        assert.notDeepEqual(response.rawPayload, Buffer.from(v.plain[object.path], 'hex'));
      }
    assert(
      c.scopes.every(s => JSON.stringify(s) === JSON.stringify(v.scope)),
      'Derivation scope comes from the registered release, not HTTP query data'
    );
    const before = c.calls.length;
    c.setActive(false);
    assert.equal((await c.app.inject(`/api/media/${v.root}/compact-v1/96/init.bin`)).statusCode, 404);
    assert.equal(c.calls.length, before);
  } finally {
    await c.app.close();
  }
});
it('rejects mismatched format routes, offsets, archives and unknown identities before key derivation or RPC', async () => {
  const c = await fixture();
  try {
    for (const url of [
      `/api/media/${v.root}/stream/96/init.bin`,
      ...['archive/master.bin', '96/pack.bin', 'layout.json', '96/segment-256.bin', '96/init.bin?offset=1'].map(p => `/api/media/${v.root}/compact-v1/${p}`)
    ])
      assert.equal((await c.app.inject(url)).statusCode, 404);
    assert.equal((await c.app.inject({ url: `/api/media/${v.root}/compact-v1/96/init.bin`, headers: { range: 'bytes=0-15' } })).statusCode, 404);
    c.setConflicting();
    assert.equal((await c.app.inject(`/api/media/${v.root}/compact-v1/96/init.bin`)).statusCode, 404);
    assert.equal(c.calls.length, 0);
    assert.equal(c.scopes.length, 0);
  } finally {
    await c.app.close();
  }
});
it('fails closed on missing retained keys or wrong catalog scope without another provider', async () => {
  for (const missing of [false, true]) {
    const c = await fixture();
    try {
      if (missing) c.setNoKey();
      else c.setWrongScope();
      const response = await c.app.inject(`/api/media/${v.root}/compact-v1/96/segment-001.bin`);
      assert.equal(response.statusCode, 502);
      assert.equal(response.json().code, 'MEDIA_UNAVAILABLE');
      if (missing) assert.equal(c.calls.length, 0);
      const owner = new AbortController();
      owner.abort();
      await assert.rejects(c.reader.readCompact(`${v.root}/96/init.bin`, v.scope, owner.signal));
    } finally {
      await c.app.close();
    }
  }
});

it('shares one 240-request media limit across standard and compact routes', async () => {
  const c = await fixture(true);
  try {
    for (let index = 0; index < 240; index++) {
      const response = await c.app.inject(`/api/media/${v.root}/${index % 2 ? 'stream' : 'compact-v1'}/archive/master.bin`);
      assert.equal(response.statusCode, 404);
    }
    assert.equal((await c.app.inject(`/api/media/${v.root}/compact-v1/manifest.json`)).statusCode, 429);
    assert.equal(c.scopes.length, 0);
    assert.equal(c.calls.length, 0);
  } finally {
    await c.app.close();
  }
});
