// Loopback-only Playwright fixture. No application startup, live RPC or signer.
// It uses the real catalogue media route, HTTP reader and compact range engine.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createMediaRoutes } from '../routes/media.js';
import { createMediaDeliveryReader } from '../services/mediaDelivery.js';
import { BULLETIN_MEDIA_GENESIS } from '../services/bulletinHttpReader.js';
import type { CatalogSnapshot } from '../services/catalog/types.js';
import type { BulletinCodecFixture } from './bulletinCodecTypes.test.js';

const file = process.argv[2];
assert.ok(file, 'Explicit synthetic fixture required');
const fixture: BulletinCodecFixture = JSON.parse(await readFile(file, 'utf8'));
assert.equal(fixture.schema, 'dotify.synthetic-bulletin-codec.v1');
assert.equal(fixture.keyHex, Buffer.alloc(32, 71).toString('hex'), 'Public synthetic key only');
const app = Fastify();
await app.register(cors, { origin: ['http://127.0.0.1:5293', 'http://127.0.0.1:5295'] });
let reader: ReturnType<typeof createMediaDeliveryReader>;
const calls: string[] = [];
const objects: string[] = [];
let blockBytes = 0;
const makeReader = () =>
  createMediaDeliveryReader({
    bulletinRpcUrl: 'https://fixture.invalid',
    deriveKey: scope => {
      assert.deepEqual(scope, fixture.scope, 'Catalogue scope changed');
      return Buffer.from(fixture.keyHex, 'hex');
    },
    fetchImpl: async (url, init) => {
      assert.equal(String(url), 'https://fixture.invalid', 'External traffic forbidden');
      const rpc = JSON.parse(String(init?.body));
      if (rpc.method === 'chain_getBlockHash') return Response.json({ jsonrpc: '2.0', id: rpc.id, result: BULLETIN_MEDIA_GENESIS });
      assert.equal(rpc.method, 'bitswap_v1_get');
      const cid = rpc.params[0];
      calls.push(cid);
      const value = fixture.blocks[cid];
      if (value) blockBytes += Buffer.from(value, 'base64').length;
      return Response.json({ jsonrpc: '2.0', id: rpc.id, result: value ? '0x' + Buffer.from(value, 'base64').toString('hex') : null });
    }
  });
reader = makeReader();
const media = {
  read: (...args: Parameters<typeof reader.read>) => reader.read(...args),
  readCompact: (...args: Parameters<typeof reader.readCompact>) => reader.readCompact(...args),
  clear: () => reader.clear()
};
await app.register(
  createMediaRoutes({
    catalog: {
      getSnapshot: () =>
        ({
          chainId: fixture.scope.chainId,
          releases: Object.values(fixture.graphs).map(graph => ({
            active: true,
            encrypted: true,
            audioRef: graph.ref,
            runtimeAddress: fixture.scope.runtimeAddress,
            hash: fixture.scope.contentHash
          }))
        }) as CatalogSnapshot
    },
    reader: media
  })
);
app.addHook('onRequest', async request => {
  if (request.url.startsWith('/api/media/')) objects.push(request.url);
});
app.get('/health', async () => ({ fixture: fixture.schema }));
app.get('/stats', async () => ({ calls, objects, blockBytes }));
// Recreate the in-memory transport/cache to exercise a cold restart, never a
// reset of real publication state. Tests run serially and wait for prior I/O.
app.post('/reset', async () => {
  reader.clear();
  reader = makeReader();
  calls.length = 0;
  objects.length = 0;
  blockBytes = 0;
  return { reset: true };
});
await app.listen({ host: '127.0.0.1', port: 5294 });
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => void app.close().then(() => process.exit(0)));
