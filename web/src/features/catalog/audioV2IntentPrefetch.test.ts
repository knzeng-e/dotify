import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelAudioV2TrackIntentPrefetch, prefetchAudioV2TrackIntent, startAudioV2NeighborPrefetch } from './audioV2IntentPrefetch';
import type { AudioV2RangeResult } from './audioV2Gateway';

const CID = 'QmIntentAudio';
const AUDIO_REF = `dotify:enc:v2:ipfs://${CID}`;

function uint32be(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function dav2HeaderPrefix(plainLength = 4): Uint8Array {
  const header = new TextEncoder().encode(
    JSON.stringify({
      schema: 'dotify.audio.v2',
      version: 1,
      algorithm: 'AES-256-GCM',
      mediaMime: 'audio/mpeg',
      chunkSize: plainLength,
      chunkCount: 1,
      plaintextLength: plainLength,
      contentHash: `0x${'11'.repeat(32)}`,
      noncePrefix: '22'.repeat(8),
      chunks: [{ index: 0, plainLength, encryptedLength: plainLength + 16 }]
    })
  );
  return new Uint8Array([...new TextEncoder().encode('DAV2'), ...uint32be(header.length), ...header]);
}

function rangeResult(bytes: Uint8Array): AudioV2RangeResult {
  return {
    bytes,
    gatewayUrl: `https://gateway.example/ipfs/${CID}`,
    elapsedMs: 20,
    fromCache: false,
    hedged: false,
    recovered: false
  };
}

describe('DAV2 intent prefetch', () => {
  afterEach(() => {
    cancelAudioV2TrackIntentPrefetch();
  });

  it('warms only the encrypted header and first chunk ranges', async () => {
    const prefix = dav2HeaderPrefix();
    const calls: Array<{ cid: string; start: number; end: number; phase: string }> = [];
    const fetchRange = vi.fn(async (cid: string, start: number, end: number, options: { phase: 'header' | 'first-chunk'; signal: AbortSignal }) => {
      calls.push({ cid, start, end, phase: options.phase });
      return rangeResult(options.phase === 'header' ? prefix : new Uint8Array(20).fill(5));
    });

    await prefetchAudioV2TrackIntent(AUDIO_REF, { fetchRange });

    expect(calls).toEqual([
      { cid: CID, start: 0, end: 65_535, phase: 'header' },
      { cid: CID, start: prefix.length, end: prefix.length + 19, phase: 'first-chunk' }
    ]);
  });

  it('ignores legacy encrypted refs instead of touching the network', async () => {
    const fetchRange = vi.fn();
    await prefetchAudioV2TrackIntent('dotify:enc:ipfs://QmLegacy', { fetchRange });
    expect(fetchRange).not.toHaveBeenCalled();
  });

  it('does not speculatively download an oversized first chunk', async () => {
    const prefix = dav2HeaderPrefix(800 * 1024);
    const fetchRange = vi.fn(async () => rangeResult(prefix));

    await prefetchAudioV2TrackIntent(AUDIO_REF, { fetchRange });

    expect(fetchRange).toHaveBeenCalledTimes(1);
    expect(fetchRange).toHaveBeenCalledWith(CID, 0, 65_535, expect.objectContaining({ phase: 'header' }));
  });

  it('evicts a transport-valid header range when DAV2 parsing rejects it', async () => {
    const malformed = new TextEncoder().encode('not-a-dav2-header');
    const fetchRange = vi.fn(async () => rangeResult(malformed));
    const evictRange = vi.fn();

    await expect(prefetchAudioV2TrackIntent(AUDIO_REF, { fetchRange, evictRange })).rejects.toThrow();

    expect(evictRange).toHaveBeenCalledWith(CID, 0, 65_535);
  });

  it('warms at most two distinct DAV2 neighbors sequentially, including Previous', async () => {
    const calls: string[] = [];
    const fetchRange = vi.fn(async (cid: string, _start: number, _end: number, { phase }: { phase: string }) => {
      calls.push(`${cid}:${phase}`);
      return rangeResult(phase === 'header' ? dav2HeaderPrefix() : new Uint8Array(20));
    });
    const previous = 'dotify:enc:v2:ipfs://QmPrevious';
    const stop = startAudioV2NeighborPrefetch([AUDIO_REF, AUDIO_REF, 'dotify:local:ignored', previous, 'dotify:enc:v2:ipfs://QmThird'], { fetchRange });
    await vi.waitFor(() => expect(calls).toHaveLength(4));
    expect(calls).toEqual([`${CID}:header`, `${CID}:first-chunk`, 'QmPrevious:header', 'QmPrevious:first-chunk']);
    stop();
  });

  it('promotes an in-flight neighbor on explicit intent without abort or duplicate fetch', async () => {
    let resolveHeader!: (result: AudioV2RangeResult) => void;
    let signal!: AbortSignal;
    const fetchRange = vi.fn(async (_cid: string, _start: number, _end: number, options: { phase: string; signal: AbortSignal }) => {
      signal = options.signal;
      if (options.phase === 'header')
        return new Promise<AudioV2RangeResult>(resolve => {
          resolveHeader = resolve;
        });
      return rangeResult(new Uint8Array(20));
    });
    const stop = startAudioV2NeighborPrefetch([AUDIO_REF, 'dotify:enc:v2:ipfs://QmPrevious'], { fetchRange });
    await vi.waitFor(() => expect(fetchRange).toHaveBeenCalledTimes(1));
    const intent = prefetchAudioV2TrackIntent(AUDIO_REF, { fetchRange });
    stop(); // React cleanup after the track selection must not abort the promoted job.
    expect(signal.aborted).toBe(false);
    resolveHeader(rangeResult(dav2HeaderPrefix()));
    await intent;
    expect(fetchRange).toHaveBeenCalledTimes(2);
    expect(fetchRange.mock.calls.every(([cid]) => cid === CID)).toBe(true);
  });

  it('cancels stale speculative work when another explicit target wins', async () => {
    let signal!: AbortSignal;
    const backgroundFetch = vi.fn((_cid: string, _start: number, _end: number, options: { signal: AbortSignal }) => {
      signal = options.signal;
      return new Promise<AudioV2RangeResult>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
      });
    });
    startAudioV2NeighborPrefetch([AUDIO_REF, 'dotify:enc:v2:ipfs://QmPrevious'], { fetchRange: backgroundFetch });
    await vi.waitFor(() => expect(backgroundFetch).toHaveBeenCalledTimes(1));
    const intentFetch = vi.fn(async (_cid: string, _start: number, _end: number, { phase }: { phase: string }) =>
      rangeResult(phase === 'header' ? dav2HeaderPrefix() : new Uint8Array(20))
    );
    await prefetchAudioV2TrackIntent('dotify:enc:v2:ipfs://QmChosen', { fetchRange: intentFetch });
    expect(signal.aborted).toBe(true);
    expect(backgroundFetch).toHaveBeenCalledTimes(1);
    expect(intentFetch).toHaveBeenCalledTimes(2);
  });

  it('still prepares Previous when Next fails, and does not surface a playback error', async () => {
    const fetchRange = vi.fn(async (cid: string, _start: number, _end: number, { phase }: { phase: string }) => {
      if (cid === CID) throw new Error('gateway unavailable');
      return rangeResult(phase === 'header' ? dav2HeaderPrefix() : new Uint8Array(20));
    });
    startAudioV2NeighborPrefetch([AUDIO_REF, 'dotify:enc:v2:ipfs://QmPrevious'], { fetchRange });
    await vi.waitFor(() => expect(fetchRange).toHaveBeenCalledTimes(3));
    expect(fetchRange.mock.calls[2][0]).toBe('QmPrevious');
  });
});
