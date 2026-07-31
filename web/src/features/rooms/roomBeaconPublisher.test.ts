import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadModule() {
  return import('./roomBeaconPublisher');
}

function fakeClient(overrides: { publishOk?: boolean; publishThrows?: boolean } = {}) {
  const published: Array<{ data: unknown; options: unknown }> = [];
  let handler: ((statement: { data: unknown; expiry?: bigint }) => void) | null = null;
  const client = {
    publish: vi.fn(async (data: unknown, options: unknown) => {
      if (overrides.publishThrows) throw new Error('transport down');
      published.push({ data, options });
      return { ok: overrides.publishOk ?? true };
    }),
    subscribe: vi.fn((callback: (statement: { data: unknown; expiry?: bigint }) => void) => {
      handler = callback;
      return { unsubscribe: vi.fn() };
    }),
    destroy: vi.fn()
  };
  return { client, published, emit: (data: unknown, expiry?: bigint) => handler?.({ data, expiry }) };
}

const base = { roomCode: 'AB12CD', hostName: 'Kevin', listenerCount: 2 };

describe('createRoomBeaconPublisher', () => {
  it('is absent unless the build opted in', async () => {
    // Off by default so no chain code ships to a build that cannot use it.
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', '');
    vi.resetModules();
    const { createRoomBeaconPublisher } = await loadModule();

    const createClient = vi.fn();
    await expect(createRoomBeaconPublisher({ createClient })).resolves.toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('returns null instead of throwing when no host container is present', async () => {
    // Hosting a room must keep working outside the Product host.
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { createRoomBeaconPublisher } = await loadModule();

    const publisher = await createRoomBeaconPublisher({
      createClient: async () => {
        throw new Error('no host provider');
      }
    });

    expect(publisher).toBeNull();
  });

  it('publishes a beacon to a per-room last-write-wins channel', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { createRoomBeaconPublisher, BEACON_TTL_SECONDS } = await loadModule();
    const { client, published } = fakeClient();

    const publisher = await createRoomBeaconPublisher({ createClient: async () => client });
    await expect(publisher!.announce(base)).resolves.toEqual({ ok: true });

    expect(published).toHaveLength(1);
    expect(published[0].data).toEqual({ version: 1, room: 'AB12CD', host: 'Kevin', listenerCount: 2 });
    expect(published[0].options).toEqual({
      channel: 'room/AB12CD',
      topic2: 'dotify-room-AB12CD',
      ttlSeconds: BEACON_TTL_SECONDS
    });
  });

  it('never publishes SDP, chat, or listener identities', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { createRoomBeaconPublisher } = await loadModule();
    const { client, published } = fakeClient();

    const publisher = await createRoomBeaconPublisher({ createClient: async () => client });
    await publisher!.announce({ ...base, nowPlaying: { title: 'Kwenda', artist: 'Muzinga' } });

    const keys = Object.keys(published[0].data as object).sort();
    expect(keys).toEqual(['artist', 'host', 'listenerCount', 'room', 'title', 'version']);
  });

  it('refuses a room that would push the account over its byte ceiling', async () => {
    // The chain would reject this silently, which reads as a room that never
    // appears; refusing locally keeps the cause visible.
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { createRoomBeaconPublisher } = await loadModule();
    const { client, published } = fakeClient();

    const publisher = await createRoomBeaconPublisher({ createClient: async () => client });

    let accepted = 0;
    let lastReason = '';
    for (let index = 0; index < 12; index += 1) {
      const outcome = await publisher!.announce({
        roomCode: `ROOM${String(index).padStart(2, '0')}`,
        hostName: 'a-fairly-long-host-name-here',
        listenerCount: index,
        nowPlaying: { title: 'A reasonably long track title', artist: 'A reasonably long artist name' }
      });
      if (outcome.ok) accepted += 1;
      else lastReason = outcome.reason;
    }

    expect(accepted).toBeGreaterThan(0);
    expect(accepted).toBeLessThan(12);
    expect(published).toHaveLength(accepted);
    // Scoped honestly: this guard only sees writes from this instance.
    expect(lastReason).toBe('quota-local');
  });

  it('names an account-wide rejection the client cannot observe locally', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { createRoomBeaconPublisher } = await loadModule();
    const { client } = fakeClient({ publishOk: false });

    const publisher = await createRoomBeaconPublisher({ createClient: async () => client });
    const outcome = await publisher!.announce(base);

    expect(outcome).toMatchObject({ ok: false, reason: 'rejected' });
    expect(outcome.ok === false && outcome.detail).toMatch(/account-wide quota/);
  });

  it('swallows a transport error so hosting is never interrupted', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { createRoomBeaconPublisher } = await loadModule();
    const { client } = fakeClient({ publishThrows: true });

    const publisher = await createRoomBeaconPublisher({ createClient: async () => client });
    await expect(publisher!.announce(base)).resolves.toMatchObject({ ok: false, reason: 'transport' });
  });

  it('stops announcing and releases the connection', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { createRoomBeaconPublisher } = await loadModule();
    const { client } = fakeClient();

    const publisher = await createRoomBeaconPublisher({ createClient: async () => client });
    publisher!.stop();

    expect(client.destroy).toHaveBeenCalled();
    await expect(publisher!.announce(base)).resolves.toMatchObject({ ok: false, reason: 'stopped' });
  });
});

describe('subscribeRoomBeacons', () => {
  it('collects valid beacons and drops malformed ones', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { subscribeRoomBeacons } = await loadModule();
    const { client, emit } = fakeClient();

    const listener = await subscribeRoomBeacons({}, { createClient: async () => client });

    emit({ version: 1, room: 'AB12CD', host: 'Kevin', listenerCount: 2 });
    emit({ version: 9, room: 'EF34GH', host: 'Nope', listenerCount: 1 });
    emit('not a beacon');
    emit({ version: 1, room: 'EF34GH', host: 'Ada', listenerCount: 5 });

    expect(listener!.beacons()).toEqual([
      { version: 1, room: 'AB12CD', host: 'Kevin', listenerCount: 2 },
      { version: 1, room: 'EF34GH', host: 'Ada', listenerCount: 5 }
    ]);
  });

  it('keeps only the latest beacon per room', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { subscribeRoomBeacons } = await loadModule();
    const { client, emit } = fakeClient();

    const listener = await subscribeRoomBeacons({}, { createClient: async () => client });
    emit({ version: 1, room: 'AB12CD', host: 'Kevin', listenerCount: 2 });
    emit({ version: 1, room: 'AB12CD', host: 'Kevin', listenerCount: 6 });

    expect(listener!.beacons()).toEqual([{ version: 1, room: 'AB12CD', host: 'Kevin', listenerCount: 6 }]);
  });

  it('filters to one room when asked', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { subscribeRoomBeacons } = await loadModule();
    const { client, emit } = fakeClient();

    const listener = await subscribeRoomBeacons({ roomCode: 'ab12cd' }, { createClient: async () => client });
    emit({ version: 1, room: 'AB12CD', host: 'Kevin', listenerCount: 2 });
    emit({ version: 1, room: 'EF34GH', host: 'Ada', listenerCount: 5 });

    expect(listener!.beacons()).toEqual([{ version: 1, room: 'AB12CD', host: 'Kevin', listenerCount: 2 }]);
  });

  it('is absent unless the build opted in', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', '');
    vi.resetModules();
    const { subscribeRoomBeacons } = await loadModule();

    await expect(subscribeRoomBeacons({}, { createClient: vi.fn() })).resolves.toBeNull();
  });

  it('evicts a room once its statement expires', async () => {
    // The store drops an expired record on its side but sends no deletion event,
    // so without a sweep a stopped room would be listed for the page lifetime.
    vi.useFakeTimers();
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { subscribeRoomBeacons } = await loadModule();
    const { client, emit } = fakeClient();

    let clock = 1_000_000_000_000;
    const changes: number[] = [];
    const listener = await subscribeRoomBeacons({ onChange: beacons => changes.push(beacons.length) }, { createClient: async () => client, now: () => clock });

    // expiry packs seconds in the upper 32 bits.
    const expiresAtSeconds = BigInt(Math.floor(clock / 1000) + 90);
    emit({ version: 1, room: 'AB12CD', host: 'Kevin', listenerCount: 2 }, expiresAtSeconds << 32n);
    expect(listener!.beacons()).toHaveLength(1);

    clock += 91_000;
    // Reads are filtered immediately, without waiting for the sweep.
    expect(listener!.beacons()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(changes[changes.length - 1]).toBe(0);

    listener!.stop();
    vi.useRealTimers();
  });

  it('ignores a statement that is already expired on arrival', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { subscribeRoomBeacons } = await loadModule();
    const { client, emit } = fakeClient();

    const clock = 1_000_000_000_000;
    const listener = await subscribeRoomBeacons({}, { createClient: async () => client, now: () => clock });

    emit({ version: 1, room: 'AB12CD', host: 'Kevin', listenerCount: 2 }, BigInt(Math.floor(clock / 1000) - 10) << 32n);
    expect(listener!.beacons()).toHaveLength(0);
  });

  it('falls back to an assumed lifetime when the transport omits expiry', async () => {
    // Otherwise a transport without the field would reintroduce never-evicting.
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { subscribeRoomBeacons } = await loadModule();
    const { client, emit } = fakeClient();

    let clock = 1_000_000_000_000;
    const listener = await subscribeRoomBeacons({}, { createClient: async () => client, now: () => clock });

    emit({ version: 1, room: 'AB12CD', host: 'Kevin', listenerCount: 2 });
    expect(listener!.beacons()).toHaveLength(1);

    clock += 121_000;
    expect(listener!.beacons()).toHaveLength(0);
  });
});

describe('startRoomBeaconLoop', () => {
  it('announces immediately and then on the refresh interval', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { startRoomBeaconLoop, BEACON_REFRESH_MS } = await loadModule();

    const announce = vi.fn(async () => ({ ok: true as const }));
    let tick: (() => void) | null = null;

    const stop = startRoomBeaconLoop(() => base, {
      createPublisher: async () => ({ announce, stop: vi.fn() }),
      setInterval: (handler, ms) => {
        expect(ms).toBe(BEACON_REFRESH_MS);
        tick = handler;
        return 1 as never;
      },
      clearInterval: vi.fn()
    });

    await vi.waitFor(() => expect(announce).toHaveBeenCalledTimes(1));
    tick!();
    await vi.waitFor(() => expect(announce).toHaveBeenCalledTimes(2));
    stop();
  });

  it('re-reads the input each announce, so a changing listener count needs no restart', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { startRoomBeaconLoop } = await loadModule();

    const announce = vi.fn(async (_input: unknown) => ({ ok: true as const }));
    let count = 2;
    let tick: (() => void) | null = null;

    const stop = startRoomBeaconLoop(() => ({ ...base, listenerCount: count }), {
      createPublisher: async () => ({ announce, stop: vi.fn() }),
      setInterval: handler => {
        tick = handler;
        return 1 as never;
      },
      clearInterval: vi.fn()
    });

    await vi.waitFor(() => expect(announce).toHaveBeenCalledTimes(1));
    count = 9;
    tick!();

    await vi.waitFor(() => expect(announce).toHaveBeenCalledTimes(2));
    expect(announce.mock.calls[1][0]).toMatchObject({ listenerCount: 9 });
    stop();
  });

  it('stops the publisher and clears the timer on stop', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { startRoomBeaconLoop } = await loadModule();

    const publisherStop = vi.fn();
    const clearIntervalSpy = vi.fn();
    const setIntervalSpy = vi.fn(() => 7 as never);

    const stop = startRoomBeaconLoop(() => base, {
      createPublisher: async () => ({ announce: vi.fn(async () => ({ ok: true as const })), stop: publisherStop }),
      setInterval: setIntervalSpy,
      clearInterval: clearIntervalSpy
    });

    // Wait until the refresh timer actually exists, otherwise this asserts a
    // different lifecycle stage than it claims to.
    await vi.waitFor(() => expect(setIntervalSpy).toHaveBeenCalled());
    stop();

    expect(publisherStop).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalledWith(7);
  });

  it('releases a publisher that finished connecting after stop was called', async () => {
    // The room can close while the host connection is still being established;
    // without this the publisher would be left running with no owner.
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { startRoomBeaconLoop } = await loadModule();

    const publisherStop = vi.fn();
    const announce = vi.fn(async () => ({ ok: true as const }));
    let release: (() => void) | null = null;
    const pending = new Promise<void>(resolve => {
      release = resolve;
    });

    const stop = startRoomBeaconLoop(() => base, {
      createPublisher: async () => {
        await pending;
        return { announce, stop: publisherStop };
      }
    });

    stop();
    release!();
    await vi.waitFor(() => expect(publisherStop).toHaveBeenCalled());
    expect(announce).not.toHaveBeenCalled();
  });

  it('reports a refused announce without throwing', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { startRoomBeaconLoop } = await loadModule();

    const outcomes: unknown[] = [];
    const stop = startRoomBeaconLoop(() => base, {
      createPublisher: async () => ({
        announce: vi.fn(async () => ({ ok: false as const, reason: 'rejected' as const, detail: 'quota' })),
        stop: vi.fn()
      }),
      setInterval: () => 1 as never,
      clearInterval: vi.fn(),
      onOutcome: outcome => outcomes.push(outcome)
    });

    await vi.waitFor(() => expect(outcomes).toHaveLength(1));
    expect(outcomes[0]).toMatchObject({ reason: 'rejected' });
    stop();
  });

  it('skips announcing when the room is no longer hostable', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { startRoomBeaconLoop } = await loadModule();

    const announce = vi.fn(async () => ({ ok: true as const }));
    const stop = startRoomBeaconLoop(() => null, {
      createPublisher: async () => ({ announce, stop: vi.fn() }),
      setInterval: () => 1 as never,
      clearInterval: vi.fn()
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(announce).not.toHaveBeenCalled();
    stop();
  });
});
