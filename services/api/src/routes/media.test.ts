import assert from 'node:assert/strict';
import { it } from 'node:test';
import { get } from 'node:http';
import Fastify from 'fastify';
import { createMediaRoutes } from './media.js';
import { createEncryptedMediaReader, encryptedMediaCid, parseMediaRange } from '../services/encryptedMedia.js';
import type { CatalogSnapshot } from '../services/catalog/types.js';

const cid = `Qm${'a'.repeat(44)}`;
const ref = `dotify:enc:v2:key-v2:ipfs://${cid}`;
const ranged = () => new Response(new Uint8Array([1, 2, 3]), { status: 206, headers: { 'content-range': 'bytes 10-12/30' } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
const nextTurn = () => new Promise<void>(resolve => setImmediate(resolve));

it('accepts only canonical ciphertext refs and bounded single ranges', () => {
  assert.equal(encryptedMediaCid(ref), cid);
  for (const value of [`ipfs://${cid}`, `${ref}/other`, `${ref}?token=secret`, 'https://private.local/audio']) assert.equal(encryptedMediaCid(value), null);
  for (const value of ['bytes=0-', 'bytes=-10', 'bytes=0-2,4-6', 'bytes=9-2', 'bytes=0-99999999']) assert.throws(() => parseMediaRange(value));
  assert.deepEqual(parseMediaRange('bytes=10-12'), { start: 10, end: 12 });
});

it('switches gateways after a broken range and reuses validated encrypted bytes', async () => {
  const calls: string[] = [];
  const reader = createEncryptedMediaReader(async url => {
    calls.push(String(url));
    return calls.length === 1 ? new Response('not found', { status: 404 }) : ranged();
  });
  const first = await reader.read(cid, { start: 10, end: 12 });
  assert.deepEqual([...first.bytes], [1, 2, 3]);
  assert.equal(first.total, 30);
  assert.equal(await reader.read(cid, { start: 10, end: 12 }), first);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].startsWith('https://ipfs.io/ipfs/'));
});

it('still switches gateways after an upstream abort while its consumer is active', async () => {
  let calls = 0;
  const reader = createEncryptedMediaReader(async () => {
    calls++;
    if (calls === 1) throw new DOMException('Upstream timed out', 'AbortError');
    return ranged();
  });
  const consumer = new AbortController();
  assert.deepEqual([...(await reader.read(cid, { start: 10, end: 12 }, false, consumer.signal)).bytes], [1, 2, 3]);
  assert.equal(consumer.signal.aborted, false);
  assert.equal(calls, 2);
});

it('rejects truncated and mismatched ranges, even with a successful status', async () => {
  let calls = 0;
  const reader = createEncryptedMediaReader(async () => {
    calls++;
    return calls === 1
      ? new Response(new Uint8Array([1]), { status: 206, headers: { 'content-range': 'bytes 10-12/30' } })
      : calls === 2
        ? new Response(new Uint8Array([1, 2, 3]), { status: 206, headers: { 'content-range': 'bytes 11-13/30' } })
        : ranged();
  });
  assert.deepEqual([...(await reader.read(cid, { start: 10, end: 12 })).bytes], [1, 2, 3]);
  assert.equal(calls, 3);
});

it('allows bounded public gateway subdomain redirects but never follows a private or credential-bearing URL', async () => {
  const calls: string[] = [];
  const reader = createEncryptedMediaReader(async url => {
    calls.push(String(url));
    if (calls.length === 1) return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/internal' } });
    if (calls.length === 2) return new Response(null, { status: 302, headers: { location: `https://bafysafe.ipfs.dweb.link/` } });
    return ranged();
  });
  await reader.read(cid, { start: 10, end: 12 });
  assert.equal(calls.length, 3);
  assert.equal(calls[2], 'https://bafysafe.ipfs.dweb.link/');
  assert.ok(!calls.some(url => url.includes('127.0.0.1')));
  const credentialUrls: string[] = [];
  const denied = createEncryptedMediaReader(async url => {
    credentialUrls.push(String(url));
    return new Response(null, { status: 302, headers: { location: 'https://token:secret@ipfs.io/private' } });
  });
  await assert.rejects(denied.read(cid, null), { statusCode: 502 });
  assert.equal(credentialUrls.length, 3);
  assert.ok(credentialUrls.every(url => !url.includes('secret')));
});

it('never caches a malformed complete DAV2 container or an oversized declared body', async () => {
  let calls = 0;
  const reader = createEncryptedMediaReader(async () => {
    calls++;
    return new Response('truncated DAV2');
  });
  await assert.rejects(reader.read(cid, null, true), { statusCode: 502 });
  await assert.rejects(reader.read(cid, null, true), { statusCode: 502 });
  assert.equal(calls, 6);
  const oversized = createEncryptedMediaReader(async () => new Response('small body', { headers: { 'content-length': String(65 * 1024 * 1024) } }));
  await assert.rejects(oversized.read(cid, null), { statusCode: 502 });
  const oversizedHeader = Buffer.alloc(65 * 1024 + 8, 32);
  oversizedHeader.write('DAV2', 0);
  oversizedHeader.writeUInt32BE(65 * 1024, 4);
  const largeTable = createEncryptedMediaReader(async () => new Response(oversizedHeader));
  await assert.rejects(largeTable.read(cid, null, true), { statusCode: 502 });
});

it('coalesces the same range and bounds independent cold downloads to two', async () => {
  const releases: ((response: Response) => void)[] = [];
  let calls = 0;
  const reader = createEncryptedMediaReader(() => {
    calls++;
    return new Promise<Response>(resolve => {
      releases.push(resolve);
    });
  });
  const first = reader.read(cid, { start: 10, end: 12 });
  const shared = reader.read(cid, { start: 10, end: 12 });
  const second = reader.read('other', { start: 10, end: 12 });
  await assert.rejects(reader.read('third', null), { statusCode: 503 });
  assert.equal(calls, 2);
  releases.forEach(release => release(ranged()));
  const [a, b] = await Promise.all([first, shared, second]);
  assert.equal(a, b);
});

it('serves full ciphertext and reuses it for ranges without another download', async () => {
  let calls = 0;
  const reader = createEncryptedMediaReader(async () => {
    calls++;
    return new Response(new Uint8Array([1, 2, 3, 4]));
  });
  await reader.read(cid, null);
  const range = await reader.read(cid, { start: 2, end: 6 });
  assert.deepEqual([...range.bytes], [3, 4]);
  assert.equal(range.total, 4);
  assert.equal(calls, 1);
  reader.clear();
  await reader.read(cid, null);
  assert.equal(calls, 2);
});

it('reserves space for one cold full object while allowing a concurrent range', async () => {
  let finishFull!: (response: Response) => void;
  const reader = createEncryptedMediaReader(async (_url, init) => {
    if (init?.headers && 'Range' in init.headers) return ranged();
    return new Promise<Response>(resolve => {
      finishFull = resolve;
    });
  });
  const full = reader.read(cid, null);
  await assert.rejects(reader.read('another-full-object', null), { statusCode: 503 });
  assert.deepEqual([...(await reader.read('range-object', { start: 10, end: 12 })).bytes], [1, 2, 3]);
  finishFull(new Response(new Uint8Array([1, 2, 3, 4])));
  await full;
  // The reservation is released after the first body settles.
  const next = reader.read('another-full-object', null);
  await nextTurn();
  finishFull(new Response(new Uint8Array([5])));
  assert.deepEqual([...(await next).bytes], [5]);
});

it('does not start an already-cancelled read', async () => {
  let calls = 0;
  const reader = createEncryptedMediaReader(async () => {
    calls++;
    return ranged();
  });
  await assert.rejects(reader.read(cid, { start: 10, end: 12 }, false, AbortSignal.abort()), { name: 'AbortError' });
  assert.equal(calls, 0);
  const consumer = new AbortController();
  const cancelled = assert.rejects(reader.read(cid, { start: 10, end: 12 }, false, consumer.signal), { name: 'AbortError' });
  consumer.abort();
  await cancelled;
  await nextTurn();
  assert.equal(calls, 0);
  await reader.read(cid, { start: 10, end: 12 });
  assert.equal(calls, 1);
});

it('releases both cold slots and body reservations when their consumers leave without trying another gateway', { timeout: 3000 }, async () => {
  const started = deferred<void>();
  let calls = 0;
  let aborted = 0;
  const reader = createEncryptedMediaReader(async (_url, init) => {
    calls++;
    if (calls > 2) return new Response(new Uint8Array([4]));
    const signal = init!.signal!;
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          aborted++;
          reject(signal.reason);
        },
        { once: true }
      );
      if (calls === 2) started.resolve();
    });
  });
  const a = new AbortController();
  const b = new AbortController();
  const first = assert.rejects(reader.read(cid, { start: 10, end: 12 }, false, a.signal), { name: 'AbortError' });
  const second = assert.rejects(reader.read('other', { start: 10, end: 12 }, false, b.signal), { name: 'AbortError' });
  await started.promise;
  a.abort();
  b.abort();
  await Promise.all([first, second]);
  await nextTurn();
  assert.equal(aborted, 2);
  assert.equal(calls, 2);
  // A leaked pair of range reservations would also refuse this full object.
  assert.deepEqual([...(await reader.read('new-full-object', null)).bytes], [4]);
  assert.equal(calls, 3);
});

it('keeps a coalesced download for its remaining consumer and caches only its completed result', { timeout: 3000 }, async () => {
  const started = deferred<AbortSignal>();
  const response = deferred<Response>();
  let calls = 0;
  const reader = createEncryptedMediaReader(async (_url, init) => {
    calls++;
    started.resolve(init!.signal!);
    return response.promise;
  });
  const a = new AbortController();
  const first = assert.rejects(reader.read(cid, { start: 10, end: 12 }, false, a.signal), { name: 'AbortError' });
  const second = reader.read(cid, { start: 10, end: 12 });
  const upstream = await started.promise;
  a.abort();
  await first;
  assert.equal(upstream.aborted, false);
  assert.equal(calls, 1);
  response.resolve(ranged());
  const result = await second;
  assert.deepEqual([...result.bytes], [1, 2, 3]);
  assert.equal(await reader.read(cid, { start: 10, end: 12 }), result);
  assert.equal(calls, 1);
});

it('cancels a shared read after its last consumer leaves and lets a new consumer start afresh', { timeout: 3000 }, async () => {
  const started = deferred<AbortSignal>();
  const replacement = deferred<Response>();
  let calls = 0;
  const reader = createEncryptedMediaReader(async (_url, init) => {
    calls++;
    if (calls > 1) return replacement.promise;
    const signal = init!.signal!;
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      started.resolve(signal);
    });
  });
  const a = new AbortController();
  const b = new AbortController();
  const first = assert.rejects(reader.read(cid, { start: 10, end: 12 }, false, a.signal), { name: 'AbortError' });
  const second = assert.rejects(reader.read(cid, { start: 10, end: 12 }, false, b.signal), { name: 'AbortError' });
  const upstream = await started.promise;
  a.abort();
  await first;
  assert.equal(upstream.aborted, false);
  b.abort();
  // The abandoned entry must already be detached even before its finally runs.
  const fresh = reader.read(cid, { start: 10, end: 12 });
  await second;
  assert.equal(upstream.aborted, true);
  await nextTurn();
  // Cleanup of the old read must not remove the replacement's pending entry.
  const sharedFresh = reader.read(cid, { start: 10, end: 12 });
  replacement.resolve(ranged());
  const result = await fresh;
  assert.deepEqual([...result.bytes], [1, 2, 3]);
  assert.equal(await sharedFresh, result);
  assert.equal(calls, 2);
});

it('cancels an in-progress body and never caches its partial bytes', { timeout: 3000 }, async () => {
  const reading = deferred<void>();
  const abort = new AbortController();
  let calls = 0;
  const reader = createEncryptedMediaReader(async (_url, init) => {
    calls++;
    if (calls > 1) return ranged();
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          init!.signal!.addEventListener('abort', () => controller.error(init!.signal!.reason), { once: true });
          controller.enqueue(new Uint8Array([1]));
        },
        pull() {
          reading.resolve();
        }
      }),
      { status: 206, headers: { 'content-range': 'bytes 10-12/30' } }
    );
  });
  const cancelled = assert.rejects(reader.read(cid, { start: 10, end: 12 }, false, abort.signal), { name: 'AbortError' });
  await reading.promise;
  abort.abort();
  await cancelled;
  await nextTurn();
  assert.equal(calls, 1);
  assert.deepEqual([...(await reader.read(cid, { start: 10, end: 12 })).bytes], [1, 2, 3]);
  assert.equal(calls, 2);
});

it('propagates a real HTTP disconnect to the upstream read and accepts a fresh client afterwards', { timeout: 5000 }, async () => {
  const started = deferred<void>();
  const aborted = deferred<void>();
  let calls = 0;
  const reader = createEncryptedMediaReader(async (_url, init) => {
    calls++;
    if (calls > 1) return ranged();
    const signal = init!.signal!;
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          aborted.resolve();
          reject(signal.reason);
        },
        { once: true }
      );
      started.resolve();
    });
  });
  const app = Fastify();
  await app.register(
    createMediaRoutes({ catalog: { getSnapshot: () => ({ releases: [{ active: true, encrypted: true, audioRef: ref }] }) as CatalogSnapshot }, reader })
  );
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const client = get(`${address}/api/media/${cid}`, { headers: { range: 'bytes=10-12' } });
  client.on('error', () => {
    /* Expected when the browser abandons its request. */
  });
  try {
    await started.promise;
    client.destroy();
    await aborted.promise;
    await nextTurn();
    const next = await app.inject({ url: `/api/media/${cid}`, headers: { range: 'bytes=10-12' } });
    assert.equal(next.statusCode, 206);
    assert.deepEqual([...next.rawPayload], [1, 2, 3]);
    assert.equal(calls, 2);
  } finally {
    client.destroy();
    await app.close();
  }
});

it('only serves current active encrypted catalog assets and never accepts a caller URL/query', async () => {
  let active = true;
  let encrypted = true;
  let calls = 0;
  const reader = createEncryptedMediaReader(async () => {
    calls++;
    return ranged();
  });
  const app = Fastify();
  await app.register(createMediaRoutes({ catalog: { getSnapshot: () => ({ releases: [{ active, encrypted, audioRef: ref }] }) as CatalogSnapshot }, reader }));
  try {
    const response = await app.inject({ url: `/api/media/${cid}`, headers: { range: 'bytes=10-12' } });
    assert.equal(response.statusCode, 206);
    assert.equal(response.headers['content-range'], 'bytes 10-12/30');
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual([...response.rawPayload], [1, 2, 3]);
    assert.equal((await app.inject({ url: `/api/media/${cid}?url=http://localhost` })).statusCode, 404);
    assert.equal((await app.inject({ url: '/api/media/unknown' })).statusCode, 404);
    assert.equal((await app.inject({ url: `/api/media/${cid}`, headers: { range: 'bytes=0-' } })).statusCode, 416);
    active = false;
    assert.equal((await app.inject({ url: `/api/media/${cid}`, headers: { range: 'bytes=10-12' } })).statusCode, 404);
    active = true;
    encrypted = false;
    assert.equal((await app.inject({ url: `/api/media/${cid}` })).statusCode, 404);
    assert.equal(calls, 1);
  } finally {
    await app.close();
  }
});
