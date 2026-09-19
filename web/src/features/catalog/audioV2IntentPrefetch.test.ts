import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelAudioV2TrackIntentPrefetch, prefetchAudioV2TrackIntent } from './audioV2IntentPrefetch';
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
    hedged: false
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
});
