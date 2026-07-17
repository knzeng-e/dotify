import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAudioV2GatewayCache, fetchAudioV2RangeThroughGateways, getCachedAudioV2Gateway } from './audioV2Gateway';

const CID = 'QmDav2Audio';
const PRIMARY = `https://primary.example/ipfs/${CID}`;
const FALLBACK = `https://fallback.example/ipfs/${CID}`;
const THIRD = `https://third.example/ipfs/${CID}`;

function rangeResponse(bytes: number[] = [1, 2, 3]) {
  return new Response(new Uint8Array(bytes), { status: 206 });
}

describe('audioV2 gateway range fetching', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    clearAudioV2GatewayCache();
  });

  it('falls back to the next gateway and caches the winner per CID', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('range unsupported', { status: 200 }))
      .mockResolvedValueOnce(rangeResponse([9]))
      .mockResolvedValueOnce(rangeResponse([10]));

    const first = await fetchAudioV2RangeThroughGateways(CID, 0, 8, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY, FALLBACK],
      hedge: false
    });

    expect(first.bytes).toEqual(new Uint8Array([9]));
    expect(first.gatewayUrl).toBe(FALLBACK);
    expect(getCachedAudioV2Gateway(CID)).toBe(FALLBACK);

    const second = await fetchAudioV2RangeThroughGateways(CID, 9, 12, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY, FALLBACK],
      hedge: false
    });

    expect(second.bytes).toEqual(new Uint8Array([10]));
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([PRIMARY, FALLBACK, FALLBACK]);
  });

  it('hedges a stalled header request and aborts the loser after a gateway wins', async () => {
    let primarySignal: AbortSignal | undefined;
    const fetchMock = vi.fn<typeof fetch>((url, init) => {
      if (url === PRIMARY) {
        primarySignal = init?.signal ?? undefined;
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
        });
      }
      return Promise.resolve(rangeResponse([7]));
    });

    const result = await fetchAudioV2RangeThroughGateways(CID, 0, 8, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY, FALLBACK],
      phase: 'header',
      hedgeDelayMs: 0,
      timeoutMs: 1_000
    });

    expect(result.bytes).toEqual(new Uint8Array([7]));
    expect(result.gatewayUrl).toBe(FALLBACK);
    expect(result.hedged).toBe(true);
    expect(primarySignal?.aborted).toBe(true);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([PRIMARY, FALLBACK]);
  });

  it('bounds a stalled range before trying the next gateway when hedging is disabled', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>((url, init) => {
      if (url === PRIMARY) {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('timed out', 'AbortError')), { once: true });
        });
      }
      return Promise.resolve(rangeResponse([5]));
    });

    const resultPromise = fetchAudioV2RangeThroughGateways(CID, 0, 8, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY, FALLBACK, THIRD],
      hedge: false,
      timeoutMs: 250
    });

    await vi.advanceTimersByTimeAsync(250);
    const result = await resultPromise;

    expect(result.bytes).toEqual(new Uint8Array([5]));
    expect(result.gatewayUrl).toBe(FALLBACK);
  });
});
