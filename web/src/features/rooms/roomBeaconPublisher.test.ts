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
  let handler: ((statement: { data: unknown }) => void) | null = null;
  const client = {
    publish: vi.fn(async (data: unknown, options: unknown) => {
      if (overrides.publishThrows) throw new Error('transport down');
      published.push({ data, options });
      return { ok: overrides.publishOk ?? true };
    }),
    subscribe: vi.fn((callback: (statement: { data: unknown }) => void) => {
      handler = callback;
      return { unsubscribe: vi.fn() };
    }),
    destroy: vi.fn()
  };
  return { client, published, emit: (data: unknown) => handler?.({ data }) };
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
    await expect(publisher!.announce(base)).resolves.toBe(true);

    expect(published).toHaveLength(1);
    expect(published[0].data).toEqual({ v: 1, room: 'AB12CD', host: 'Kevin', n: 2 });
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
    expect(keys).toEqual(['a', 'host', 'n', 'room', 't', 'v']);
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
    for (let index = 0; index < 12; index += 1) {
      const ok = await publisher!.announce({
        roomCode: `ROOM${String(index).padStart(2, '0')}`,
        hostName: 'a-fairly-long-host-name-here',
        listenerCount: index,
        nowPlaying: { title: 'A reasonably long track title', artist: 'A reasonably long artist name' }
      });
      if (ok) accepted += 1;
    }

    expect(accepted).toBeGreaterThan(0);
    expect(accepted).toBeLessThan(12);
    expect(published).toHaveLength(accepted);
  });

  it('reports a failed publish rather than pretending the room is announced', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { createRoomBeaconPublisher } = await loadModule();
    const { client } = fakeClient({ publishOk: false });

    const publisher = await createRoomBeaconPublisher({ createClient: async () => client });
    await expect(publisher!.announce(base)).resolves.toBe(false);
  });

  it('swallows a transport error so hosting is never interrupted', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { createRoomBeaconPublisher } = await loadModule();
    const { client } = fakeClient({ publishThrows: true });

    const publisher = await createRoomBeaconPublisher({ createClient: async () => client });
    await expect(publisher!.announce(base)).resolves.toBe(false);
  });

  it('stops announcing and releases the connection', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { createRoomBeaconPublisher } = await loadModule();
    const { client } = fakeClient();

    const publisher = await createRoomBeaconPublisher({ createClient: async () => client });
    publisher!.stop();

    expect(client.destroy).toHaveBeenCalled();
    await expect(publisher!.announce(base)).resolves.toBe(false);
  });
});

describe('subscribeRoomBeacons', () => {
  it('collects valid beacons and drops malformed ones', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { subscribeRoomBeacons } = await loadModule();
    const { client, emit } = fakeClient();

    const listener = await subscribeRoomBeacons({}, { createClient: async () => client });

    emit({ v: 1, room: 'AB12CD', host: 'Kevin', n: 2 });
    emit({ v: 9, room: 'EF34GH', host: 'Nope', n: 1 });
    emit('not a beacon');
    emit({ v: 1, room: 'EF34GH', host: 'Ada', n: 5 });

    expect(listener!.beacons()).toEqual([
      { v: 1, room: 'AB12CD', host: 'Kevin', n: 2 },
      { v: 1, room: 'EF34GH', host: 'Ada', n: 5 }
    ]);
  });

  it('keeps only the latest beacon per room', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { subscribeRoomBeacons } = await loadModule();
    const { client, emit } = fakeClient();

    const listener = await subscribeRoomBeacons({}, { createClient: async () => client });
    emit({ v: 1, room: 'AB12CD', host: 'Kevin', n: 2 });
    emit({ v: 1, room: 'AB12CD', host: 'Kevin', n: 6 });

    expect(listener!.beacons()).toEqual([{ v: 1, room: 'AB12CD', host: 'Kevin', n: 6 }]);
  });

  it('filters to one room when asked', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', 'on');
    vi.resetModules();
    const { subscribeRoomBeacons } = await loadModule();
    const { client, emit } = fakeClient();

    const listener = await subscribeRoomBeacons({ roomCode: 'ab12cd' }, { createClient: async () => client });
    emit({ v: 1, room: 'AB12CD', host: 'Kevin', n: 2 });
    emit({ v: 1, room: 'EF34GH', host: 'Ada', n: 5 });

    expect(listener!.beacons()).toEqual([{ v: 1, room: 'AB12CD', host: 'Kevin', n: 2 }]);
  });

  it('is absent unless the build opted in', async () => {
    vi.stubEnv('VITE_DOTIFY_ROOM_BEACONS', '');
    vi.resetModules();
    const { subscribeRoomBeacons } = await loadModule();

    await expect(subscribeRoomBeacons({}, { createClient: vi.fn() })).resolves.toBeNull();
  });
});
