import assert from 'node:assert/strict';
import { it } from 'node:test';
import { blake2b } from '@noble/hashes/blake2';
import { CID } from 'multiformats/cid';
import { create as digest } from 'multiformats/hashes/digest';
import * as dagPB from '@ipld/dag-pb';
import { UnixFS } from 'ipfs-unixfs';
import Fastify from 'fastify';
import { createMediaDeliveryReader } from './mediaDelivery.js';
import { BULLETIN_MEDIA_GENESIS, createBulletinHttpBlockReader, validBulletinMediaRpc } from './bulletinHttpReader.js';
import { createMediaRoutes } from '../routes/media.js';
import type { CatalogSnapshot } from './catalog/types.js';

const endpoint = 'https://bulletin.example:8443';
const signal = () => new AbortController().signal;
function fixture() {
  const blocks = new Map<string, Uint8Array>();
  const ciphertext = new Uint8Array([11, 42, 53, 64]);
  const add = (code: number, bytes: Uint8Array) => {
    const cid = CID.createV1(code, digest(0xb220, blake2b(bytes, { dkLen: 32 })));
    blocks.set(cid.toString(), bytes);
    return cid;
  };
  const raw = add(0x55, ciphertext);
  const dir = (name: string, child: CID) => {
    const bytes: unknown = dagPB.encode({ Data: new UnixFS({ type: 'directory' }).marshal(), Links: [{ Name: name, Hash: child }] });
    assert.ok(bytes instanceof Uint8Array);
    return add(0x70, bytes);
  };
  const root = dir('160', dir('segment-000.bin', raw)).toString();
  const calls: Array<{ method: string; params: unknown[] }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    assert.equal(url, endpoint);
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.method, 'POST');
    assert.deepEqual(init.headers, { 'content-type': 'application/json' });
    const request = JSON.parse(String(init.body));
    assert.deepEqual(Object.keys(request).sort(), ['id', 'jsonrpc', 'method', 'params']);
    calls.push({ method: request.method, params: request.params });
    assert.ok(['chain_getBlockHash', 'bitswap_v1_get'].includes(request.method));
    const result = request.method === 'chain_getBlockHash' ? BULLETIN_MEDIA_GENESIS : `0x${Buffer.from(blocks.get(request.params[0])!).toString('hex')}`;
    return Response.json({ jsonrpc: '2.0', id: 1, result });
  };
  return { blocks, raw, root, ciphertext, calls, fetchImpl, reader: createMediaDeliveryReader({ bulletinRpcUrl: endpoint, fetchImpl }) };
}

it('delivers only selected Bulletin ciphertext through the existing catalog route', async () => {
  const c = fixture();
  let active = true;
  const app = Fastify();
  const audioRef = `dotify:enc:v3:key-v2:ipfs://${c.root}`;
  await app.register(
    createMediaRoutes({
      catalog: { getSnapshot: () => ({ releases: [{ active, encrypted: true, audioRef }] }) as CatalogSnapshot },
      reader: c.reader
    })
  );
  try {
    const url = `/api/media/${c.root}/stream/160/segment-000.bin`;
    const response = await app.inject(url);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(response.rawPayload, Buffer.from(c.ciphertext));
    assert.equal(c.calls.filter(call => call.method === 'chain_getBlockHash').length, 1);
    assert.equal(c.calls.filter(call => call.method === 'bitswap_v1_get').length, 3);
    const readCount = c.calls.length;
    for (const path of ['archive/master.bin', '160/segment-256.bin', 'manifest.json?url=https://other.example'])
      assert.equal((await app.inject(`/api/media/${c.root}/stream/${path}`)).statusCode, 404);
    assert.equal((await app.inject({ url, headers: { range: 'bytes=0-2' } })).statusCode, 404);
    active = false;
    assert.equal((await app.inject(url)).statusCode, 404);
    active = true;
    assert.equal((await app.inject(url.replace(c.root, c.raw.toString()))).statusCode, 404);
    assert.equal(c.calls.length, readCount, 'Rejected requests must not issue raw RPC reads');
  } finally {
    await app.close();
  }
});

it('never sends Bulletin roots to Pinata when the server reader is not configured', async () => {
  const c = fixture();
  let calls = 0;
  const reader = createMediaDeliveryReader({
    fetchImpl: async () => {
      calls++;
      throw new Error('No gateway expected');
    }
  });
  await assert.rejects(reader.read(`${c.root}/160/segment-000.bin`), { statusCode: 502, code: 'MEDIA_UNAVAILABLE' });
  assert.equal(calls, 0);
  const pinataCalls: string[] = [];
  const existing = createMediaDeliveryReader({
    dedicatedGateway: 'https://owned.mypinata.cloud',
    fetchImpl: async url => {
      pinataCalls.push(String(url));
      return new Response(c.ciphertext);
    }
  });
  const object = `Qm${'a'.repeat(44)}/160/init.bin`;
  assert.deepEqual((await existing.read(object)).bytes, Buffer.from(c.ciphertext));
  assert.deepEqual(pinataCalls, [`https://owned.mypinata.cloud/ipfs/${object}`]);
});

it('reuses verified ciphertext blocks briefly and clears them with the reader', async () => {
  const c = fixture();
  const object = `${c.root}/160/segment-000.bin`;
  await c.reader.read(object);
  const calls = c.calls.length;
  await c.reader.read(object);
  assert.equal(c.calls.length, calls);
  c.reader.clear();
  await c.reader.read(object);
  assert.equal(c.calls.length, calls * 2);
});

it('checks the pinned genesis before raw reads and refuses corrupt or malformed responses', async () => {
  const c = fixture();
  let rawReads = 0;
  const wrongNetwork = createBulletinHttpBlockReader(endpoint, async (_url, init) => {
    if (JSON.parse(String(init?.body)).method === 'bitswap_v1_get') rawReads++;
    return Response.json({ jsonrpc: '2.0', id: 1, result: `0x${'00'.repeat(32)}` });
  });
  await assert.rejects(wrongNetwork(c.raw.toString(), signal()), /Wrong Bulletin/);
  assert.equal(rawReads, 0);
  for (const payload of [
    { jsonrpc: '2.0', id: 2, result: '0x01' },
    { jsonrpc: '2.0', id: 1, error: { message: 'unavailable' } },
    { jsonrpc: '2.0', id: 1, result: '0x0' },
    { jsonrpc: '2.0', id: 1, result: '0x01' },
    [{ jsonrpc: '2.0', id: 1, result: '0x01' }]
  ]) {
    const reader = createBulletinHttpBlockReader(endpoint, async (url, init) => {
      if (JSON.parse(String(init?.body)).method === 'chain_getBlockHash') return c.fetchImpl(url, init);
      return Response.json(payload);
    });
    await assert.rejects(reader(c.raw.toString(), signal()));
  }
});

it('bounds streamed and declared RPC response bytes, rejects partial responses and propagates cancellation', async () => {
  const c = fixture();
  for (const response of [
    () => new Response('x', { status: 206 }),
    () => new Response('x', { headers: { 'content-length': '2000000' } }),
    () => new Response(new Uint8Array(2_000_000))
  ])
    await assert.rejects(createBulletinHttpBlockReader(endpoint, async () => response())(c.raw.toString(), signal()));
  const abort = new AbortController();
  let upstreamAborted = false;
  const reader = createMediaDeliveryReader({
    bulletinRpcUrl: endpoint,
    fetchImpl: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener(
          'abort',
          () => {
            upstreamAborted = true;
            reject(init!.signal!.reason);
          },
          { once: true }
        );
        queueMicrotask(() => abort.abort());
      })
  });
  await assert.rejects(reader.read(`${c.root}/160/segment-000.bin`, abort.signal), { name: 'AbortError' });
  assert.ok(upstreamAborted);
});

it('admits only an operator-configured credential-free public HTTPS RPC origin', () => {
  assert.ok(validBulletinMediaRpc(endpoint));
  for (const value of [
    'http://bulletin.example',
    'https://user:secret@bulletin.example',
    'https://bulletin.example?token=secret',
    'https://bulletin.example/rpc',
    'https://localhost',
    'https://bulletin.local',
    'https://127.0.0.1',
    'https://[::1]'
  ]) {
    assert.equal(validBulletinMediaRpc(value), false);
    assert.throws(() => createBulletinHttpBlockReader(value));
  }
});
