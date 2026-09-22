import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUDIO_V2_HEDGE_DELAY_MS,
  AUDIO_V2_RANGE_ATTEMPTS_PER_GATEWAY,
  AUDIO_V2_RANGE_TIMEOUT_MS,
  clearAudioV2GatewayCache,
  evictAudioV2IntentRange,
  fetchAudioV2RangeThroughGateways,
  getCachedAudioV2Gateway,
  prefetchAudioV2RangeThroughGateways,
  retainAudioV2IntentRanges
} from './audioV2Gateway';

const CID = 'QmDav2Audio';
const PRIMARY = `https://primary.example/ipfs/${CID}`;
const FALLBACK = `https://fallback.example/ipfs/${CID}`;
const THIRD = `https://third.example/ipfs/${CID}`;

function rangeResponse(length: number, value = 1, contentRange?: string) {
  return new Response(new Uint8Array(length).fill(value), {
    status: 206,
    headers: contentRange ? { 'Content-Range': contentRange } : undefined
  });
}

describe('audioV2 gateway range fetching', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    clearAudioV2GatewayCache();
  });

  it('keeps the default range budget above cold Product gateway reads', () => {
    expect(AUDIO_V2_RANGE_TIMEOUT_MS).toBeGreaterThanOrEqual(12_000);
    expect(AUDIO_V2_HEDGE_DELAY_MS).toBeGreaterThanOrEqual(6_000);
    expect(AUDIO_V2_HEDGE_DELAY_MS).toBeLessThan(AUDIO_V2_RANGE_TIMEOUT_MS);
    expect(AUDIO_V2_RANGE_ATTEMPTS_PER_GATEWAY).toBeGreaterThanOrEqual(2);
  });

  it('retries a transient network failure on the same gateway before falling back', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(rangeResponse(9, 3));

    const result = await fetchAudioV2RangeThroughGateways(CID, 0, 8, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY, FALLBACK],
      hedge: false
    });

    expect(result.bytes).toEqual(new Uint8Array(9).fill(3));
    expect(result.gatewayUrl).toBe(PRIMARY);
    expect(result.recovered).toBe(false);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([PRIMARY, PRIMARY]);
  });

  it('falls back to the next gateway and caches the winner per CID', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('range unsupported', { status: 200 }))
      .mockResolvedValueOnce(rangeResponse(9, 9))
      .mockResolvedValueOnce(rangeResponse(4, 10));

    const first = await fetchAudioV2RangeThroughGateways(CID, 0, 8, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY, FALLBACK],
      hedge: false
    });

    expect(first.bytes).toEqual(new Uint8Array(9).fill(9));
    expect(first.gatewayUrl).toBe(FALLBACK);
    expect(first.recovered).toBe(true);
    expect(getCachedAudioV2Gateway(CID)).toBe(FALLBACK);

    const second = await fetchAudioV2RangeThroughGateways(CID, 9, 12, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY, FALLBACK],
      hedge: false
    });

    expect(second.bytes).toEqual(new Uint8Array(4).fill(10));
    expect(second.recovered).toBe(false);
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
      return Promise.resolve(rangeResponse(9, 7));
    });

    const result = await fetchAudioV2RangeThroughGateways(CID, 0, 8, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY, FALLBACK],
      phase: 'header',
      hedgeDelayMs: 0,
      timeoutMs: 1_000
    });

    expect(result.bytes).toEqual(new Uint8Array(9).fill(7));
    expect(result.gatewayUrl).toBe(FALLBACK);
    expect(result.hedged).toBe(true);
    expect(result.recovered).toBe(true);
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
      return Promise.resolve(rangeResponse(9, 5));
    });

    const resultPromise = fetchAudioV2RangeThroughGateways(CID, 0, 8, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY, FALLBACK, THIRD],
      hedge: false,
      timeoutMs: 250
    });

    await vi.advanceTimersByTimeAsync(250);
    const result = await resultPromise;

    expect(result.bytes).toEqual(new Uint8Array(9).fill(5));
    expect(result.gatewayUrl).toBe(FALLBACK);
  });

  it('stops gateway retries when the parent signal is aborted', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
        })
    );

    const resultPromise = fetchAudioV2RangeThroughGateways(CID, 0, 8, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY, FALLBACK, THIRD],
      hedge: false,
      signal: controller.signal
    });

    controller.abort();

    await expect(resultPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries another gateway when a chunk range is truncated', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(rangeResponse(2))
      .mockResolvedValueOnce(rangeResponse(3, 6, 'bytes 10-12/100'));

    const result = await fetchAudioV2RangeThroughGateways(CID, 10, 12, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY, FALLBACK],
      hedge: false
    });

    expect(result.bytes).toEqual(new Uint8Array(3).fill(6));
    expect(result.gatewayUrl).toBe(FALLBACK);
  });

  it('retries another gateway when Content-Range does not match the request', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(rangeResponse(3, 2, 'bytes 11-13/100'))
      .mockResolvedValueOnce(rangeResponse(3, 8, 'bytes 10-12/100'));

    const result = await fetchAudioV2RangeThroughGateways(CID, 10, 12, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY, FALLBACK],
      hedge: false
    });

    expect(result.bytes).toEqual(new Uint8Array(3).fill(8));
    expect(result.gatewayUrl).toBe(FALLBACK);
  });

  it('accepts a short header range when the response reaches the end of the object', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(rangeResponse(40, 4, 'bytes 0-39/40'));

    const result = await fetchAudioV2RangeThroughGateways(CID, 0, 65_535, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY],
      phase: 'header'
    });

    expect(result.bytes).toHaveLength(40);
  });

  it('reuses a short-lived encrypted intent range without another network request', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(rangeResponse(9, 4, 'bytes 0-8/100'));

    await prefetchAudioV2RangeThroughGateways(CID, 0, 8, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY],
      phase: 'header',
      hedge: false
    });
    const playbackRange = await fetchAudioV2RangeThroughGateways(CID, 0, 8, {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY],
      phase: 'header',
      hedge: false
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(playbackRange.bytes).toEqual(new Uint8Array(9).fill(4));
    expect(playbackRange.intentPrefetched).toBe(true);
    expect(playbackRange.elapsedMs).toBe(0);
  });

  it('does not reuse an intent range after semantic validation evicts it', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(rangeResponse(9, 4, 'bytes 0-8/100'))
      .mockResolvedValueOnce(rangeResponse(9, 7, 'bytes 0-8/100'));
    const options = {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY],
      phase: 'header' as const,
      hedge: false
    };

    await prefetchAudioV2RangeThroughGateways(CID, 0, 8, options);
    evictAudioV2IntentRange(CID, 0, 8);
    const playbackRange = await fetchAudioV2RangeThroughGateways(CID, 0, 8, options);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(playbackRange.bytes).toEqual(new Uint8Array(9).fill(7));
    expect(playbackRange.intentPrefetched).toBe(false);
  });

  it('lets playback share an in-flight intent range', async () => {
    let resolveResponse!: (response: Response) => void;
    const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>(resolve => (resolveResponse = resolve)));
    const options = {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY],
      phase: 'first-chunk' as const,
      hedge: false
    };

    const prefetch = prefetchAudioV2RangeThroughGateways(CID, 10, 12, options);
    const playback = fetchAudioV2RangeThroughGateways(CID, 10, 12, options);
    resolveResponse(rangeResponse(3, 7, 'bytes 10-12/100'));

    const [, playbackRange] = await Promise.all([prefetch, playback]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(playbackRange.intentPrefetched).toBe(true);
    expect(playbackRange.bytes).toEqual(new Uint8Array(3).fill(7));
  });

  it('does not retain a speculative range larger than the memory budget', async () => {
    const length = 3 * 1024 * 1024 + 1;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(rangeResponse(length, 2)));
    const options = {
      fetchImpl: fetchMock,
      getGatewayUrlsForCid: () => [PRIMARY],
      phase: 'first-chunk' as const,
      hedge: false
    };

    const release = retainAudioV2IntentRanges([CID]);
    await prefetchAudioV2RangeThroughGateways(CID, 0, length - 1, options);
    const playbackRange = await fetchAudioV2RangeThroughGateways(CID, 0, length - 1, options);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(playbackRange.intentPrefetched).toBe(false);
    release();
  });

  it('keeps an active neighbor through a long track, then restores ordinary expiration', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(rangeResponse(9, 4, 'bytes 0-8/100')));
    const options = { fetchImpl: fetchMock, getGatewayUrlsForCid: () => [PRIMARY], hedge: false };
    const release = retainAudioV2IntentRanges([CID]);
    await prefetchAudioV2RangeThroughGateways(CID, 0, 8, options);
    await vi.advanceTimersByTimeAsync(300_000);
    expect((await fetchAudioV2RangeThroughGateways(CID, 0, 8, options)).intentPrefetched).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(90_001);
    expect((await fetchAudioV2RangeThroughGateways(CID, 0, 8, options)).intentPrefetched).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
