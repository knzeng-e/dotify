import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readCompatibilityAudio } from './compatibilityAudio';
import type { StreamingObject } from './streamingFormat';

const cid = `Qm${'g'.repeat(44)}`;
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_DOTIFY_API_URL', 'https://relay.example');
  vi.stubEnv('VITE_DOTIFY_HOST_MODE', 'off');
  vi.stubEnv('VITE_DOTIFY_MEDIA_EDGE_URL', '');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('prepares a full-length rendition through the two-download relay without self-triggered busy fallbacks', async () => {
  vi.useFakeTimers();
  const { fetchStreamingObject } = await import('./streamingPlayback');
  let active = 0;
  let peak = 0;
  let busy = 0;
  let fallbacks = 0;
  const fetcher = vi.fn(async (url: string, options: RequestInit) => {
    if (!url.startsWith('https://relay.example/api/media/')) {
      fallbacks++;
      return new Response(null, { status: 503 });
    }
    // This is the deployed relay's explicit capacity, not a browser limit.
    if (active >= 2) {
      busy++;
      return new Response(null, { status: 503 });
    }
    active++;
    peak = Math.max(peak, active);
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          options.signal?.removeEventListener('abort', abort);
          resolve();
        }, 1000);
        const abort = () => {
          clearTimeout(timer);
          reject(options.signal?.reason);
        };
        options.signal?.addEventListener('abort', abort, { once: true });
      });
      const index = Number(/segment-(\d+)/.exec(url)?.[1] ?? -1) + 1;
      return new Response(new Uint8Array(17).fill(index));
    } finally {
      active--;
    }
  });
  vi.stubGlobal('fetch', fetcher);
  const objects: StreamingObject[] = Array.from({ length: 72 }, (_, i) => ({
    rendition: '96',
    kind: i ? 'media' : 'init',
    index: Math.max(0, i - 1),
    counter: i,
    plainLength: 1,
    encryptedLength: 17,
    path: i ? `96/segment-${String(i - 1).padStart(3, '0')}.bin` : '96/init.bin'
  }));
  const owner = new AbortController();
  const deadline = setTimeout(() => owner.abort(new DOMException('Startup expired', 'AbortError')), 60_000);
  const result = readCompatibilityAudio(
    objects,
    async (object, signal) => {
      const bytes = await fetchStreamingObject(cid, object.path, object.encryptedLength, signal);
      return bytes.slice(0, 1);
    },
    owner.signal
  )
    .then(parts => ({ parts, error: null }))
    .catch((error: unknown) => ({ parts: [], error }))
    .finally(() => clearTimeout(deadline));
  await vi.advanceTimersByTimeAsync(60_000);
  const outcome = await result;
  expect(outcome.error).toBeNull();
  expect(outcome.parts.map(bytes => bytes[0])).toEqual(Array.from({ length: 72 }, (_, i) => i));
  expect(peak).toBe(2);
  expect(busy).toBe(0);
  expect(fallbacks).toBe(0);
  expect(active).toBe(0);
});

it('keeps a relay slot until its body finishes and removes a cancelled waiting read without fetching it', async () => {
  const { fetchStreamingObject } = await import('./streamingPlayback');
  const bodies: ReadableStreamDefaultController<Uint8Array>[] = [];
  const fetcher = vi.fn(
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            bodies.push(controller);
          }
        })
      )
  );
  vi.stubGlobal('fetch', fetcher);
  const first = fetchStreamingObject(cid, '160/segment-000.bin', 3, new AbortController().signal);
  const second = fetchStreamingObject(cid, '160/segment-001.bin', 3, new AbortController().signal);
  await vi.waitFor(() => expect(bodies).toHaveLength(2));
  const waiting = new AbortController();
  const cancelled = fetchStreamingObject(cid, '160/segment-002.bin', 3, waiting.signal).catch((error: unknown) => error);
  await Promise.resolve();
  await Promise.resolve();
  waiting.abort();
  expect(await cancelled).toMatchObject({ name: 'AbortError' });
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const body of bodies) {
    body.enqueue(Uint8Array.of(1, 2, 3));
    body.close();
  }
  await expect(first).resolves.toEqual(Uint8Array.of(1, 2, 3));
  await expect(second).resolves.toEqual(Uint8Array.of(1, 2, 3));
  const next = fetchStreamingObject(cid, '160/segment-003.bin', 3, new AbortController().signal);
  await vi.waitFor(() => expect(bodies).toHaveLength(3));
  bodies[2].enqueue(Uint8Array.of(4, 5, 6));
  bodies[2].close();
  await expect(next).resolves.toEqual(Uint8Array.of(4, 5, 6));
});

it('releases an active cancelled body so a later selection can use the relay', async () => {
  const { fetchStreamingObject } = await import('./streamingPlayback');
  const bodies: ReadableStreamDefaultController<Uint8Array>[] = [];
  const fetcher = vi.fn(
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            bodies.push(controller);
          }
        })
      )
  );
  vi.stubGlobal('fetch', fetcher);
  const owner = new AbortController();
  const retired = fetchStreamingObject(cid, '320/segment-000.bin', 3, owner.signal).catch((error: unknown) => error);
  const remaining = fetchStreamingObject(cid, '320/segment-001.bin', 3, new AbortController().signal);
  await vi.waitFor(() => expect(bodies).toHaveLength(2));
  const next = fetchStreamingObject(cid, '320/segment-002.bin', 3, new AbortController().signal);
  owner.abort();
  expect(await retired).toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() => expect(bodies).toHaveLength(3));
  for (const body of bodies.slice(1)) {
    body.enqueue(Uint8Array.of(1, 2, 3));
    body.close();
  }
  await expect(remaining).resolves.toEqual(Uint8Array.of(1, 2, 3));
  await expect(next).resolves.toEqual(Uint8Array.of(1, 2, 3));
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('reuses the ciphertext of a short rendition after a Room retry without raising the byte budget', async () => {
  vi.useFakeTimers();
  const { fetchStreamingObject } = await import('./streamingPlayback');
  const fetcher = vi.fn(async () => new Response(new Uint8Array(48_000)));
  vi.stubGlobal('fetch', fetcher);
  const read = (index: number) => fetchStreamingObject(cid, `96/segment-${String(index).padStart(3, '0')}.bin`, 48_000, new AbortController().signal);
  for (let i = 0; i < 72; i++) await read(i);
  await vi.advanceTimersByTimeAsync(61_000);
  for (let i = 0; i < 72; i++) await read(i);
  expect(fetcher).toHaveBeenCalledTimes(72);
  // The existing 4MiB limit wins even though the entry allowance is larger.
  for (let i = 72; i < 90; i++) await read(i);
  await read(0);
  expect(fetcher).toHaveBeenCalledTimes(91);
  await vi.advanceTimersByTimeAsync(5 * 60_000);
  await read(89);
  expect(fetcher).toHaveBeenCalledTimes(92);
});

it('serves waiting solo reads before Room read-ahead without interrupting active bodies', async () => {
  const { acquireMediaRelaySlot } = await import('./mediaRelaySlots');
  const signal = new AbortController().signal;
  const first = await acquireMediaRelaySlot(signal, 'preparation');
  const second = await acquireMediaRelaySlot(signal, 'preparation');
  const order: string[] = [];
  const background = acquireMediaRelaySlot(signal, 'preparation').then(release => {
    order.push('room');
    return release;
  });
  const foreground = acquireMediaRelaySlot(signal, 'playback').then(release => {
    order.push('solo');
    return release;
  });
  first();
  const foregroundRelease = await foreground;
  expect(order).toEqual(['solo']);
  foregroundRelease();
  const backgroundRelease = await background;
  expect(order).toEqual(['solo', 'room']);
  backgroundRelease();
  second();
});
