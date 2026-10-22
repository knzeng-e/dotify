import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createMediaPrewarmer } from './mediaPrewarm.js';
import type { CatalogSnapshot } from './catalog/types.js';
const cid = `Qm${'a'.repeat(44)}`;
const snapshot = (overrides = {}) =>
  ({ releases: [{ active: true, encrypted: true, audioRef: `dotify:enc:v3:key-v2:ipfs://${cid}`, ...overrides }] }) as CatalogSnapshot;
const turn = () => new Promise(resolve => setTimeout(resolve, 20));
it('warms only immutable playback start objects after observing a published v3 release and deduplicates revisions', async () => {
  const urls: string[] = [];
  const prewarm = createMediaPrewarmer('https://media.example', async (url, options) => {
    assert.equal(options?.credentials, 'omit');
    assert.equal(options?.redirect, 'error');
    assert.equal(options?.headers, undefined);
    urls.push(String(url));
    return new Response(new Uint8Array([1]));
  });
  prewarm.observe(snapshot());
  await turn();
  prewarm.observe(snapshot());
  await turn();
  assert.equal(urls.length, 7);
  assert.deepEqual(
    urls.map(url => url.split(cid + '/')[1]),
    ['manifest.json', '96/init.bin', '96/segment-000.bin', '160/init.bin', '160/segment-000.bin', '320/init.bin', '320/segment-000.bin']
  );
  assert(urls.every(url => !url.includes('?') && !url.includes('archive')));
  prewarm.close();
});
it('does not warm inactive, unencrypted, old formats or failed requests indefinitely', async () => {
  let calls = 0;
  const prewarm = createMediaPrewarmer('https://media.example', async () => {
    calls++;
    throw new Error('offline');
  });
  for (const overrides of [
    { active: false },
    { encrypted: false },
    { audioRef: `dotify:enc:v2:key-v2:ipfs://${cid}` },
    { audioRef: 'https://untrusted.example' }
  ])
    prewarm.observe(snapshot(overrides));
  await turn();
  assert.equal(calls, 0);
  prewarm.observe(snapshot());
  await turn();
  prewarm.observe(snapshot());
  await turn();
  assert.equal(calls, 1);
  prewarm.close();
  prewarm.observe(snapshot());
  await turn();
  assert.equal(calls, 1);
});
it('bounds admission, concurrent requests and aborts pending work on shutdown', async () => {
  let calls = 0,
    aborted = 0;
  const prewarm = createMediaPrewarmer('https://media.example', async (_url, options) => {
    calls++;
    return new Promise((_resolve, reject) =>
      options!.signal!.addEventListener(
        'abort',
        () => {
          aborted++;
          reject(new Error('closed'));
        },
        { once: true }
      )
    );
  });
  prewarm.observe({
    releases: Array.from({ length: 30 }, (_, i) => ({
      active: true,
      encrypted: true,
      audioRef: `dotify:enc:v3:key-v2:ipfs://Qm${String.fromCharCode(97 + (i % 20)).repeat(43)}${i < 20 ? 'a' : 'b'}`
    }))
  } as CatalogSnapshot);
  await turn();
  assert.equal(calls, 2);
  prewarm.close();
  await turn();
  assert.equal(aborted, 2);
  assert.equal(calls, 2);
});
it('never retains or retries an error body as a warmed object', async () => {
  let cancelled = 0,
    calls = 0;
  const prewarm = createMediaPrewarmer('https://media.example', async () => {
    calls++;
    return new Response(
      new ReadableStream({
        cancel() {
          cancelled++;
        }
      }),
      { status: 401 }
    );
  });
  prewarm.observe(snapshot());
  await turn();
  prewarm.close();
  assert.equal(calls, 1);
  assert.equal(cancelled, 1);
});

it('retries a propagation failure only on later observations with bounded backoff and attempts', async () => {
  let clock = 0,
    calls = 0;
  const prewarm = createMediaPrewarmer(
    'https://media.example',
    async () => {
      calls++;
      throw new Error('offline');
    },
    () => clock
  );
  prewarm.observe(snapshot());
  await turn();
  prewarm.observe(snapshot());
  await turn();
  assert.equal(calls, 1);
  clock = 20000;
  prewarm.observe(snapshot());
  await turn();
  assert.equal(calls, 2);
  clock = 40000;
  prewarm.observe(snapshot());
  await turn();
  assert.equal(calls, 3);
  clock = 60000;
  prewarm.observe(snapshot());
  await turn();
  assert.equal(calls, 3);
  prewarm.close();
});
