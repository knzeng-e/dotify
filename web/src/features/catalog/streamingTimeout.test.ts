import { afterEach, expect, it, vi } from 'vitest';
import { createStreamingPlayback } from './streamingPlayback';
import { serializeAudioDiagnostics, type StreamingStartupMetric } from './audioStartupTelemetry';
import vector from './fixtures/compactMedia.json';
const bytes = (hex: string) => Uint8Array.from(hex.match(/../g)!.map(v => parseInt(v, 16)));
afterEach(() => vi.unstubAllGlobals());

it.each(['TimeoutError', 'AbortError'])('records only the deadline, not ordinary cancellation (%s)', async name => {
  vi.stubGlobal('MediaSource', undefined);
  vi.stubGlobal('ManagedMediaSource', undefined);
  const owner = new AbortController();
  const metrics: Partial<StreamingStartupMetric>[] = [];
  let started!: () => void;
  const pending = new Promise<void>(resolve => {
    started = resolve;
  });
  const result = createStreamingPlayback({
    cid: vector.root,
    key: bytes(vector.keyHex),
    scope: vector.scope,
    signal: owner.signal,
    forRoomCapture: true,
    audio: () => null,
    onError: vi.fn(),
    onMetric: metric => metrics.push(metric),
    fetchObject: async (_cid, path, _size, signal) => {
      if (path === 'manifest.json') return bytes(vector.manifestHex);
      started();
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        if (signal.aborted) reject(signal.reason);
      });
    }
  }).catch(error => error);
  await pending;
  owner.abort(new DOMException('stopped', name));
  await result;
  const errors = metrics.filter(metric => metric.phase === 'error');
  expect(errors).toHaveLength(name === 'TimeoutError' ? 1 : 0);
  if (name === 'TimeoutError') {
    expect(errors[0]).toMatchObject({ errorKind: 'timeout', readTimings: { objectsRead: 1, objectsDecrypted: 1 } });
    const report = serializeAudioDiagnostics({
      streaming: [{ ...errors[0], audioRef: 'secret-ref', cid: 'secret-cid', timestamp: 1, elapsedMs: 60_000 } as StreamingStartupMetric],
      host: [],
      latestMediaPlayingMs: null
    });
    expect(report).toContain('timeout');
    expect(report).not.toContain('secret');
  }
});
