import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchThroughGateways } from './gatewayRace';

const FIRST = 'https://first.example/ipfs/QmTest';
const SECOND = 'https://second.example/ipfs/QmTest';
const THIRD = 'https://third.example/ipfs/QmTest';

/** A fetch that never settles until the attempt's own signal aborts. */
function stalledFetch(): Promise<Response> {
  return new Promise<Response>(() => {});
}

function abortableStall(signal: AbortSignal | undefined): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
}

describe('fetchThroughGateways', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns the first gateway response without touching the others', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'));

    const response = await fetchThroughGateways([FIRST, SECOND, THIRD], { fetchImpl: fetchMock });

    expect(await response.text()).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(FIRST);
  });

  it('advances to the next gateway when one fails outright', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('dns failure')).mockResolvedValueOnce(new Response('second wins'));

    const response = await fetchThroughGateways([FIRST, SECOND], { fetchImpl: fetchMock });

    expect(await response.text()).toBe('second wins');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats a non-ok status as a failed gateway', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('nope', { status: 504 }))
      .mockResolvedValueOnce(new Response('recovered'));

    const response = await fetchThroughGateways([FIRST, SECOND], { fetchImpl: fetchMock });

    expect(await response.text()).toBe('recovered');
  });

  it('hedges onto the next gateway when the first one stalls, and does not wait for it', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() => stalledFetch())
      .mockResolvedValueOnce(new Response('hedge wins'));

    const pending = fetchThroughGateways([FIRST, SECOND], { fetchImpl: fetchMock, hedgeDelayMs: 1_000 });

    await vi.advanceTimersByTimeAsync(1_000);
    const response = await pending;

    expect(await response.text()).toBe('hedge wins');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('aborts a stalled gateway once the timeout budget elapses', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce((_url, init) => abortableStall(init?.signal ?? undefined))
      .mockResolvedValueOnce(new Response('after timeout'));

    const pending = fetchThroughGateways([FIRST, SECOND], {
      fetchImpl: fetchMock,
      timeoutMs: 500,
      // Hedging disabled by pushing it past the timeout, so this proves the
      // timeout alone releases the queue.
      hedgeDelayMs: 10_000
    });

    await vi.advanceTimersByTimeAsync(500);
    const response = await pending;

    expect(await response.text()).toBe('after timeout');
  });

  it('aborts the losing attempts but leaves the winner readable', async () => {
    vi.useFakeTimers();
    const signals: Array<AbortSignal | undefined> = [];
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce((_url, init) => {
        signals.push(init?.signal ?? undefined);
        return abortableStall(init?.signal ?? undefined);
      })
      .mockImplementationOnce((_url, init) => {
        signals.push(init?.signal ?? undefined);
        return Promise.resolve(new Response('winner body'));
      });

    const pending = fetchThroughGateways([FIRST, SECOND], { fetchImpl: fetchMock, hedgeDelayMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    const response = await pending;

    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(await response.text()).toBe('winner body');
  });

  it('keeps the winner cancellable after it is returned', async () => {
    // The body streams after headers arrive, so a caller that cancels then -
    // a listener skipping to another track - must still stop the download.
    let winnerSignal: AbortSignal | undefined;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
      winnerSignal = init?.signal ?? undefined;
      return Promise.resolve(new Response('winner body'));
    });
    const controller = new AbortController();

    await fetchThroughGateways([FIRST], { fetchImpl: fetchMock, signal: controller.signal });

    expect(winnerSignal?.aborted).toBe(false);
    controller.abort();
    expect(winnerSignal?.aborted).toBe(true);
  });

  it('surfaces the last error when every gateway fails', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('first down')).mockRejectedValueOnce(new Error('second down'));

    await expect(fetchThroughGateways([FIRST, SECOND], { fetchImpl: fetchMock })).rejects.toThrow('second down');
  });

  it('rejects an empty gateway list rather than hanging', async () => {
    await expect(fetchThroughGateways([], { label: 'cover image' })).rejects.toThrow('No gateways configured for cover image');
  });

  it('honours a caller abort signal that fires before the read starts', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn<typeof fetch>();

    await expect(fetchThroughGateways([FIRST], { fetchImpl: fetchMock, signal: controller.signal })).rejects.toThrow(/cancelled/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propagates a caller abort that fires mid-flight', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_url, init) => abortableStall(init?.signal ?? undefined));

    const pending = fetchThroughGateways([FIRST], { fetchImpl: fetchMock, signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toThrow();
  });

  it('does not walk the remaining gateways after a caller abort', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_url, init) => abortableStall(init?.signal ?? undefined));

    const pending = fetchThroughGateways([FIRST, SECOND, THIRD], { fetchImpl: fetchMock, signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
