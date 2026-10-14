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
  const client = (id, role = 'listener') => {
    const events = new Map();
    service.register({ id, data: { role, roomId: 'ROOM' }, handshake: { address: id }, on: (name, fn) => events.set(name, fn) });
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
