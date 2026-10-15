import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoomRealtimePort, RoomRequests } from './roomRealtimePort';
import { NearbySession } from './nearbySession';
import { coarseNearbyCell, NEARBY_TTL_MS } from '../../../shared/nearby-v2.mjs';
import { io } from 'socket.io-client';
import { adaptSocketRealtime } from './signalClient';
import type { NearbyResult } from './nearbyTypes';

const cell = coarseNearbyCell(0, 0)!;
const manual = { kind: 'manual' as const, cell };
function harness(host = false, enabled = true, options: { authorize?: (signal: AbortSignal) => Promise<void>; continuousDevice?: () => boolean } = {}) {
  const events: { event: string; input: unknown }[] = [];
  let permissionState = 'granted';
  const permission = {
    get state() {
      return permissionState;
    },
    onchange: null as null | (() => void)
  };
  const locate = vi.fn(async (_signal: AbortSignal, _onCoarseFix?: () => void) => cell);
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
    permission: async () => permission as unknown as PermissionStatus,
    ...options
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

function result(roomId: string, expiresInMs: number, index: number): NearbyResult {
  return {
    roomId,
    expiresInMs,
    discoveryId: `00000000-0000-4000-a000-${String(index).padStart(12, '0')}`,
    hostName: 'Host',
    title: roomId,
    artist: 'Artist',
    presence: '1–3',
    isFull: false
  };
}
function replyWithRooms(f: ReturnType<typeof harness>, results: NearbyResult[], delayMs = 0) {
  f.port.request = (event, input, _options, done) => {
    f.events.push({ event, input });
    const reply = { ok: true, schemaVersion: 2, expiresInMs: NEARBY_TTL_MS, results };
    if (delayMs) setTimeout(() => done(null, reply), delayMs);
    else done(null, reply);
  };
}

describe('nearby consent and lifecycle', () => {
  it('expires Product room cards independently while retaining consent until the response lease ends', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
    const authorize = vi.fn(async () => {});
    const f = harness(false, true, { authorize, continuousDevice: () => false });
    replyWithRooms(f, [result('SHORT2', 1000, 1), result('LONG34', 60_000, 2)]);
    await f.session.start({ kind: 'device' }, 5);
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.session.snapshot().results.map(item => item.roomId)).toEqual(['LONG34']);
    expect(f.session.snapshot().phase).toBe('active');
    expect(f.session.selection().source).toEqual({ kind: 'device' });
    await vi.advanceTimersByTimeAsync(59_000);
    expect(f.session.snapshot().results).toEqual([]);
    expect(f.session.snapshot().phase).toBe('empty');
    expect(f.session.snapshot().message).toContain('no open rooms');
    expect(f.session.selection().source).toEqual({ kind: 'device' });
    expect(authorize).toHaveBeenCalledOnce();
    expect(f.locate).toHaveBeenCalledOnce();
    expect(f.events.map(item => item.event)).toEqual(['nearby:search']);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.session.snapshot().phase).toBe('off');
    expect(f.session.selection().source).toBeNull();
    expect(f.session.snapshot().message).toContain('snapshot has expired');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('drops cards expired during transit and subtracts the round trip from the snapshot lease', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
    const f = harness(false, true, { continuousDevice: () => false });
    replyWithRooms(f, [result('SHORT2', 1000, 1), result('LONG34', 60_000, 2)], 2000);
    const pending = f.session.start({ kind: 'device' }, 5);
    await vi.advanceTimersByTimeAsync(2000);
    await pending;
    expect(f.session.snapshot().results.map(item => item.roomId)).toEqual(['LONG34']);
    await vi.advanceTimersByTimeAsync(57_999);
    expect(f.session.snapshot().results).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.session.snapshot().results).toEqual([]);
    expect(f.session.selection().source).not.toBeNull();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.session.snapshot().phase).toBe('off');
  });
  it('cancels old card deadlines on explicit restart and stop', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
    const f = harness(false, true, { continuousDevice: () => false });
    replyWithRooms(f, [result('SHORT2', 1000, 1)]);
    await f.session.start({ kind: 'device' }, 5);
    await vi.advanceTimersByTimeAsync(10_000);
    replyWithRooms(f, [result('LONG34', 60_000, 2)]);
    await f.session.start({ kind: 'device' }, 10);
    await vi.advanceTimersByTimeAsync(500);
    expect(f.session.snapshot().results.map(item => item.roomId)).toEqual(['LONG34']);
    expect(f.session.snapshot().phase).toBe('active');
    f.session.stop();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(f.session.snapshot().phase).toBe('off');
    expect(f.session.snapshot().results).toEqual([]);
  });
  it('replaces card deadlines on an ordinary browser refresh without discarding other valid rooms', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
    const f = harness();
    replyWithRooms(f, [result('SHORT2', 1000, 1), result('LONG34', 60_000, 2)]);
    await f.session.start({ kind: 'device' }, 5);
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.session.snapshot().results.map(item => item.roomId)).toEqual(['LONG34']);
    replyWithRooms(f, [result('LONG34', 80_000, 2)]);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(f.events).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.session.snapshot().results.map(item => item.roomId)).toEqual(['LONG34']);
    expect(f.session.snapshot().phase).toBe('active');
    f.session.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cannot locate or publish when a Product grant arrives after stop', async () => {
    let finish!: () => void;
    const authorize = vi.fn(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        })
    );
    const f = harness(true, true, { authorize });
    const pending = f.session.start({ kind: 'device' }, 5);
    expect(f.session.snapshot().phase).toBe('locating');
    f.session.stop();
    finish();
    await pending;
    expect(f.locate).not.toHaveBeenCalled();
    expect(f.events.some(item => item.event === 'nearby:publish')).toBe(false);
    expect(f.session.snapshot().phase).toBe('off');
  });
  it('does not switch a denied Product location to a city automatically', async () => {
    const f = harness(false, true, {
      authorize: async () => {
        throw new Error('DENIED');
      }
    });
    await f.session.start({ kind: 'device' }, 5);
    expect(f.session.snapshot().phase).toBe('denied');
    expect(f.locate).not.toHaveBeenCalled();
    expect(f.events).toEqual([]);
  });
  it('uses a bounded Product snapshot with no automatic permission request, movement tracking or renewal', async () => {
    vi.useFakeTimers();
    const authorize = vi.fn(async () => {});
    let continuous = false;
    const f = harness(true, true, { authorize, continuousDevice: () => continuous });
    await f.session.start({ kind: 'device' }, 5);
    continuous = true; // A lost Host marker cannot change the active policy.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.session.snapshot().phase).toBe('active');
    expect(f.locate).toHaveBeenCalledOnce();
    expect(authorize).toHaveBeenCalledOnce();
    expect(f.events.map(item => item.event)).toEqual(['nearby:publish']);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.session.snapshot().phase).toBe('off');
    expect(f.session.snapshot().message).toContain('snapshot has expired');
    expect(f.events.map(item => item.event)).toEqual(['nearby:publish', 'nearby:off']);
    continuous = false;
    await f.session.start({ kind: 'device' }, 10);
    expect(authorize).toHaveBeenCalledTimes(2);
    expect(f.events[f.events.length - 1]).toEqual({ event: 'nearby:publish', input: { schemaVersion: 2, cell, radiusKm: 10 } });
    f.session.stop();
  });
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
    const transport = { name: 'polling', writable: false };
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

it('coalesces repeated clicks, reports the scan and enforces a visible cooldown', async () => {
  vi.useFakeTimers();
  const f = harness();
  let finish!: (cell: string) => void;
  f.locate.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const pending = f.session.start({ kind: 'device' }, 17);
  await Promise.resolve();
  await f.session.start({ kind: 'device' }, 42);
  expect(f.locate).toHaveBeenCalledOnce();
  finish(cell);
  await pending;
  expect(f.events).toHaveLength(1);
  expect(f.session.snapshot().message).toContain('Scan complete');
  expect(f.session.snapshot().retryInSeconds).toBe(10);
  await f.session.start(manual, 42);
  expect(f.events).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(10_000);
  await f.session.start(manual, 42);
  expect(f.events).toHaveLength(2);
  f.session.stop();
  expect(vi.getTimerCount()).toBe(0);
});
it('publishes worldwide only on explicit request and never touches location', async () => {
  vi.useFakeTimers();
  const authorize = vi.fn(async () => {});
  const f = harness(true, true, { authorize });
  expect(f.events).toHaveLength(0);
  await f.session.start({ kind: 'worldwide' }, 5);
  expect(f.events).toEqual([{ event: 'nearby:publish', input: { schemaVersion: 2, worldwide: true } }]);
  expect(authorize).not.toHaveBeenCalled();
  expect(f.locate).not.toHaveBeenCalled();
  f.session.stop();
  expect(f.events[f.events.length - 1]?.event).toBe('nearby:off');
});
it('keeps the phase stable during background refreshes', async () => {
  vi.useFakeTimers();
  const f = harness(true);
  await f.session.start({ kind: 'device' }, 5);
  expect(f.session.snapshot().phase).toBe('active');
  const phases: string[] = [];
  const unsubscribe = f.session.subscribe(state => phases.push(state.phase));
  await vi.advanceTimersByTimeAsync(30_000);
  unsubscribe();
  expect(f.events.filter(event => event.event === 'nearby:publish')).toHaveLength(2);
  expect(phases).not.toContain('checking');
  expect(phases).not.toContain('locating');
  f.session.stop();
});
it('names the withdrawn mode and says a failed host attempt leaves the room link-only', async () => {
  vi.useFakeTimers();
  const f = harness(true);
  await f.session.start({ kind: 'worldwide' }, 5);
  f.session.stop();
  await vi.advanceTimersByTimeAsync(0);
  expect(f.session.snapshot().message).toBe('Your room is no longer visible worldwide.');

  f.locate.mockRejectedValueOnce(new Error('DENIED'));
  await f.session.start({ kind: 'device' }, 5);
  expect(f.session.snapshot().message).toContain('Your room is available by link only.');
});
it('tells the listener when the device answered but not precisely enough yet', async () => {
  const f = harness();
  let release!: (value: string) => void;
  f.locate.mockImplementationOnce(
    (_signal: AbortSignal, onCoarseFix?: () => void) =>
      new Promise<string>(resolve => {
        onCoarseFix?.();
        release = resolve;
      })
  );
  const pending = f.session.start({ kind: 'device' }, 5);
  await vi.waitFor(() => expect(f.session.snapshot().message).toBe('Waiting for a more precise location…'));
  release(cell);
  await pending;
  f.session.stop();
});
