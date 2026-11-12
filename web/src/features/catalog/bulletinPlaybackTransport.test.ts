import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readHostBulletinMedia } from './bulletinHostMedia';
vi.mock('./bulletinHostMedia', async importOriginal => ({ ...(await importOriginal<typeof import('./bulletinHostMedia')>()), readHostBulletinMedia: vi.fn() }));
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

it('ordinary Web and native recovery select the compact route without a legacy or gateway fallback', async () => {
  for (const mode of ['off', 'required']) {
    vi.resetModules();
    vi.stubEnv('VITE_DOTIFY_HOST_MODE', mode);
    const fetcher = vi.fn(async () => new Response(new Uint8Array([4, 5, 6])));
    vi.stubGlobal('fetch', fetcher);
    const compactRead = vi.fn(async () => {
      throw new Error('Native unavailable');
    });
    const { fetchStreamingObject } = await import('./streamingPlayback');
    expect(await fetchStreamingObject(root, '160/segment-001.bin', 3, signal(), undefined, true, { layout: 'rendition-pack-v1', compactRead })).toEqual(
      new Uint8Array([4, 5, 6])
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      `https://api.example/api/media/${root}/compact-v1/160/segment-001.bin`,
      expect.objectContaining({ credentials: 'omit' })
    );
    if (mode === 'required') expect(compactRead).toHaveBeenCalledOnce();
  }
});
it('separates standard and compact warm objects, and cancellation cannot expose a warm object or start fallback', async () => {
  const { fetchStreamingObject } = await import('./streamingPlayback');
  vi.mocked(readHostBulletinMedia).mockResolvedValue(new Uint8Array([1]));
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  expect(await fetchStreamingObject(root, '96/init.bin', 1, signal())).toEqual(new Uint8Array([1]));
  const compactRead = vi.fn(async () => new Uint8Array([2]));
  const options = { layout: 'rendition-pack-v1' as const, compactRead };
  expect(await fetchStreamingObject(root, '96/init.bin', 1, signal(), undefined, true, options)).toEqual(new Uint8Array([2]));
  expect(compactRead).toHaveBeenCalledOnce();
  const abort = new AbortController();
  abort.abort();
  await expect(fetchStreamingObject(root, '96/init.bin', 1, abort.signal, undefined, true, options)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  expect(compactRead).toHaveBeenCalledOnce();
});
it('the selected native transport reconstructs every quality through the ordinary manifest and object authentication', async () => {
  const { default: v } = await import('./fixtures/compactMedia.json');
  const bytes = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], pair => Number.parseInt(pair, 16));
  const manifestBytes = bytes(v.manifestHex),
    key = bytes(v.keyHex);
  vi.mocked(readHostBulletinMedia).mockResolvedValue(manifestBytes);
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const { fetchStreamingObject } = await import('./streamingPlayback');
  const { createBulletinHostCompactMediaReader } = await import('./bulletinCompactMedia');
  const { decryptStreamingMedia } = await import('./streamingFormat');
  const transport: import('./streamingPlayback').StreamingTransportOptions = { layout: 'rendition-pack-v1' };
  const manifest = await fetchStreamingObject(v.root, 'manifest.json', 256 * 1024, signal(), undefined, true, transport);
  const session = await createBulletinHostCompactMediaReader({
    insideHost: () => true,
    queryBytes: async cid => ({ ok: true, value: bytes(v.blocks[cid as keyof typeof v.blocks]) })
  })({ root: v.root, manifestBytes: manifest, key, scope: v.scope, signal: signal() });
  transport.compactRead = session.read;
  for (const rendition of session.context.manifest.renditions)
    for (const object of [rendition.init, ...rendition.segments]) {
      const encrypted = await fetchStreamingObject(v.root, object.path, object.encryptedLength, signal(), undefined, true, transport);
      expect(await decryptStreamingMedia(session.context, object, encrypted)).toEqual(bytes(v.plain[object.path as keyof typeof v.plain]));
    }
  expect(readHostBulletinMedia).toHaveBeenCalledTimes(1);
  expect(vi.mocked(readHostBulletinMedia).mock.calls[0][1]).toBe('manifest.json');
  expect(fetcher).not.toHaveBeenCalled();
});

it('a late compact native result cannot populate the warm cache after cancellation', async () => {
  const { fetchStreamingObject } = await import('./streamingPlayback');
  const owner = new AbortController();
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const compactRead = vi.fn(async () => {
    owner.abort();
    return new Uint8Array([9]);
  });
  await expect(fetchStreamingObject(root, '96/init.bin', 1, owner.signal, undefined, true, { layout: 'rendition-pack-v1', compactRead })).rejects.toThrow();
  const fresh = vi.fn(async () => new Uint8Array([8]));
  expect(await fetchStreamingObject(root, '96/init.bin', 1, signal(), undefined, true, { layout: 'rendition-pack-v1', compactRead: fresh })).toEqual(
    new Uint8Array([8])
  );
  expect(fresh).toHaveBeenCalledOnce();
  expect(fetcher).not.toHaveBeenCalled();
});

for (const mode of ['off', 'required'])
  it(`ordinary ${mode === 'off' ? 'Web' : 'Host'} playback dispatches compact and appends authenticated logical objects`, async () => {
    vi.stubEnv('VITE_DOTIFY_HOST_MODE', mode);
    vi.stubGlobal('navigator', { connection: { saveData: true } });
    const { default: v } = await import('./fixtures/compactMedia.json');
    const bytes = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], pair => Number.parseInt(pair, 16));
    const { createBulletinHostCompactMediaReader } = await import('./bulletinCompactMedia');
    const session = await createBulletinHostCompactMediaReader({
      insideHost: () => true,
      queryBytes: async cid => ({ ok: true, value: bytes(v.blocks[cid as keyof typeof v.blocks]) })
    })({ root: v.root, manifestBytes: bytes(v.manifestHex), key: bytes(v.keyHex), scope: v.scope, signal: signal() });
    const appended: Uint8Array[] = [];
    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    class BufferStub extends EventTarget {
      appendBuffer(value: Uint8Array) {
        appended.push(Uint8Array.from(value));
        queueMicrotask(() => this.dispatchEvent(new Event('updateend')));
      }
    }
    class SourceStub extends EventTarget {
      static isTypeSupported() {
        return true;
      }
      readyState = 'closed';
      duration = 0;
      constructor() {
        super();
        queueMicrotask(() => {
          this.readyState = 'open';
          this.dispatchEvent(new Event('sourceopen'));
        });
      }
      addSourceBuffer() {
        return new BufferStub();
      }
      endOfStream() {
        this.readyState = 'ended';
        finish();
      }
    }
    vi.stubGlobal('MediaSource', SourceStub);
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:compact-structural-test');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        urls.push(url);
        const path = url.split('/compact-v1/')[1];
        if (!path) throw new Error('Wrong format dispatch');
        return new Response(path === 'manifest.json' ? bytes(v.manifestHex) : await session.read(path, 1024 * 1024 + 16, init?.signal ?? signal()));
      })
    );
    const { bulletinHostMediaDeps } = await import('./bulletinHostMedia');
    const priorInside = bulletinHostMediaDeps.insideHost,
      priorQuery = bulletinHostMediaDeps.queryBytes;
    bulletinHostMediaDeps.insideHost = () => true;
    bulletinHostMediaDeps.queryBytes = async cid => ({ ok: true, value: bytes(v.blocks[cid as keyof typeof v.blocks]) });
    vi.mocked(readHostBulletinMedia).mockResolvedValue(bytes(v.manifestHex));
    const errors = vi.fn();
    const owner = new AbortController();
    try {
      const { createStreamingPlayback } = await import('./streamingPlayback');
      const result = await createStreamingPlayback({
        cid: v.root,
        audioRef: `dotify:enc:v3:key-v3:bulletin-pack-v1://${v.root}`,
        key: bytes(v.keyHex),
        scope: v.scope,
        signal: owner.signal,
        audio: () => null,
        onError: errors
      });
      expect(result.progressive).toBe(true);
      await finished;
      expect(appended).toEqual(
        ['96/init.bin', '96/segment-000.bin', '96/segment-001.bin', '96/segment-002.bin'].map(path => bytes(v.plain[path as keyof typeof v.plain]))
      );
      expect(urls.every(url => url.startsWith(`https://api.example/api/media/${v.root}/compact-v1/`))).toBe(true);
      if (mode === 'off') expect(readHostBulletinMedia).not.toHaveBeenCalled();
      else {
        expect(urls).toHaveLength(0);
        expect(readHostBulletinMedia).toHaveBeenCalledOnce();
      }
      expect(errors).not.toHaveBeenCalled();
    } finally {
      owner.abort();
      bulletinHostMediaDeps.insideHost = priorInside;
      bulletinHostMediaDeps.queryBytes = priorQuery;
      createUrl.mockRestore();
      revokeUrl.mockRestore();
    }
  });
it('ordinary playback rejects a different registered root or key version before transport', async () => {
  const { default: v } = await import('./fixtures/compactMedia.json');
  const { createStreamingPlayback } = await import('./streamingPlayback');
  const fetchObject = vi.fn();
  const input = { cid: v.root, key: new Uint8Array(32), scope: v.scope, signal: signal(), audio: () => null, onError: vi.fn(), fetchObject };
  for (const ref of [`dotify:enc:v3:key-v2:bulletin-pack-v1://${v.root}`, `dotify:enc:v3:key-v3:bulletin-pack-v1://${root}`])
    await expect(createStreamingPlayback({ ...input, audioRef: ref })).rejects.toThrow('reference identity');
  expect(fetchObject).not.toHaveBeenCalled();
});
