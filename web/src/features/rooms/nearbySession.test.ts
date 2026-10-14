import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoomRealtimePort, RoomRequests } from './roomRealtimePort';
import { NearbySession } from './nearbySession';
import { coarseNearbyCell, NEARBY_TTL_MS } from '../../../shared/nearby-v2.mjs';

const cell = coarseNearbyCell(0, 0)!;
const manual = { kind: 'manual' as const, cell };
function harness(host = false, enabled = true) {
  const events: { event: string; input: unknown }[] = [];
  let permissionState = 'granted';
  const permission = {
    get state() {
      return permissionState;
    },
    onchange: null as null | (() => void)
  };
  const locate = vi.fn(async (_signal: AbortSignal) => cell);
  const port = {
    connected: true,
    request: (event: string, input: unknown, _opts: unknown, reply: (error: null, value: unknown) => void) => {
      events.push({ event, input });
      reply(null, event === 'nearby:search' ? { ok: true, schemaVersion: 2, expiresInMs: 30_000, results: [] } : { ok: true, expiresInMs: NEARBY_TTL_MS });
    }
  };
  const session = new NearbySession(port as RoomRealtimePort, host, enabled, {
    visible: () => true,
    supported: () => true,
    locate,
    permission: async () => permission as unknown as PermissionStatus
  });
  return {
    session,
    port,
    events,
    locate,
    revoke: () => {
      permissionState = 'denied';
      permission.onchange?.();
    }
  };
}
afterEach(() => vi.useRealTimers());

describe('nearby consent and lifecycle', () => {
  it('feature-off never locates, searches or publishes', async () => {
    const f = harness(true, false);
    await f.session.start({ kind: 'device' }, 5);
    await f.session.start(manual, 5);
    expect(f.locate).not.toHaveBeenCalled();
    expect(f.events).toEqual([]);
  });
  it('keeps manual lookup wallet-free and drops coordinates before the wire', async () => {
    const f = harness();
    await f.session.start(manual, 5);
    expect(f.locate).not.toHaveBeenCalled();
    expect(f.events).toEqual([{ event: 'nearby:search', input: { schemaVersion: 2, cell, radiusKm: 5 } }]);
    f.session.stop();
  });
  it('aborts an outstanding fix and ignores its late callback after stop', async () => {
    const f = harness(true);
    let resolve!: (cell: string) => void;
    let signal!: AbortSignal;
    f.locate.mockImplementation(async value => {
      signal = value;
      return new Promise(done => {
        resolve = done;
      });
    });
    const pending = f.session.start({ kind: 'device' }, 5);
    await Promise.resolve();
    f.session.stop();
    expect(signal.aborted).toBe(true);
    resolve(cell);
    await pending;
    expect(f.events.some(item => item.event === 'nearby:publish')).toBe(false);
  });
  it('revocation removes host presence, clears results and stops refresh without auto-resume', async () => {
    vi.useFakeTimers();
    const f = harness(true);
    await f.session.start({ kind: 'device' }, 5);
    expect(f.session.snapshot().phase).toBe('active');
    f.revoke();
    await Promise.resolve();
    expect(f.session.snapshot().phase).toBe('denied');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(f.events.filter(item => item.event === 'nearby:publish')).toHaveLength(1);
    expect(f.events[f.events.length - 1]?.event).toBe('nearby:off');
  });
  it('offline opt-out clears local state and explains the bounded remote expiry', async () => {
    const f = harness(true);
    await f.session.start(manual, 5);
    f.port.connected = false;
    f.session.stop();
    await Promise.resolve();
    await Promise.resolve();
    expect(f.session.snapshot().phase).toBe('off');
    expect(f.session.snapshot().message).toContain('90 seconds');
    expect(f.session.snapshot().results).toEqual([]);
  });
  it('late acknowledgement cannot reactivate stopped consent', async () => {
    const f = harness();
    let resolve!: (error: null, value: RoomRequests['nearby:search']['output']) => void;
    f.port.request = (_event, _input, _opts, cb) => {
      resolve = cb;
    };
    const pending = f.session.start(manual, 5);
    f.session.stop();
    resolve(null, { ok: true, schemaVersion: 2, expiresInMs: 30_000, results: [] });
    await pending;
    expect(f.session.snapshot().phase).toBe('off');
  });
});
