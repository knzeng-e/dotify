import { afterEach, expect, it, vi } from 'vitest';
import { prefetchStreamingAudio } from './streamingPrefetch';
import { fetchStreamingObject } from './streamingPlayback';
afterEach(() => vi.restoreAllMocks());
it('warms ciphertext without a key, then enforces the authenticated object length at playback', async () => {
  const cid = 'Qm' + 'c'.repeat(44);
  const calls: string[] = [];
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    calls.push(String(input));
    return new Response(new Uint8Array([1, 2, 3]));
  });
  await prefetchStreamingAudio(`dotify:enc:v3:key-v2:ipfs://${cid}`);
  expect(calls).toHaveLength(2);
  expect(calls.every(url => /manifest.json|160\/init.bin/.test(url))).toBe(true);
  fetcher.mockImplementation(async () => new Response(new Uint8Array([1, 2, 3, 4])));
  // Speculative bytes are not trusted: an incompatible authenticated size must
  // cause a new transport read, never return a truncated cached object.
  expect(await fetchStreamingObject(cid, '160/init.bin', 4, new AbortController().signal)).toEqual(new Uint8Array([1, 2, 3, 4]));
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it('does not turn retired or malformed references into speculative requests', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  for (const ref of ['dotify:enc:v2:key-v2:ipfs://old', 'old-cid', 'dotify:enc:v3:key-v1:ipfs://old']) await prefetchStreamingAudio(ref);
  expect(fetcher).not.toHaveBeenCalled();
});
it('a partial HTTP body is retried as transport, while cancellation prevents a warmed cache hit', async () => {
  const cid = 'Qm' + 'd'.repeat(44);
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(new Uint8Array([1, 2])))
    .mockImplementation(async () => new Response(new Uint8Array([1, 2, 3])));
  expect(await fetchStreamingObject(cid, '160/segment-000.bin', 3, new AbortController().signal)).toHaveLength(3);
  expect(fetcher).toHaveBeenCalledTimes(2);
  await prefetchStreamingAudio(`dotify:enc:v3:key-v2:ipfs://${cid}`);
  const controller = new AbortController();
  controller.abort();
  await expect(fetchStreamingObject(cid, 'manifest.json', 256 * 1024, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});
