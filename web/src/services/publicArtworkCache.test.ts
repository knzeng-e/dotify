import { afterEach, describe, expect, it, vi } from 'vitest';
import { artworkCacheKey, loadPublicArtwork } from './publicArtworkCache';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe('public artwork cache', () => {
  it('shares one immutable path across gateways and excludes keys/audio/non-IPFS refs', () => {
    const cid = `bafy${'a'.repeat(50)}`;
    expect(artworkCacheKey(`https://one.example/ipfs/${cid}/cover/160.webp`)).toBe(artworkCacheKey(`https://two.example/ipfs/${cid}/cover/160.webp`));
    for (const ref of ['blob:secret', 'https://api.example/keys', `https://one.example/ipfs/${cid}/audio.bin`, `https://one.example/ipfs/${cid}/metadata.json`])
      expect(artworkCacheKey(ref)).toBeNull();
  });
  it('deduplicates concurrent reads and reuses an image without downloading it again', async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/webp' } }));
    vi.stubGlobal('fetch', fetch);
    const urls = [`https://one.example/ipfs/bafy${'b'.repeat(50)}/cover/160.webp`];
    const [first, second] = await Promise.all([loadPublicArtwork(urls), loadPublicArtwork(urls)]);
    expect(first).toBe(second);
    expect(await loadPublicArtwork(urls)).toBe(first);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('refuses a key-like response and oversized streaming bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('secret', { headers: { 'content-type': 'application/json' } }))
    );
    await expect(loadPublicArtwork([`https://one.example/ipfs/bafy${'c'.repeat(50)}`])).rejects.toThrow('bounded image');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array(8 * 1024 * 1024 + 1), { headers: { 'content-type': 'image/webp' } }))
    );
    await expect(loadPublicArtwork([`https://one.example/ipfs/bafy${'d'.repeat(50)}/cover/640.webp`])).rejects.toThrow('budget');
  });
  it('switches gateways even when the first returns headers but stalls its body', async () => {
    vi.useFakeTimers();
    let aborted = false;
    const fetch = vi.fn(async (_url, init?: RequestInit) => {
      if (fetch.mock.calls.length > 1) return new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/webp' } });
      const body = new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
            controller.error(new DOMException('Cancelled', 'AbortError'));
          });
        }
      });
      return new Response(body, { headers: { 'content-type': 'image/webp' } });
    });
    vi.stubGlobal('fetch', fetch);
    const path = `/ipfs/bafy${'e'.repeat(50)}/cover/320.webp`;
    const result = loadPublicArtwork([`https://slow.example${path}`, `https://fast.example${path}`]);
    await vi.advanceTimersByTimeAsync(501);
    await expect(result).resolves.toMatch(/^blob:/);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(aborted).toBe(true);
  });
  it('evicts old in-memory artwork rather than growing without a bound', async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/webp' } }));
    vi.stubGlobal('fetch', fetch);
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const first = [`https://one.example/ipfs/bafy${'f'.repeat(50)}/cover/160.webp`];
    await loadPublicArtwork(first);
    for (let index = 0; index < 49; index++) {
      await loadPublicArtwork([`https://one.example/ipfs/bafy${'f'.repeat(50)}/cover/${index}.webp`]);
    }
    const count = fetch.mock.calls.length;
    await loadPublicArtwork(first);
    expect(fetch).toHaveBeenCalledTimes(count + 1);
    expect(revoke).toHaveBeenCalled();
  });
});

it('accepts a progressing original cover above 1 MiB without the headers timer cancelling it', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn(
    async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new Uint8Array(1024 * 1024));
            setTimeout(() => {
              c.enqueue(new Uint8Array(1024 * 1024));
              c.close();
            }, 9000);
          }
        }),
        { headers: { 'content-type': 'image/png' } }
      )
  );
  vi.stubGlobal('fetch', fetch);
  const result = loadPublicArtwork([`https://one.example/ipfs/bafy${'g'.repeat(50)}`]);
  await vi.advanceTimersByTimeAsync(9001);
  await expect(result).resolves.toMatch(/^blob:/);
});

it('shares immutable Bulletin relay image paths and excludes release metadata', () => {
  const root = `bafy${'e'.repeat(50)}`;
  expect(artworkCacheKey(`https://api.example/api/assets/ipfs/${root}/cover/160.webp`)).toBe(
    artworkCacheKey(`https://native.example/ipfs/${root}/cover/160.webp`)
  );
  expect(artworkCacheKey(`https://api.example/api/assets/ipfs/${root}/release.json`)).toBeNull();
});

it('returns downloaded covers while one optional disk write is stalled, without accumulating writers', async () => {
  let finishWrite!: () => void;
  const put = vi.fn(
    () =>
      new Promise<void>(resolve => {
        finishWrite = resolve;
      })
  );
  const keys = vi.fn(async () => []);
  vi.stubGlobal('caches', { open: vi.fn(async () => ({ match: async () => undefined, put, keys })) });
  const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }));
  vi.stubGlobal('fetch', fetch);
  const urls = [`https://one.example/ipfs/bafy${'h'.repeat(50)}/cover/640.webp`];
  try {
    const first = await loadPublicArtwork(urls);
    expect(first).toMatch(/^blob:/);
    expect(await loadPublicArtwork(urls)).toBe(first);
    expect(await loadPublicArtwork([`https://one.example/ipfs/bafy${'i'.repeat(50)}/cover/640.webp`])).toMatch(/^blob:/);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(put).toHaveBeenCalledTimes(1);
  } finally {
    finishWrite?.();
  }
  await vi.waitFor(() => expect(keys).toHaveBeenCalledOnce());
});

it('uses the network when opening the optional disk cache stalls and ignores its late completion', async () => {
  vi.useFakeTimers();
  let finishOpen!: (cache: unknown) => void;
  const match = vi.fn(async () => undefined);
  vi.stubGlobal('caches', {
    open: vi.fn(
      () =>
        new Promise(resolve => {
          finishOpen = resolve;
        })
    )
  });
  const fetch = vi.fn(async () => new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } }));
  vi.stubGlobal('fetch', fetch);
  const result = loadPublicArtwork([`https://one.example/ipfs/bafy${'j'.repeat(50)}/cover/640.webp`]);
  expect(fetch).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(500);
  await expect(result).resolves.toMatch(/^blob:/);
  finishOpen({ match });
  await vi.advanceTimersByTimeAsync(0);
  expect(match).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledOnce();
});

it('cancels a stalled cached body before downloading the cover instead of waiting indefinitely', async () => {
  vi.useFakeTimers();
  let cancelled = false;
  const cached = new Response(
    new ReadableStream({
      cancel() {
        cancelled = true;
        return new Promise<void>(() => {});
      }
    }),
    { headers: { 'content-type': 'image/png' } }
  );
  vi.stubGlobal('caches', { open: vi.fn(async () => ({ match: async () => cached })) });
  const fetch = vi.fn(async () => new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } }));
  vi.stubGlobal('fetch', fetch);
  const result = loadPublicArtwork([`https://one.example/ipfs/bafy${'k'.repeat(50)}/cover/640.webp`]);
  await vi.advanceTimersByTimeAsync(500);
  await expect(result).resolves.toMatch(/^blob:/);
  expect(cancelled).toBe(true);
  expect(fetch).toHaveBeenCalledOnce();
});

it('keeps a healthy disk hit useful without downloading or rewriting it', async () => {
  const put = vi.fn();
  vi.stubGlobal('caches', {
    open: vi.fn(async () => ({
      match: async () => new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } }),
      put
    }))
  });
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await expect(loadPublicArtwork([`https://one.example/ipfs/bafy${'l'.repeat(50)}/cover/640.webp`])).resolves.toMatch(/^blob:/);
  expect(fetch).not.toHaveBeenCalled();
  expect(put).not.toHaveBeenCalled();
});

it('retains the memory cover when background persistence rejects for quota', async () => {
  const put = vi.fn(async () => {
    throw new DOMException('Full', 'QuotaExceededError');
  });
  vi.stubGlobal('caches', { open: vi.fn(async () => ({ match: async () => undefined, put })) });
  const fetch = vi.fn(async () => new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } }));
  vi.stubGlobal('fetch', fetch);
  const urls = [`https://one.example/ipfs/bafy${'m'.repeat(50)}/cover/640.webp`];
  const first = await loadPublicArtwork(urls);
  expect(first).toMatch(/^blob:/);
  expect(await loadPublicArtwork(urls)).toBe(first);
  expect(fetch).toHaveBeenCalledOnce();
  expect(put).toHaveBeenCalledOnce();
});

it('loads public artwork when the Host refuses access to Cache Storage itself', async () => {
  vi.stubGlobal('caches', undefined);
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    get() {
      throw new DOMException('Unavailable', 'SecurityError');
    }
  });
  const fetch = vi.fn(async () => new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } }));
  vi.stubGlobal('fetch', fetch);
  await expect(loadPublicArtwork([`https://one.example/ipfs/bafy${'n'.repeat(50)}/cover/640.webp`])).resolves.toMatch(/^blob:/);
  expect(fetch).toHaveBeenCalledOnce();
});
