import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostInfoReader, sanitizeHostSoftwareObservation } from './productHostInfo';

const info = { platform: 'Desktop', name: 'Polkadot Desktop Dev', version: '0.1.4-rc.3' };
const freshSignal = () => new AbortController().signal;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
function response(value: unknown) {
  return { match: async (ok: (value: unknown) => void) => ok(value) };
}
afterEach(() => vi.useRealTimers());

describe('Host software report allowlist', () => {
  it('owns only bounded public software fields and strips unrelated data', () => {
    expect(sanitizeHostSoftwareObservation({ status: 'reported', ...info, account: 'PRIVATE', permissions: ['PRIVATE'], payment: 'PRIVATE' })).toEqual({
      status: 'reported',
      ...info
    });
    expect(sanitizeHostSoftwareObservation({ status: 'timeout', name: 'PRIVATE' })).toEqual({ status: 'timeout' });
  });
  it.each([{ platform: 'Wallet' }, { name: '' }, { name: 'https://private.example' }, { version: 'x'.repeat(81) }, { name: 'Host\nPRIVATE' }, { version: 26 }])(
    'rejects malformed or unbounded labels: %j',
    change => {
      expect(sanitizeHostSoftwareObservation({ status: 'reported', ...info, ...change })).toBeUndefined();
    }
  );
  it('does not invent a report from unknown status or incomplete response', () => {
    expect(sanitizeHostSoftwareObservation({ status: 'supported', ...info })).toBeUndefined();
    expect(sanitizeHostSoftwareObservation({ status: 'reported' })).toBeUndefined();
  });
});

describe('bounded non-spending Host info read', () => {
  it('calls only system.info with its own cancellable signal', async () => {
    const read = vi.fn(({ signal }: { signal: AbortSignal }) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return response({ ...info, account: 'PRIVATE' });
    });
    const loader = vi.fn(async () => ({ info: read }));
    expect(await createHostInfoReader(loader)(freshSignal())).toEqual({ status: 'reported', ...info });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0]).toHaveLength(1);
    expect(read.mock.calls[0][0]).toEqual({ signal: expect.any(AbortSignal) });
  });
  it('leaves absent or rejected optional information unavailable, without raw errors', async () => {
    expect(await createHostInfoReader(async () => null)(freshSignal())).toEqual({ status: 'unavailable' });
    expect(
      await createHostInfoReader(async () => {
        throw Error('PRIVATE');
      })(freshSignal())
    ).toEqual({ status: 'unavailable' });
    const denied = createHostInfoReader(async () => ({ info: () => ({ match: async (_ok, error) => error('PRIVATE') }) }));
    expect(await denied(freshSignal())).toEqual({ status: 'unavailable' });
    const broken = createHostInfoReader(async () => ({
      info: () => {
        throw Error('PRIVATE');
      }
    }));
    expect(await broken(freshSignal())).toEqual({ status: 'unavailable' });
  });
  it('does not traverse unrelated Host response fields before allowlisting', async () => {
    const raw = { ...info };
    Object.defineProperty(raw, 'privatePayload', {
      enumerable: true,
      get: () => {
        throw Error('PRIVATE');
      }
    });
    const read = createHostInfoReader(async () => ({ info: () => response(raw) }));
    expect(await read(freshSignal())).toEqual({ status: 'reported', ...info });
  });
  it('treats malformed Host data as unavailable', async () => {
    const read = createHostInfoReader(async () => ({ info: () => response({ ...info, platform: 'secret' }) }));
    expect(await read(freshSignal())).toEqual({ status: 'unavailable' });
  });
  it('does not load the SDK for a read already cancelled', async () => {
    const loader = vi.fn(async () => null);
    const controller = new AbortController();
    controller.abort();
    expect(await createHostInfoReader(loader)(controller.signal)).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });
  it('bounds an unresponsive loader and never calls info after its deadline', async () => {
    vi.useFakeTimers();
    const load = deferred<{ info: (options: { signal: AbortSignal }) => ReturnType<typeof response> }>();
    const infoCall = vi.fn(() => response(info));
    const read = createHostInfoReader(() => load.promise);
    const first = read(freshSignal());
    await vi.advanceTimersByTimeAsync(1500);
    expect(await first).toEqual({ status: 'timeout' });
    // No queue or new work while the original SDK lookup is still outstanding.
    expect(await read(freshSignal())).toEqual({ status: 'unavailable' });
    load.resolve({ info: infoCall });
    await vi.runAllTimersAsync();
    expect(infoCall).not.toHaveBeenCalled();
  });
  it('cancels only its own request on timeout, keeps one slot until settlement and ignores late success', async () => {
    vi.useFakeTimers();
    const reply = deferred<unknown>();
    let signal: AbortSignal | undefined;
    const loader = vi.fn(async () => ({
      info: (options: { signal: AbortSignal }) => {
        signal = options.signal;
        return { match: async (ok: (value: unknown) => void) => ok(await reply.promise) };
      }
    }));
    const read = createHostInfoReader(loader);
    const first = read(freshSignal());
    await vi.advanceTimersByTimeAsync(1500);
    expect(await first).toEqual({ status: 'timeout' });
    expect(signal?.aborted).toBe(true);
    expect(await read(freshSignal())).toEqual({ status: 'unavailable' });
    expect(loader).toHaveBeenCalledTimes(1);
    reply.resolve(info);
    await vi.runAllTimersAsync();
    const second = read(freshSignal());
    await vi.runAllTimersAsync();
    expect(await second).toEqual({ status: 'reported', ...info });
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it('prevents a closed About read from calling info after a delayed SDK lookup', async () => {
    const load = deferred<{ info: (options: { signal: AbortSignal }) => ReturnType<typeof response> }>();
    const infoCall = vi.fn(() => response(info));
    const controller = new AbortController();
    const read = createHostInfoReader(() => load.promise);
    const pending = read(controller.signal);
    await Promise.resolve();
    controller.abort();
    expect(await pending).toBeNull();
    load.resolve({ info: infoCall });
    await Promise.resolve();
    await Promise.resolve();
    expect(infoCall).not.toHaveBeenCalled();
  });
});
