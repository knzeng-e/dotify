import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeData, MAX_STATEMENT_SIZE, MAX_USER_TOTAL } from '@parity/product-sdk-statement-store';
import { createCelerityBudget, createPresenceReceiver, parsePresenceEnvelope, presenceEnvelope } from './celerityEnvelope';
import { celerityMode, startCelerityObservation } from './celerityObservation';
import type { CelerityClient, ObservationStatement } from './celeritySdk';
import type { CelerityMetric } from './celerityDiagnostics';

const now = 1_800_000_000_000;
const producer = '1234567890abcdef1234567890abcdef';
const envelope = (seq = 1) => presenceEnvelope('ABC123', producer, seq, 2, now);
const expiry = (ms: number) => BigInt(Math.floor(ms / 1000)) << 32n;

afterEach(() => {
  vi.useRealTimers();
});

describe('Celerity presence boundary', () => {
  it('fits the actual pinned SDK encoding and enforces the SDK byte limit', () => {
    const event = presenceEnvelope('ABCDEFGHIJKL', producer, Number.MAX_SAFE_INTEGER, 9999, now);
    expect(encodeData(event).length).toBeLessThanOrEqual(MAX_STATEMENT_SIZE);
    expect(() => encodeData({ text: 'é'.repeat(256) })).toThrow();
    expect(MAX_USER_TOTAL).toBe(1024);
    expect(parsePresenceEnvelope(event, event.room, now, expiry(event.expires))).toEqual(event);
  });

  it.each([
    { kind: 'chat', payload: { text: 'private chat' } },
    { payload: { listeners: 2, sdp: 'private signaling' } },
    { contentKey: 'secret' },
    { audioRef: 'ipfs://private' },
    { room: 'OTHER1' },
    { v: 2 },
    { pv: 2 },
    { seq: 0 },
    { id: 'forged' },
    { producer: '0xwallet' },
    { payload: { listeners: -1 } },
    { payload: { listeners: 0.5 } },
    { payload: { listeners: 10000 } },
    { created: now + 6000, expires: now + 36000 },
    { expires: now + 60000 }
  ])('refuses unknown/private or invalid data: %j', change => {
    expect(parsePresenceEnvelope({ ...envelope(), ...change }, 'ABC123', now, expiry(now + 30000))).toBeNull();
  });

  it('requires both envelope and transport expiry, and rejects a stale replay', () => {
    const event = envelope();
    expect(parsePresenceEnvelope(event, 'ABC123', now, undefined)).toBeNull();
    expect(parsePresenceEnvelope(event, 'ABC123', now, expiry(now + 60000))).toBeNull();
    expect(parsePresenceEnvelope(event, 'ABC123', event.expires, expiry(event.expires))).toBeNull();
  });

  it('converges to the newest sequence without claiming gaps are packet loss', () => {
    const receive = createPresenceReceiver(1);
    expect(receive(envelope(1), now)).toEqual({ status: 'accepted', gap: 0, ageMs: 0 });
    expect(receive(envelope(4), now + 20)).toEqual({ status: 'accepted', gap: 2, ageMs: 20 });
    expect(receive(envelope(3), now + 21)).toEqual({ status: 'reordered' });
    expect(receive(envelope(4), now + 21)).toEqual({ status: 'duplicate' });
    const second = { ...envelope(), producer: 'a'.repeat(32) };
    expect(receive(second, now + 100)).toEqual({ status: 'capacity' });
    expect(receive({ ...second, created: now + 36000, expires: now + 66000 }, now + 36000).status).toBe('accepted');
  });

  it('reserves uncertain submissions across room changes until expiry, with beacon headroom', () => {
    const budget = createCelerityBudget();
    expect(budget.reserve('room-a', 300, now + 30000, now, MAX_USER_TOTAL, MAX_STATEMENT_SIZE)).toBe(true);
    expect(budget.reserve('room-b', 300, now + 30000, now, MAX_USER_TOTAL, MAX_STATEMENT_SIZE)).toBe(false);
    expect(budget.reserve('room-a', 310, now + 40000, now, MAX_USER_TOTAL, MAX_STATEMENT_SIZE)).toBe(true);
    expect(budget.reserve('room-b', 300, now + 70000, now + 40000, MAX_USER_TOTAL, MAX_STATEMENT_SIZE)).toBe(true);
  });

  it('does not reclaim a larger live statement when a smaller replacement may fail', () => {
    const budget = createCelerityBudget();
    expect(budget.reserve('private-pair', 500, now + 30000, now, MAX_USER_TOTAL, MAX_STATEMENT_SIZE)).toBe(true);
    expect(budget.reserve('private-pair', 100, now + 10000, now, MAX_USER_TOTAL, MAX_STATEMENT_SIZE)).toBe(true);
    expect(budget.reserve('presence', 200, now + 30000, now + 11000, MAX_USER_TOTAL, MAX_STATEMENT_SIZE)).toBe(false);
    expect(budget.reserve('presence', 200, now + 60000, now + 31000, MAX_USER_TOTAL, MAX_STATEMENT_SIZE)).toBe(true);
  });
});

function harness(mode: 'off' | 'observe' | 'dual' = 'dual', isHosting = true) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  let receive!: (statement: ObservationStatement) => void;
  let interrupt!: () => void;
  const report = vi.fn<(metric: CelerityMetric) => void>();
  const client: CelerityClient = {
    encode: encodeData,
    maxStatementBytes: MAX_STATEMENT_SIZE,
    maxAccountBytes: MAX_USER_TOTAL,
    channel: (room, id) => `${room}/${id}`,
    publish: vi.fn(async () => true),
    stop: vi.fn()
  };
  const createClient = vi.fn(async (_room: string, incoming: typeof receive, failed: typeof interrupt) => {
    receive = incoming;
    interrupt = failed;
    return client;
  });
  const options = { room: 'ABC123', mode, isHosting, listeners: () => 2 };
  const deps = { createClient, producer: () => producer, report, budget: createCelerityBudget() };
  return {
    client,
    createClient,
    report,
    options,
    deps,
    receive: (data: unknown) => receive({ data, expiry: expiry(now + 30000), channel: client.channel('ABC123', producer) }),
    interrupt: () => interrupt()
  };
}

describe('Celerity observation lifecycle', () => {
  it('is inert when disabled, including unrecognized configuration', () => {
    const h = harness('off');
    startCelerityObservation(h.options, h.deps)();
    expect(h.createClient).not.toHaveBeenCalled();
    expect(celerityMode('enabled')).toBe('off');
  });

  it.each([
    ['observe', true],
    ['dual', false]
  ] as const)('never publishes for %s / host=%s', async (mode, host) => {
    const h = harness(mode, host);
    const stop = startCelerityObservation(h.options, h.deps);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.client.publish).not.toHaveBeenCalled();
    h.receive(envelope());
    h.receive(envelope());
    expect(h.report).toHaveBeenCalledWith(expect.objectContaining({ event: 'accepted' }));
    expect(h.report).toHaveBeenCalledWith(expect.objectContaining({ event: 'duplicate' }));
    await vi.advanceTimersByTimeAsync(40000);
    expect(h.client.publish).not.toHaveBeenCalled();
    stop();
  });

  it('publishes only aggregate presence, refreshes a single channel and tears down', async () => {
    const h = harness();
    const stop = startCelerityObservation(h.options, h.deps);
    await vi.advanceTimersByTimeAsync(10000);
    expect(h.client.publish).toHaveBeenCalledTimes(2);
    expect(h.client.publish).toHaveBeenLastCalledWith(presenceEnvelope('ABC123', producer, 2, 2, now + 10000));
    stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(h.client.publish).toHaveBeenCalledTimes(2);
    expect(h.client.stop).toHaveBeenCalledOnce();
  });

  it('keeps late initialization from publishing after leave or a room switch', async () => {
    const h = harness();
    let resolve!: (client: CelerityClient) => void;
    h.createClient.mockImplementation(
      () =>
        new Promise(done => {
          resolve = done;
        })
    );
    const stop = startCelerityObservation(h.options, h.deps);
    stop();
    resolve(h.client);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.client.publish).not.toHaveBeenCalled();
    expect(h.client.stop).toHaveBeenCalledOnce();
  });

  it('does not count the publisher own echo as a remote observation', async () => {
    const h = harness();
    const stop = startCelerityObservation(h.options, h.deps);
    await vi.advanceTimersByTimeAsync(0);
    h.receive(envelope());
    expect(h.report).toHaveBeenCalledWith(expect.objectContaining({ event: 'self-echo' }));
    expect(h.report).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'accepted' }));
    stop();
  });

  it('stops on a synchronous subscription failure during startup and disposes the late client', async () => {
    const h = harness();
    h.createClient.mockImplementation(async (_room, _receive, interrupted) => {
      interrupted();
      return h.client;
    });
    startCelerityObservation(h.options, h.deps);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.client.stop).toHaveBeenCalledOnce();
    expect(h.client.publish).not.toHaveBeenCalled();
    expect(h.report).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'ready' }));
  });

  it('reserves a rejected submit until expiry and reports the rejection', async () => {
    const h = harness();
    vi.mocked(h.client.publish).mockResolvedValue(false);
    const stop = startCelerityObservation(h.options, h.deps);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.report).toHaveBeenCalledWith(expect.objectContaining({ event: 'rejected' }));
    expect(h.deps.budget.reserve('other-room', 512, now + 30000, now, MAX_USER_TOTAL, MAX_STATEMENT_SIZE)).toBe(false);
    stop();
  });

  it('keeps observing after a hanging submit without retrying or claiming its late result', async () => {
    const h = harness();
    let resolve!: (ok: boolean) => void;
    vi.mocked(h.client.publish).mockImplementation(
      () =>
        new Promise(done => {
          resolve = done;
        })
    );
    startCelerityObservation(h.options, h.deps);
    await vi.advanceTimersByTimeAsync(8000);
    expect(h.client.publish).toHaveBeenCalledOnce();
    expect(h.client.stop).not.toHaveBeenCalled();
    expect(h.report).toHaveBeenCalledWith(expect.objectContaining({ event: 'timeout' }));
    resolve(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.report).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'submitted' }));
    vi.mocked(h.client.publish).mockResolvedValue(true);
    await vi.advanceTimersByTimeAsync(10000);
    expect(h.client.publish).toHaveBeenCalledTimes(2);
    expect(h.report).toHaveBeenCalledWith(expect.objectContaining({ event: 'submitted' }));
  });

  it('reports interruptions and ignores subsequent callbacks', async () => {
    const h = harness('observe');
    startCelerityObservation(h.options, h.deps);
    await vi.advanceTimersByTimeAsync(0);
    h.interrupt();
    h.receive(envelope());
    expect(h.report).toHaveBeenCalledWith(expect.objectContaining({ event: 'interrupted' }));
    expect(h.report).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'accepted' }));
  });

  it('rejects foreign-room and private data without recording their contents', async () => {
    const h = harness('observe');
    const stop = startCelerityObservation(h.options, h.deps);
    await vi.advanceTimersByTimeAsync(0);
    h.receive({ ...envelope(), room: 'OTHER1' });
    h.receive({ ...envelope(), payload: { listeners: 2, text: 'private' } });
    expect(h.report.mock.calls.filter(([event]) => event.event === 'invalid')).toHaveLength(2);
    expect(JSON.stringify(h.report.mock.calls)).not.toContain('private');
    stop();
  });

  it('degrades on unavailable Product without requiring a local signer', async () => {
    const h = harness();
    h.createClient.mockRejectedValue(new Error('Host unavailable'));
    startCelerityObservation(h.options, h.deps);
    await vi.advanceTimersByTimeAsync(30000);
    expect(h.client.publish).not.toHaveBeenCalled();
    expect(h.report).toHaveBeenCalledWith(expect.objectContaining({ event: 'unavailable' }));
  });
});
