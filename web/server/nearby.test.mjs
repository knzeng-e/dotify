import assert from 'node:assert/strict';
import { test } from 'node:test';
import { io } from 'socket.io-client';
import { createNearby } from './nearby.mjs';
import { readConfigFromEnv, startSignalingServer } from './signaling.mjs';
import { coarseNearbyCell, NEARBY_TTL_MS } from '../shared/nearby-v2.mjs';
const area = (lat = 0, radiusKm = 5) => ({ schemaVersion: 2, cell: coarseNearbyCell(lat, 0), radiusKm });

test('Nearby is available by default, with an explicit operational disable', () => {
  assert.equal(readConfigFromEnv({}).nearbyEnabled, true);
  assert.equal(readConfigFromEnv({ SIGNAL_NEARBY: 'on' }).nearbyEnabled, true);
  for (const value of ['off', '', 'true', 'ON']) {
    assert.equal(readConfigFromEnv({ SIGNAL_NEARBY: value }).nearbyEnabled, false);
  }
});

function fixture() {
  let time = 1000;
  const rooms = new Map([['ROOM', { hostId: 'host', hostName: 'Ada', track: { title: 'Song', artist: 'Artist', audioRef: 'secret' }, listeners: new Map() }]]);
  const service = createNearby({ enabled: true, rooms, maxListeners: 24, now: () => time });
  const client = (id, role = 'listener', address = id) => {
    const events = new Map();
    service.register({ id, data: { role, roomId: 'ROOM' }, handshake: { address }, on: (name, fn) => events.set(name, fn) });
    return (name, payload) => {
      let reply;
      events.get(name)(payload, value => {
        reply = value;
      });
      return reply;
    };
  };
  return {
    rooms,
    service,
    client,
    advance: ms => {
      time += ms;
    }
  };
}

test('only the current host can publish; replies contain no cell, wallet or source and derive metadata server-side', () => {
  const f = fixture();
  const host = f.client('host', 'host');
  const guest = f.client('guest');
  assert.equal(guest('nearby:publish', area()).code, 'HOST_REQUIRED');
  assert.equal(host('nearby:publish', { ...area(), title: 'Forged' }).code, 'INVALID_AREA');
  assert.equal(host('nearby:publish', area()).ok, true);
  const result = guest('nearby:search', area());
  assert.equal(result.results[0].title, 'Song');
  assert.equal(result.results[0].presence, '1–3');
  assert.doesNotMatch(JSON.stringify(result), /cell|secret|audioRef|wallet|latitude/);
  host('nearby:off', {});
  assert.deepEqual(guest('nearby:search', area()).results, []);
});

test('expiry, restart, rotation, sparse search and two independent radii', () => {
  const f = fixture();
  const host = f.client('host', 'host');
  const guest = f.client('guest');
  host('nearby:publish', area());
  const id = guest('nearby:search', area()).results[0].discoveryId;
  assert.deepEqual(guest('nearby:search', area(0.1, 25)).results, []);
  host('nearby:publish', area(0, 25));
  assert.notEqual(guest('nearby:search', area(0.1, 25)).results[0].discoveryId, id);
  f.advance(NEARBY_TTL_MS);
  assert.deepEqual(guest('nearby:search', area()).results, []);
  assert.deepEqual(fixture().client('guest')('nearby:search', area()).results, []);
});

test('rate limits include repeated probes and reconnects, but never prevent revocation', () => {
  const f = fixture();
  const host = f.client('host', 'host');
  for (let i = 0; i < 12; i++) host('nearby:publish', area());
  assert.equal(host('nearby:publish', area()).code, 'RATE_LIMITED');
  assert.equal(host('nearby:off', {}).ok, true);
  const guest = f.client('guest');
  for (let i = 0; i < 6; i++) guest('nearby:search', area());
  assert.equal(f.client('guest')('nearby:search', area()).code, 'RATE_LIMITED');
  f.advance(60_000);
  assert.equal(guest('nearby:search', area()).ok, true);
});

test('live sockets: default availability and explicit off, no leakage, disconnect cleanup and wallet-free Join', async () => {
  for (const setting of ['off', undefined]) {
    const enabled = setting === undefined;
    const logs = [];
    const server = startSignalingServer({ ...readConfigFromEnv({ SIGNAL_NEARBY: setting }), host: '127.0.0.1', port: 0, logger: line => logs.push(line) });
    const port = await server.listen();
    const clients = [];
    const connect = async () => {
      const socket = io(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
      clients.push(socket);
      await new Promise(resolve => socket.once('connect', resolve));
      return socket;
    };
    const ack = (socket, event, payload) =>
      new Promise(resolve => socket.timeout(2000).emit(event, payload, (err, result) => resolve(err ? { error: true } : result)));
    try {
      const host = await connect();
      const guest = await connect();
      const created = await ack(host, 'room:create', { displayName: 'Ada', track: { title: 'Song', artist: 'Artist' } });
      const published = await ack(host, 'nearby:publish', area());
      assert.equal(published.ok, enabled);
      if (!enabled) {
        assert.equal(published.code, 'DISABLED');
        continue;
      }
      assert.equal((await ack(guest, 'nearby:search', area())).results.length, 1);
      const joined = await ack(guest, 'room:join', { roomId: created.roomId, displayName: 'Guest' });
      assert.equal(joined.ok, true);
      const status = await (await fetch(`http://127.0.0.1:${port}/status`)).text();
      assert.doesNotMatch(status + logs.join(''), /n2:|radiusKm|discoveryId/);
      await new Promise(resolve => {
        server.io.sockets.sockets.get(host.id).once('disconnect', resolve);
        host.disconnect();
      });
      assert.deepEqual((await ack(guest, 'nearby:search', area())).results, []);
    } finally {
      clients.forEach(c => c.disconnect());
      await server.close();
    }
  }
});

test('worldwide is explicit, disjoint from nearby, bounded, revocable and contains no location', () => {
  const f = fixture();
  const host = f.client('host', 'host');
  const guest = f.client('guest');
  const world = { schemaVersion: 2, worldwide: true };
  assert.deepEqual(guest('nearby:search', world).results, []);
  assert.equal(guest('nearby:publish', world).code, 'HOST_REQUIRED');
  host('nearby:publish', area());
  assert.deepEqual(guest('nearby:search', world).results, []);
  assert.equal(host('nearby:publish', { ...world, cell: area().cell }).code, 'INVALID_AREA');
  host('nearby:publish', world);
  assert.equal(guest('nearby:search', world).results.length, 1);
  assert.deepEqual(guest('nearby:search', area()).results, []);
  assert.doesNotMatch(JSON.stringify(guest('nearby:search', world)), /cell|audioRef|wallet|latitude/);
  host('nearby:off', {});
  assert.deepEqual(guest('nearby:search', world).results, []);
  host('nearby:publish', world);
  f.advance(NEARBY_TTL_MS);
  assert.deepEqual(guest('nearby:search', world).results, []);
});
test('intermediate radii through 42 km preserve the smaller host radius', () => {
  const f = fixture();
  const host = f.client('host', 'host');
  const guest = f.client('guest');
  assert.equal(host('nearby:publish', area(0, 17)).ok, true);
  assert.equal(guest('nearby:search', area(0.1, 42)).results.length, 1);
  assert.deepEqual(guest('nearby:search', area(0.2, 42)).results, []);
  assert.equal(host('nearby:publish', area(0, 42)).ok, true);
  assert.equal(guest('nearby:search', area(0.2, 42)).results.length, 1);
  assert.equal(host('nearby:publish', area(0, 43)).code, 'INVALID_AREA');
});

test('shared Wi-Fi users keep independent scan budgets while the network stays bounded', () => {
  const f = fixture();
  for (let user = 0; user < 10; user++) {
    const guest = f.client(`guest-${user}`, 'listener', 'same-network');
    for (let scan = 0; scan < 6; scan++) assert.equal(guest('nearby:search', area()).ok, true);
    assert.equal(guest('nearby:search', area()).code, 'RATE_LIMITED');
  }
  assert.equal(f.client('extra', 'listener', 'same-network')('nearby:search', area()).code, 'RATE_LIMITED');
  assert.equal(f.client('other', 'listener', 'other-network')('nearby:search', area()).ok, true);
});

test('v3 distance bands are coarse and v2 exact response shapes remain compatible', () => {
  const f = fixture();
  const host = f.client('host', 'host');
  host('nearby:publish', area());
  const v2 = f.client('legacy')('nearby:search', area());
  assert.equal(v2.schemaVersion, 2);
  assert.equal(Object.hasOwn(v2.results[0], 'distanceBand'), false);
  const v3 = f.client('radar')('nearby:search', { ...area(), schemaVersion: 3 });
  assert.equal(v3.schemaVersion, 3);
  assert.equal(v3.results[0].distanceBand, '0–5 km');
  assert.doesNotMatch(JSON.stringify(v3), /cell|latitude|longitude|bearing|audioRef|wallet/);
  // A large listener radius never overrides the host's 5 km publication.
  assert.deepEqual(f.client('far')('nearby:search', { ...area(0.1, 42), schemaVersion: 3 }).results, []);
  host('nearby:publish', { schemaVersion: 2, worldwide: true });
  const world = f.client('world')('nearby:search', { schemaVersion: 3, worldwide: true });
  assert.equal(world.results[0].distanceBand, null);
  for (const extra of [{ latitude: 0 }, { distanceBand: '0–5 km' }, { schemaVersion: 5 }]) {
    assert.equal(f.client('bad' + JSON.stringify(extra))('nearby:search', { ...area(), schemaVersion: 3, ...extra }).code, 'INVALID_AREA');
  }
});

test('v4 restores exact listener counts and canonical artwork without changing v2/v3 or leaking source fields', async () => {
  const imageRef = 'ipfs://Qmc1s9HahFvSTuKk23KXpToF8PBaJraj5Re8qKMU1Ntxdq/cover/640.webp';
  const room = {
    hostId: 'host',
    hostName: 'Ada',
    track: { title: 'Host title', imageRef: 'https://tracker.invalid', audioRef: 'private-source' },
    listeners: new Map([
      ['one', {}],
      ['two', {}]
    ])
  };
  const rooms = new Map([['ABC234', room]]);
  const service = createNearby({
    enabled: true,
    rooms,
    maxListeners: 24,
    getPublicTrack: async () => ({ title: 'Canonical song', artistName: 'Canonical artist', imageRef })
  });
  function client(id, role = 'listener') {
    const handlers = new Map();
    service.register({ id, data: { role, roomId: 'ABC234' }, handshake: { address: id }, on: (event, handler) => handlers.set(event, handler) });
    return (event, payload) => new Promise(resolve => handlers.get(event)(payload, resolve));
  }
  const host = client('host', 'host');
  const observer = client('observer');
  await host('nearby:publish', area());
  const v4 = await observer('nearby:search', { ...area(), schemaVersion: 4 });
  assert.equal(v4.results[0].listenerCount, 2);
  assert.equal(v4.results[0].imageRef, imageRef);
  assert.equal(v4.results[0].title, 'Canonical song');
  assert.doesNotMatch(JSON.stringify(v4), /tracker|private-source|audioRef|metadataRef|wallet|cell/);
  for (const version of [2, 3]) {
    const legacy = await observer('nearby:search', { ...area(), schemaVersion: version });
    assert.equal(Object.hasOwn(legacy.results[0], 'listenerCount'), false);
    assert.equal(Object.hasOwn(legacy.results[0], 'imageRef'), false);
  }
  room.listeners.delete('one');
  assert.equal((await observer('nearby:search', { ...area(), schemaVersion: 4 })).results[0].listenerCount, 1);
});

test('slow artwork cannot block visible rooms, and async enrichment respects host opt-out', async () => {
  let resolveArtwork;
  const room = { hostId: 'host', hostName: 'Ada', track: { title: 'Song' }, listeners: new Map() };
  const rooms = new Map([['ABC234', room]]);
  const service = createNearby({
    enabled: true,
    rooms,
    maxListeners: 24,
    getPublicTrack: async () =>
      new Promise(resolve => {
        resolveArtwork = resolve;
      })
  });
  function client(id, role = 'listener') {
    const handlers = new Map();
    service.register({ id, data: { role, roomId: 'ABC234' }, handshake: { address: id }, on: (event, handler) => handlers.set(event, handler) });
    return (event, payload) => new Promise(resolve => handlers.get(event)(payload, resolve));
  }
  const host = client('host', 'host');
  const observer = client('observer');
  await host('nearby:publish', area());
  const started = Date.now();
  const slow = await observer('nearby:search', { ...area(), schemaVersion: 4 });
  assert.equal(slow.results.length, 1);
  assert.equal(slow.results[0].imageRef, null);
  assert.ok(Date.now() - started < 1000);
  const pending = observer('nearby:search', { ...area(), schemaVersion: 4 });
  await host('nearby:off', {});
  resolveArtwork({ title: 'Song' });
  assert.deepEqual((await pending).results, []);
});

test('v4 keeps rooms during capture metadata refreshes but drops an actual release change', async () => {
  let finish;
  const track = { hash: 'same-release', title: 'Song', artist: 'Artist' };
  const room = { hostId: 'host', hostName: 'Host', track, listeners: new Map() };
  const service = createNearby({
    enabled: true,
    rooms: new Map([['ROOM', room]]),
    maxListeners: 24,
    getPublicTrack: () =>
      new Promise(resolve => {
        finish = resolve;
      })
  });
  function client(id, role) {
    const handlers = new Map();
    service.register({ id, data: { role, roomId: 'ROOM' }, handshake: { address: id }, on: (event, fn) => handlers.set(event, fn) });
    return (event, payload) => new Promise(resolve => handlers.get(event)(payload, resolve));
  }
  const host = client('host', 'host'),
    guest = client('guest', 'listener');
  await host('nearby:publish', area());
  const first = guest('nearby:search', { ...area(), schemaVersion: 4 });
  room.track = { ...track, duration: 240, updatedAt: Date.now() };
  finish({ title: 'Song' });
  assert.equal((await first).results.length, 1);
  const changed = guest('nearby:search', { ...area(), schemaVersion: 4 });
  room.track = { ...track, hash: 'different-release' };
  finish({ title: 'Song' });
  assert.deepEqual((await changed).results, []);
});
