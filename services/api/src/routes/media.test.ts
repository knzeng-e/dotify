import assert from 'node:assert/strict';
import { it } from 'node:test';
import { get } from 'node:http';
import Fastify from 'fastify';
import { createMediaRoutes } from './media.js';
import { createEncryptedMediaReader, encryptedMediaCid } from '../services/encryptedMedia.js';
import type { CatalogSnapshot } from '../services/catalog/types.js';
const cid = `Qm${'a'.repeat(44)}`,
  ref = `dotify:enc:v3:key-v2:ipfs://${cid}`,
  object = `${cid}/160/segment-000.bin`;
const bytes = () => new Response(new Uint8Array([1, 2, 3]));
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => (resolve = r));
  return { promise, resolve };
}
const turn = () => new Promise<void>(resolve => setImmediate(resolve));
it('accepts only explicit streaming refs and fixed playback object paths', async () => {
  assert.equal(encryptedMediaCid(ref), cid);
  for (const value of [`ipfs://${cid}`, `${ref}/archive/master.bin`, `dotify:enc:v2:key-v2:ipfs://${cid}`, `dotify:enc:v3:key-v1:ipfs://${cid}`])
    assert.equal(encryptedMediaCid(value), null);
  const reader = createEncryptedMediaReader(async () => {
    throw new Error('must not fetch');
  });
  for (const path of [cid, `${cid}/archive/master.bin`, `${cid}/160/segment-256.bin`, `${cid}/manifest.json?url=http://localhost`, 'http://localhost'])
    await assert.rejects(reader.read(path));
});
it('coalesces complete ciphertext objects and keeps an independent subscriber alive on cancellation', async () => {
  const started = deferred<void>(),
    finish = deferred<Response>();
  let calls = 0;
  const reader = createEncryptedMediaReader(async () => {
    calls++;
    started.resolve();
    return finish.promise.then(response => response.clone());
  });
  const abort = new AbortController();
  const first = reader.read(object, abort.signal),
    second = reader.read(object);
  const cancelled = assert.rejects(first, { name: 'AbortError' });
  await started.promise;
  abort.abort();
  await cancelled;
  finish.resolve(bytes());
  assert.deepEqual([...(await second).bytes], [1, 2, 3]);
  assert.deepEqual([...(await reader.read(object)).bytes], [1, 2, 3]);
  assert.equal(calls, 1);
});
it('aborts transport when its last subscriber leaves, without caching abandoned data', async () => {
  const started = deferred<void>();
  let calls = 0,
    aborted = false;
  const reader = createEncryptedMediaReader(async (_url, init) => {
    if (++calls > 1) return bytes();
    return new Promise<Response>((_r, reject) => {
      init!.signal!.addEventListener(
        'abort',
        () => {
          aborted = true;
          reject(init!.signal!.reason);
        },
        { once: true }
      );
      started.resolve();
    });
  });
  const abort = new AbortController(),
    pending = reader.read(object, abort.signal);
  const cancelled = assert.rejects(pending, { name: 'AbortError' });
  await started.promise;
  abort.abort();
  await cancelled;
  await turn();
  assert(aborted);
  assert.deepEqual([...(await reader.read(object)).bytes], [1, 2, 3]);
  assert.equal(calls, 2);
});
it('retries a failed or truncated body through another gateway and never sends ranges', async () => {
  let calls = 0;
  const reader = createEncryptedMediaReader(async (_url, init) => {
    assert.equal(init?.headers, undefined);
    if (++calls === 1) return new Response(new Uint8Array([1]), { headers: { 'content-length': '3' } });
    if (calls === 2)
      return new Response(
        new ReadableStream({
          start(c) {
            c.error(new Error('broken transport'));
          }
        })
      );
    return bytes();
  });
  assert.deepEqual([...(await reader.read(object)).bytes], [1, 2, 3]);
  assert.equal(calls, 3);
});
it('bounds manifest/segment bytes and refuses partial HTTP responses', async () => {
  for (const response of [
    () => new Response(new Uint8Array([1]), { status: 206 }),
    () => new Response(new Uint8Array([1]), { headers: { 'content-length': '10000000' } }),
    () => new Response(new Uint8Array(256 * 1024 + 1))
  ]) {
    const reader = createEncryptedMediaReader(async () => response());
    await assert.rejects(reader.read(`${cid}/manifest.json`));
  }
});
it('permits reviewed HTTPS gateway redirects only', async () => {
  for (const location of ['http://127.0.0.1/secret', 'https://user:pass@ipfs.io/ipfs/x', 'https://evil.example/x']) {
    let calls = 0;
    const reader = createEncryptedMediaReader(async () => {
      calls++;
      return new Response(null, { status: 302, headers: { location } });
    });
    await assert.rejects(reader.read(object));
    assert.equal(calls, 3);
  }
  let calls = 0;
  const reader = createEncryptedMediaReader(async () =>
    ++calls === 1 ? new Response(null, { status: 302, headers: { location: `https://ipfs.io/ipfs/${object}` } }) : bytes()
  );
  assert.deepEqual([...(await reader.read(object)).bytes], [1, 2, 3]);
});
it('bounds concurrent cold reads and prevents cache repopulation after clear', async () => {
  const finish = deferred<Response>();
  let calls = 0;
  const reader = createEncryptedMediaReader(async () => {
    calls++;
    return finish.promise.then(response => response.clone());
  });
  const a = reader.read(object),
    b = reader.read(`${cid}/160/init.bin`);
  await turn();
  await assert.rejects(reader.read(`${cid}/manifest.json`), /busy/i);
  reader.clear();
  finish.resolve(bytes());
  await Promise.all([a, b]);
  await reader.read(object);
  assert.equal(calls, 3);
});
it('rechecks active catalog authority even for cached ciphertext and rejects archives, query and range requests', async () => {
  let active = true,
    encrypted = true,
    calls = 0;
  const reader = createEncryptedMediaReader(async () => {
    calls++;
    return bytes();
  });
  const app = Fastify();
  const catalog = { getSnapshot: () => ({ releases: [{ active, encrypted, audioRef: ref }] }) as CatalogSnapshot };
  await app.register(createMediaRoutes({ catalog, reader }));
  const url = `/api/media/${cid}/stream/160/init.bin`;
  try {
    const result = await app.inject(url);
    assert.equal(result.statusCode, 200);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.deepEqual([...result.rawPayload], [1, 2, 3]);
    for (const suffix of ['archive/master.bin', '160/segment-256.bin', 'manifest.json?source=http://localhost'])
      assert.equal((await app.inject(`/api/media/${cid}/stream/${suffix}`)).statusCode, 404);
    assert.equal((await app.inject(`/api/media/${cid}`)).statusCode, 404);
    assert.equal((await app.inject({ url, headers: { range: 'bytes=0-2' } })).statusCode, 404);
    active = false;
    assert.equal((await app.inject(url)).statusCode, 404);
    active = true;
    encrypted = false;
    assert.equal((await app.inject(url)).statusCode, 404);
    assert.equal(calls, 1);
  } finally {
    await app.close();
  }
});
it('propagates a real HTTP disconnect and accepts a fresh client afterwards', { timeout: 5000 }, async () => {
  const started = deferred<void>(),
    aborted = deferred<void>();
  let calls = 0;
  const reader = createEncryptedMediaReader(async (_url, init) => {
    if (++calls > 1) return bytes();
    return new Promise<Response>((_r, reject) => {
      init!.signal!.addEventListener(
        'abort',
        () => {
          aborted.resolve();
          reject(init!.signal!.reason);
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
  const url = `/api/media/${cid}/stream/160/init.bin`;
  const client = get(`${address}${url}`);
  client.on('error', () => {});
  try {
    await started.promise;
    client.destroy();
    await aborted.promise;
    await turn();
    assert.equal((await app.inject(url)).statusCode, 200);
    assert.equal(calls, 2);
  } finally {
    client.destroy();
    await app.close();
  }
});
it('prefers the dedicated gateway and keeps public recovery without forwarding ranges or credentials', async () => {
  const urls: string[] = [];
  const reader = createEncryptedMediaReader(async (url, init) => {
    urls.push(String(url));
    assert.equal(init?.headers, undefined);
    assert.equal(init?.redirect, 'manual');
    return urls.length === 1 ? new Response(null, { status: 401 }) : bytes();
  }, 'https://owned.mypinata.cloud');
  assert.deepEqual([...(await reader.read(object)).bytes], [1, 2, 3]);
  assert.equal(urls[0], `https://owned.mypinata.cloud/ipfs/${object}`);
  assert.equal(urls[1], `https://gateway.pinata.cloud/ipfs/${object}`);
});
