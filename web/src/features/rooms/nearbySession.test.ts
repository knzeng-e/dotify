import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoomRealtimePort, RoomRequests } from './roomRealtimePort';
import { NearbySession } from './nearbySession';
import { coarseNearbyCell, NEARBY_TTL_MS } from '../../../shared/nearby-v2.mjs';
import { io } from 'socket.io-client';
import { adaptSocketRealtime } from './signalClient';

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
    vi.useFakeTimers();
    const f = harness(true);
    await f.session.start(manual, 5);
    f.port.connected = false;
    f.session.stop();
    await Promise.resolve();
    await Promise.resolve();
    expect(f.session.snapshot().phase).toBe('off');
    expect(f.session.snapshot().message).toContain('90 seconds');
    expect(f.session.snapshot().results).toEqual([]);
    expect(f.events.filter(item => item.event === 'nearby:off')).toHaveLength(0);
    f.port.connected = true;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(f.events.map(item => item.event)).toEqual(['nearby:publish']);
  });
  it.each(['opt-out', 'permission revocation', 'background'] as const)('delivers %s during connected polling backpressure', async reason => {
    vi.useFakeTimers();
    const socket = io('http://localhost', { autoConnect: false, forceNew: true });
    socket.connected = true;
    const transport = { name: 'polling', writable: true };
    Object.defineProperty(socket.io, 'engine', { value: { transport, _hasPingExpired: () => false } });
    const packet = vi.spyOn(socket.io, '_packet').mockImplementation(() => undefined);
    const permission = { state: 'granted', onchange: null as null | (() => void) };
    const session = new NearbySession(adaptSocketRealtime(socket), true, true, {
      visible: () => true,
      supported: () => true,
      locate: async () => cell,
      permission: async () => permission as unknown as PermissionStatus
    });
    const pending = session.start({ kind: 'device' }, 5);
    await Promise.resolve();
    await Promise.resolve();
    const publication = packet.mock.calls[0][0];
    expect(publication.data[0]).toBe('nearby:publish');
    if (publication.id === undefined) throw new Error('Publication acknowledgement missing');
    Reflect.get(socket, 'acks')[publication.id](null, { ok: true, expiresInMs: NEARBY_TTL_MS });
    await pending;
    transport.writable = false;
    if (reason === 'permission revocation') {
      permission.state = 'denied';
      permission.onchange?.();
    } else session.stop(reason === 'background' ? 'Nearby paused while you were away.' : '');
    expect(packet).toHaveBeenCalledTimes(2);
    const revocation = packet.mock.calls[1][0];
    expect(revocation.data).toEqual(['nearby:off', {}]);
    expect(socket.sendBuffer).toHaveLength(0);
    if (revocation.id === undefined) throw new Error('Revocation acknowledgement missing');
    Reflect.get(socket, 'acks')[revocation.id](null, { ok: true });
    await Promise.resolve();
    expect(session.snapshot().phase).toBe(reason === 'permission revocation' ? 'denied' : 'off');
    expect(session.snapshot().message).not.toContain('90 seconds');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(packet).toHaveBeenCalledTimes(2);
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
