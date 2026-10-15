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
