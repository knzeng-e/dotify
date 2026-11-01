import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readHostBulletinMedia } from './bulletinHostMedia';
vi.mock('./bulletinHostMedia', () => ({ readHostBulletinMedia: vi.fn() }));
const root = 'bafykbzacec2bpys6cfd23kbnvg4p7fidf6laimhd5afshs32sgilt74gkybhw';
const signal = () => new AbortController().signal;
beforeEach(() => {
  vi.resetModules();
  vi.mocked(readHostBulletinMedia).mockReset();
  vi.stubEnv('VITE_DOTIFY_HOST_MODE', 'required');
  vi.stubEnv('VITE_DOTIFY_API_URL', 'https://api.example');
  vi.stubEnv('VITE_DOTIFY_MEDIA_EDGE_URL', 'https://edge.example');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('the real player selects native ciphertext without making a gateway request', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  vi.mocked(readHostBulletinMedia).mockResolvedValue(new Uint8Array([1, 2, 3]));
  const { fetchStreamingObject } = await import('./streamingPlayback');
  expect(await fetchStreamingObject(root, '160/segment-000.bin', 3, signal())).toEqual(new Uint8Array([1, 2, 3]));
  expect(fetcher).not.toHaveBeenCalled();
  expect(readHostBulletinMedia).toHaveBeenCalledWith(root, '160/segment-000.bin', 3, expect.any(AbortSignal));
});
it('ordinary Web and native read recovery use only the existing API ciphertext route', async () => {
  for (const mode of ['off', 'required']) {
    vi.resetModules();
    vi.stubEnv('VITE_DOTIFY_HOST_MODE', mode);
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal('fetch', fetcher);
    vi.mocked(readHostBulletinMedia).mockRejectedValue(new Error('Host lookup unavailable'));
    const { fetchStreamingObject } = await import('./streamingPlayback');
    expect(await fetchStreamingObject(root, '160/segment-000.bin', 3, signal())).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(`https://api.example/api/media/${root}/stream/160/segment-000.bin`, expect.objectContaining({ credentials: 'omit' }));
  }
});
it('a caller cancellation cannot start a native-to-Web fallback', async () => {
  const abort = new AbortController();
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  vi.mocked(readHostBulletinMedia).mockImplementation(async () => {
    abort.abort();
    throw new Error('cancelled');
  });
  const { fetchStreamingObject } = await import('./streamingPlayback');
  await expect(fetchStreamingObject(root, '160/segment-000.bin', 3, abort.signal)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
