import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createStreamingReadTimings, measureStreamingTransport } from './streamingReadTimings';
import { readHostBulletinMedia } from './bulletinHostMedia';
import vector from './fixtures/compactMedia.json';

vi.mock('./bulletinHostMedia', () => ({ readHostBulletinMedia: vi.fn() }));
vi.mock('../../services/pinata', () => ({ getAudioGatewayUrls: () => ['https://gateway.example/object'] }));
const root = `Qm${'g'.repeat(44)}`;
const bulletin = 'bafykbzacec2bpys6cfd23kbnvg4p7fidf6laimhd5afshs32sgilt74gkybhw';
let now = 0;
beforeEach(() => {
  vi.resetModules();
  vi.mocked(readHostBulletinMedia).mockReset();
  vi.stubEnv('VITE_DOTIFY_HOST_MODE', 'off');
  vi.stubEnv('VITE_DOTIFY_API_URL', 'https://relay.example');
  vi.stubEnv('VITE_DOTIFY_MEDIA_EDGE_URL', '');
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('separates cancelled relay waiting from headers and held body work without spending a third request', async () => {
  const { fetchStreamingObject } = await import('./streamingPlayback');
  const timing = createStreamingReadTimings();
  const options = { layout: 'unixfs-files-v1' as const, onReadPhase: timing.observeTransport };
  const headers: Array<(response: Response) => void> = [];
  const fetcher = vi.fn(() => new Promise<Response>(resolve => headers.push(resolve)));
  vi.stubGlobal('fetch', fetcher);
  const signal = new AbortController().signal;
  const a = fetchStreamingObject(root, '96/segment-000.bin', 1, signal, undefined, true, options);
  const b = fetchStreamingObject(root, '96/segment-001.bin', 1, signal, undefined, true, options);
  await vi.waitFor(() => expect(headers).toHaveLength(2));
  const queued = new AbortController();
  const c = fetchStreamingObject(root, '96/segment-002.bin', 1, queued.signal, undefined, true, options).catch(error => error);
  now = 20;
  const bodies: ReadableStreamDefaultController<Uint8Array>[] = [];
  const responses = headers.map(
    () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start: controller => {
            bodies.push(controller);
          }
        })
      )
  );
  headers.forEach((resolve, i) => resolve(responses[i]));
  await vi.waitFor(() => expect(responses.every(response => response.body?.locked)).toBe(true));
  now = 100;
  queued.abort();
  expect(await c).toMatchObject({ name: 'AbortError' });
  now = 200;
  bodies.forEach(body => {
    body.enqueue(Uint8Array.of(7));
    body.close();
  });
  expect(await Promise.all([a, b])).toEqual([Uint8Array.of(7), Uint8Array.of(7)]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(timing.snapshot()).toMatchObject({ relayWaitMs: 100, httpHeadersMs: 40, httpBodyMs: 360, httpRequests: 2, httpBodyReads: 2, httpFailures: 0 });
  const before = timing.snapshot();
  await fetchStreamingObject(root, '96/segment-000.bin', 1, signal, undefined, true, options);
  expect(timing.snapshot()).toEqual(before); // Warm ciphertext does not fabricate a transport phase.
});

it('keeps failed native probe work separate from successful HTTP recovery', async () => {
  vi.stubEnv('VITE_DOTIFY_HOST_MODE', 'required');
  vi.mocked(readHostBulletinMedia).mockImplementation(async () => {
    now = 40;
    throw new Error('PRIVATE native failure');
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      now += 20;
      return new Response(Uint8Array.of(8));
    })
  );
  const { fetchStreamingObject } = await import('./streamingPlayback');
  const timing = createStreamingReadTimings();
  expect(
    await fetchStreamingObject(bulletin, '96/init.bin', 1, new AbortController().signal, undefined, true, {
      layout: 'unixfs-files-v1',
      onReadPhase: timing.observeTransport
    })
  ).toEqual(Uint8Array.of(8));
  expect(timing.snapshot()).toMatchObject({
    nativeReadMs: 40,
    nativeReadAttempts: 1,
    nativeReadFailures: 1,
    httpHeadersMs: 20,
    httpRequests: 1,
    httpBodyReads: 1,
    httpFailures: 0
  });
  expect(JSON.stringify(timing.snapshot())).not.toMatch(/PRIVATE|https|bulletin/);
});

it('counts non-200 responses once while preserving the existing gateway fallback', async () => {
  const fetcher = vi.fn(async () => {
    now += 10;
    return fetcher.mock.calls.length === 1 ? new Response(null, { status: 503 }) : new Response(Uint8Array.of(9));
  });
  vi.stubGlobal('fetch', fetcher);
  const { fetchStreamingObject } = await import('./streamingPlayback');
  const timing = createStreamingReadTimings();
  expect(
    await fetchStreamingObject(root, '96/init.bin', 1, new AbortController().signal, undefined, true, {
      layout: 'unixfs-files-v1',
      onReadPhase: timing.observeTransport
    })
  ).toEqual(Uint8Array.of(9));
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(timing.snapshot()).toMatchObject({ httpHeadersMs: 20, httpRequests: 2, httpBodyReads: 1, httpFailures: 1 });
});

it('counts an incomplete body as one failed attempt before ordinary fallback', async () => {
  const fetcher = vi.fn(async () => new Response(fetcher.mock.calls.length === 1 ? Uint8Array.of(1) : Uint8Array.of(1, 2)));
  vi.stubGlobal('fetch', fetcher);
  const { fetchStreamingObject } = await import('./streamingPlayback');
  const timing = createStreamingReadTimings();
  expect(
    await fetchStreamingObject(root, '96/init.bin', 2, new AbortController().signal, undefined, true, {
      layout: 'unixfs-files-v1',
      onReadPhase: timing.observeTransport
    })
  ).toEqual(Uint8Array.of(1, 2));
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(timing.snapshot()).toMatchObject({ httpRequests: 2, httpBodyReads: 2, httpFailures: 1 });
});

it('does not let an observer failure change successful bytes or mask the original rejection', async () => {
  const observer = () => {
    throw new Error('observer failed');
  };
  const bytes = Uint8Array.of(1);
  expect(await measureStreamingTransport('http-body', async () => bytes, observer)).toBe(bytes);
  const failure = new Error('original transport failure');
  await expect(
    measureStreamingTransport(
      'http-headers',
      async () => {
        throw failure;
      },
      observer
    )
  ).rejects.toBe(failure);
});

it('wires per-reader phase aggregates into the manifest boundary and redacted support export', async () => {
  const { createStreamingPlayback } = await import('./streamingPlayback');
  const { serializeAudioDiagnostics } = await import('./audioStartupTelemetry');
  const metrics: import('./audioStartupTelemetry').StreamingStartupMetric[] = [];
  const bytes = (hex: string) => Uint8Array.from(hex.match(/../g)!, pair => parseInt(pair, 16));
  const failure = new Error('stop after authenticated manifest');
  await expect(
    createStreamingPlayback({
      cid: vector.root,
      key: bytes(vector.keyHex),
      scope: vector.scope,
      signal: new AbortController().signal,
      audio: () => null,
      forRoomCapture: true,
      onError: vi.fn(),
      onMetric: metric => metrics.push({ ...metric, audioRef: 'PRIVATE', cid: vector.root, elapsedMs: 0, timestamp: 1 }),
      fetchObject: async (_cid, path, _max, _signal, _observe, _exact, transport) => {
        if (path !== 'manifest.json') throw failure;
        transport?.onReadPhase?.({ phase: 'http-headers', elapsedMs: 10, failed: false });
        transport?.onReadPhase?.({ phase: 'http-body', elapsedMs: 20, failed: false });
        return bytes(vector.manifestHex);
      }
    })
  ).rejects.toBe(failure);
  const report = JSON.parse(serializeAudioDiagnostics({ streaming: metrics, host: [], latestMediaPlayingMs: null }));
  expect(report.streaming.find((event: { phase: string }) => event.phase === 'manifest-ready').readTimings).toMatchObject({
    httpRequests: 1,
    httpBodyReads: 1,
    httpHeadersMs: 10,
    httpBodyMs: 20
  });
  expect(JSON.stringify(report)).not.toContain('PRIVATE');
  expect(JSON.stringify(report)).not.toContain(vector.root);
});
