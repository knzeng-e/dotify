import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createNearby } from './nearby.mjs';
import { announcedArtistPresent, roomProfile } from './room-profile.mjs';
import { coarseNearbyCell } from '../shared/nearby-v2.mjs';
const area = { schemaVersion: 2, cell: coarseNearbyCell(0, 0), radiusKm: 5 };
const tick = () => new Promise(resolve => setTimeout(resolve, 250));
function fixture(t, getPublicTrack) {
  let time = 1000;
  const room = { hostId: 'host', hostName: 'Host', track: { title: 'Song', artist: 'Artist' }, listeners: new Map(), lifeMembers: new Map() };
  const rooms = new Map([['ABCDEF', room]]);
  const service = createNearby({ enabled: true, rooms, maxListeners: 24, now: () => time, getPublicTrack });
  t.after(() => service.close());
  function client(id, role = 'listener') {
    const handlers = new Map();
    const pushed = [];
    const socket = {
      id,
      connected: true,
      data: { role, roomId: 'ABCDEF' },
      handshake: { address: id },
      on: (event, handler) => handlers.set(event, handler),
      emit: (event, data) => pushed.push({ event, data })
    };
    service.register(socket);
    return {
      socket,
      pushed,
      fire: (event, payload) => handlers.get(event)(payload),
      request: (event, payload) => new Promise(resolve => handlers.get(event)(payload, resolve))
    };
  }
  return {
    room,
    rooms,
    service,
    client,
    advance: ms => {
      time += ms;
      service.prune();
    }
  };
}
test('scoped live discovery publishes immediately and removes on opt-out without leaking private activity', async t => {
  const f = fixture(t),
    host = f.client('host', 'host'),
    guest = f.client('guest');
  const watchId = randomUUID();
  const initial = await guest.request('nearby:search', { ...area, schemaVersion: 5, watchId });
  assert.deepEqual(initial.results, []);
  await host.request('nearby:publish', area);
  await tick();
  assert.equal(guest.pushed.length, 1);
  assert.equal(guest.pushed[0].data.reply.results[0].roomId, 'ABCDEF');
  assert.equal(guest.pushed[0].data.reply.sequence, initial.sequence + 1);
  f.rooms.set('SECRET', { ...f.room });
  f.service.changed('SECRET');
  await tick();
  assert.equal(guest.pushed.length, 1, 'unrelated private activity sends no frame or sequence gap');
  await host.request('nearby:off', {});
  await tick();
  assert.deepEqual(guest.pushed.at(-1).data.reply.results, []);
  assert.equal(guest.pushed.at(-1).data.reply.sequence, initial.sequence + 2);
  guest.fire('nearby:unwatch', { watchId });
  await host.request('nearby:publish', area);
  await tick();
  assert.equal(guest.pushed.length, 2);
});
test('watches cannot widen location scope and expire without query renewal', async t => {
  const f = fixture(t),
    host = f.client('host', 'host'),
    guest = f.client('guest');
  await guest.request('nearby:search', { ...area, schemaVersion: 5, watchId: randomUUID() });
  await host.request('nearby:publish', { ...area, cell: coarseNearbyCell(1, 1) });
  await tick();
  assert.equal(guest.pushed.length, 0);
  await host.request('nearby:publish', { schemaVersion: 2, worldwide: true });
  await tick();
  assert.equal(guest.pushed.length, 0, 'worldwide needs its own explicit watch');
  f.advance(45_000);
  await host.request('nearby:publish', area);
  await tick();
  assert.equal(guest.pushed.length, 0, 'expired queries never receive new invitations');
});
test('private, unchanged and out-of-area activity does no watch enrichment work', async t => {
  let reads = 0;
  const f = fixture(t, async () => {
    reads++;
    return null;
  });
  const host = f.client('host', 'host');
  const guest = f.client('guest');
  await host.request('nearby:publish', area);
  await guest.request('nearby:search', { ...area, schemaVersion: 5, watchId: randomUUID() });
  const before = reads;
  f.rooms.set('SECRET', { ...f.room, listeners: new Map() });
  for (let i = 0; i < 2000; i++) {
    f.rooms.get('SECRET').hostName = `Private ${i}`;
    f.service.changed('SECRET');
    f.service.changed('ABCDEF'); // listener renames do not change public fields
  }
  await tick();
  assert.equal(reads, before);
  assert.equal(guest.pushed.length, 0);
  const distant = f.client('distant', 'host');
  distant.socket.data.roomId = 'FARAWAY';
  f.rooms.set('FARAWAY', { ...f.room, hostId: 'distant' });
  await distant.request('nearby:publish', { ...area, cell: coarseNearbyCell(10, 10) });
  const afterWarmup = reads;
  for (let i = 0; i < 100; i++) {
    f.rooms.get('FARAWAY').hostName = `Distant ${i}`;
    f.service.changed('FARAWAY');
  }
  await tick();
  assert.equal(reads, afterWarmup, 'no unrelated watch rescans/enrichments');
  assert.equal(guest.pushed.length, 0);
});
test('matching watchers share enrichment and a scope change invalidates both old and new areas', async t => {
  let reads = 0;
  const f = fixture(t, async () => {
    reads++;
    return null;
  });
  const host = f.client('host', 'host');
  await host.request('nearby:publish', area);
  const guests = Array.from({ length: 40 }, (_, i) => f.client(`guest-${i}`));
  await Promise.all(guests.map(guest => guest.request('nearby:search', { ...area, schemaVersion: 5, watchId: randomUUID() })));
  const global = f.client('worldwide');
  await global.request('nearby:search', { schemaVersion: 5, worldwide: true, watchId: randomUUID() });
  const before = reads;
  f.room.hostName = 'Renamed host';
  f.service.changed('ABCDEF');
  await tick();
  assert.equal(reads, before + 1, 'one query snapshot for 40 matching watches');
  for (const guest of guests) assert.equal(guest.pushed.at(-1).data.reply.results[0].hostName, 'Renamed host');
  assert.equal(global.pushed.length, 0);
  await host.request('nearby:publish', { schemaVersion: 2, worldwide: true });
  await tick();
  for (const guest of guests) assert.deepEqual(guest.pushed.at(-1).data.reply.results, []);
  assert.equal(global.pushed.at(-1).data.reply.results[0].roomId, 'ABCDEF');
});
test('held background room renews only with live host activity, then reconnects briefly before removal', async t => {
  const f = fixture(t),
    host = f.client('host', 'host'),
    guest = f.client('guest');
  await host.request('nearby:publish', area);
  assert.equal((await guest.request('nearby:hold', {})).ok, false);
  assert.equal((await host.request('nearby:hold', {})).ok, true);
  for (let i = 0; i < 5; i++) {
    f.advance(25_000);
    f.service.touch('ABCDEF');
  }
  assert.equal(f.service.publicVisibility('ABCDEF'), 'nearby');
  const watch = { ...area, schemaVersion: 5, watchId: randomUUID() };
  await guest.request('nearby:search', watch);
  f.room.hostId = null;
  f.service.disconnected('ABCDEF');
  await tick();
  assert.equal(guest.pushed.at(-1).data.reply.results[0].connection, 'reconnecting');
  f.advance(7000);
  f.room.hostId = 'host';
  f.service.resumed('ABCDEF');
  await tick();
  assert.equal(guest.pushed.at(-1).data.reply.results[0].connection, 'online');
  f.room.hostId = null;
  f.service.disconnected('ABCDEF');
  f.advance(8000);
  await tick();
  assert.deepEqual(guest.pushed.at(-1).data.reply.results, []);
  assert.equal(f.service.publicVisibility('ABCDEF'), null);
  f.room.hostId = 'host';
  f.service.touch('ABCDEF');
  assert.equal(f.service.publicVisibility('ABCDEF'), null, 'heartbeat cannot resurrect an expired lease');
});
test('public artist seal requires a connected announced artist for the current release', () => {
  const track = { runtimeAddress: '0xABC', hash: '0xDEF' };
  const member = { socketId: 'artist', artist: { runtime: '0xabc', hash: '0xdef' } };
  const room = { track, listeners: new Map([['artist', {}]]), lifeMembers: new Map([['token', member]]) };
  assert.equal(announcedArtistPresent(room), true);
  room.track = { ...track, hash: '0x123' };
  assert.equal(announcedArtistPresent(room), false);
  room.track = track;
  member.socketId = null;
  assert.equal(announcedArtistPresent(room), false);
  member.socketId = 'artist';
  member.artist = undefined;
  assert.equal(announcedArtistPresent(room), false);
  assert.deepEqual(roomProfile({ name: ' Escale\n à Libreville ', introduction: ' Discover together. ' }), {
    name: 'Escale à Libreville',
    introduction: 'Discover together.'
  });
  assert.equal(roomProfile({ name: 'a'.repeat(61), introduction: '' }), null);
  assert.equal(roomProfile({ name: '', introduction: '', artistPresent: true }), null);
});
