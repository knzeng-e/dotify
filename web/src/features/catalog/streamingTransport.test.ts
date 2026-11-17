import { afterEach, describe, expect, it, vi } from 'vitest';
import { mediaEdgeOrigin, streamingObjectUrls } from './streamingTransport';
import { fetchStreamingObject } from './streamingPlayback';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('ciphertext media edge', () => {
  it('rejects credentials and mutable/cache-busting paths, query strings and fragments', () => {
    for (const value of [
      'http://media.example',
      'https://user:secret@media.example',
      'https://media.example?token=secret',
      'https://media.example/ipfs',
      'https://media.example#token',
      'https://127.0.0.1',
      'https://[::1]',
      'https://localhost',
      'https://media.example:444'
    ])
      expect(() => mediaEdgeOrigin(value)).toThrow();
    expect(mediaEdgeOrigin('https://media.example/')).toBe('https://media.example');
    expect(mediaEdgeOrigin('')).toBeUndefined();
  });
  it('puts the configured edge first without removing API and IPFS recovery', () => {
    expect(
      streamingObjectUrls('cid', 'path', { edge: 'https://media.example', api: 'https://api.example', gateways: ['https://pin.example/ipfs/cid/path'] })
    ).toEqual(['https://media.example/ipfs/cid/path', 'https://api.example/api/media/cid/stream/path', 'https://pin.example/ipfs/cid/path']);
  });
  it('falls back from 401/404 edge responses and truncated bodies, without sending cookies, keys or a Range', async () => {
    vi.stubEnv('VITE_DOTIFY_MEDIA_EDGE_URL', 'https://media.example');
    const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
      expect(options?.credentials).toBe('omit');
      expect(options?.headers).toBeUndefined();
      if (url.startsWith('https://media.example')) return new Response(null, { status: 404 });
      return new Response(new Uint8Array([1, 2, 3]));
    });
    vi.stubGlobal('fetch', fetcher);
    expect(await fetchStreamingObject(`Qm${'b'.repeat(44)}`, '160/segment-000.bin', 3, new AbortController().signal)).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetcher.mock.calls.length).toBe(2);
    for (const response of [new Response(null, { status: 401 }), new Response(new Uint8Array([1]))]) {
      fetcher.mockResolvedValueOnce(response);
      expect(await fetchStreamingObject(`Qm${'c'.repeat(44)}`, '160/segment-001.bin', 3, new AbortController().signal)).toEqual(new Uint8Array([1, 2, 3]));
    }
  });
  it('does not turn a caller cancellation into more fallback requests', async () => {
    vi.stubEnv('VITE_DOTIFY_MEDIA_EDGE_URL', 'https://media.example');
    const abort = new AbortController();
    const fetcher = vi.fn(async () => {
      abort.abort();
      throw new Error('cancelled');
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchStreamingObject(`Qm${'d'.repeat(44)}`, '160/segment-000.bin', 3, abort.signal)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
