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

it('keeps the two-body relay working while an early compatibility object is slow', async () => {
  vi.useFakeTimers();
  const { fetchStreamingObject } = await import('./streamingPlayback');
  let active = 0;
  let peak = 0;
  let busy = 0;
  let finishedAt = -1;
  const startedAt = Date.now();
  const fetcher = vi.fn(async (url: string, options: RequestInit) => {
    expect(url).toMatch(/^https:\/\/relay\.example\/api\/media\//);
    if (active >= 2) {
      busy++;
      return new Response(null, { status: 503 });
    }
    active++;
    peak = Math.max(peak, active);
    const index = Number(/segment-(\d+)/.exec(url)?.[1] ?? -1) + 1;
    try {
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(options.signal?.reason);
        };
        const timer = setTimeout(
          () => {
            options.signal?.removeEventListener('abort', abort);
            resolve();
          },
          index === 0 ? 10_000 : 100
        );
        options.signal?.addEventListener('abort', abort, { once: true });
      });
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
  const controller = new AbortController();
  const result = readCompatibilityAudio(
    objects,
    async (object, signal) => {
      const bytes = await fetchStreamingObject(cid, object.path, object.encryptedLength, signal);
      return bytes.slice(0, 1);
    },
    controller.signal
  ).then(parts => {
    finishedAt = Date.now() - startedAt;
    return parts;
  });
  try {
    await vi.advanceTimersByTimeAsync(10_000);
    // All short reads can finish while the first body waits. Its ordering
    // requirement must not leave a free relay slot idle behind a full window.
    expect(fetcher).toHaveBeenCalledTimes(72);
    expect(finishedAt).toBe(10_000);
    expect((await result).map(bytes => bytes[0])).toEqual(Array.from({ length: 72 }, (_, i) => i));
    expect(peak).toBe(2);
    expect(busy).toBe(0);
  } finally {
    controller.abort();
    await result.catch(() => undefined);
  }
  expect(active).toBe(0);
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

it('reuses solo ciphertext completed while an identical Room read waits for a relay slot', async () => {
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
  const solo = new AbortController(),
    room = new AbortController();
  const first = fetchStreamingObject(cid, '96/segment-000.bin', 3, solo.signal);
  const second = fetchStreamingObject(cid, '96/segment-001.bin', 3, solo.signal);
  const observations: unknown[] = [];
  let waiting: Promise<Uint8Array> | undefined;
  let following: Promise<Uint8Array[]> | undefined;
  try {
    await vi.waitFor(() => expect(bodies).toHaveLength(2));
    waiting = fetchStreamingObject(cid, '96/segment-000.bin', 3, room.signal, observation => observations.push(observation), true, {
      layout: 'unixfs-files-v1',
      priority: 'preparation'
    });
    void waiting.catch(() => undefined);
    bodies[0].enqueue(Uint8Array.of(1, 2, 3));
    bodies[0].close();
    await expect(first).resolves.toEqual(Uint8Array.of(1, 2, 3));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(waiting).resolves.toEqual(Uint8Array.of(1, 2, 3));
    expect(observations).toEqual([{ fromCache: true }]);
    bodies[1].enqueue(Uint8Array.of(4, 5, 6));
    bodies[1].close();
    await expect(second).resolves.toEqual(Uint8Array.of(4, 5, 6));
    // A cache hit must release its relay slot, rather than starving later work.
    following = Promise.all([fetchStreamingObject(cid, '96/segment-002.bin', 3, solo.signal), fetchStreamingObject(cid, '96/segment-003.bin', 3, solo.signal)]);
    void following.catch(() => undefined);
    await vi.waitFor(() => expect(bodies).toHaveLength(4));
    for (const body of bodies.slice(2)) {
      body.enqueue(Uint8Array.of(7, 8, 9));
      body.close();
    }
    await expect(following).resolves.toEqual([Uint8Array.of(7, 8, 9), Uint8Array.of(7, 8, 9)]);
  } finally {
    const settled = Promise.allSettled([first, second, ...(waiting ? [waiting] : []), ...(following ? [following] : [])]);
    solo.abort();
    room.abort();
    await settled;
  }
});

it('does not reuse a newly cached body when the queued reader requires a different authenticated length', async () => {
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
  const first = fetchStreamingObject(cid, '160/segment-000.bin', 3, owner.signal);
  const second = fetchStreamingObject(cid, '160/segment-001.bin', 3, owner.signal);
  let waiting: Promise<Uint8Array> | undefined;
  try {
    await vi.waitFor(() => expect(bodies).toHaveLength(2));
    waiting = fetchStreamingObject(cid, '160/segment-000.bin', 4, owner.signal, undefined, true, { layout: 'unixfs-files-v1', priority: 'preparation' });
    void waiting.catch(() => undefined);
    bodies[0].enqueue(Uint8Array.of(1, 2, 3));
    bodies[0].close();
    await expect(first).resolves.toHaveLength(3);
    await vi.waitFor(() => expect(bodies).toHaveLength(3));
    bodies[2].enqueue(Uint8Array.of(4, 5, 6, 7));
    bodies[2].close();
    await expect(waiting).resolves.toEqual(Uint8Array.of(4, 5, 6, 7));
    bodies[1].enqueue(Uint8Array.of(1, 2, 3));
    bodies[1].close();
    await expect(second).resolves.toHaveLength(3);
    expect(fetcher).toHaveBeenCalledTimes(3);
  } finally {
    const settled = Promise.allSettled([first, second, ...(waiting ? [waiting] : [])]);
    owner.abort();
    await settled;
  }
});
