import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { io } from 'socket.io-client';
import { createNearbyPreview } from './nearby-preview.mjs';
import { startSignalingServer } from './signaling.mjs';
const consent = { areaId: 'lisbon-region', consent: true };
const rooms = [{ roomId: 'ABCDEF', listenerCount: 2, track: { title: 'Together', artist: 'Ada', audioRef: 'secret', walletAddress: 'secret' } }];

test('nearby manual-area preview fails closed on disabled, extra fields, unbounded areas and missing consent', () => {
  const off = createNearbyPreview();
  assert.deepEqual(off.areas(), []);
  assert.equal(off.publish('ABCDEF', consent).ok, false);
  assert.equal(off.search('a', consent, rooms).ok, false);
  const preview = createNearbyPreview({ enabled: true });
  for (const invalid of [
    null,
    {},
    { ...consent, consent: false },
    { ...consent, lat: 38.7223 },
    { ...consent, walletAddress: '0x123' },
    { ...consent, areaId: 'unbounded' },
    { ...consent, areaCells: [] }
  ]) {
    assert.equal(preview.publish('ABCDEF', invalid).ok, false);
    assert.equal(preview.search('a', invalid, rooms).ok, false);
  }
});

test('nearby expires, rotates, revokes and forgets without leaking unsafe metadata or exact counts', () => {
  let now = 1000;
  const preview = createNearbyPreview({ enabled: true, now: () => now, rotationMs: 60_000 });
  preview.publish('ABCDEF', consent);
  const first = preview.search('a', consent, rooms);
  assert.equal(first.results.length, 1);
  assert.equal(first.results[0].listenerCountBucket, '1-3');
  assert.equal(JSON.stringify(first).includes('secret'), false);
  assert.equal(first.expiresAt, now + 30_000);
  assert.equal(preview.search('b', { ...consent, areaId: 'paris-region' }, rooms).results.length, 0);
  now += 60_001;
  preview.publish('ABCDEF', consent);
  const rotated = preview.search('c', consent, rooms);
  assert.notEqual(rotated.results[0].discoveryId, first.results[0].discoveryId);
  preview.revoke('ABCDEF');
  assert.equal(preview.search('d', consent, rooms).results.length, 0);
  preview.publish('ABCDEF', consent);
  now += 90_001;
  preview.sweep();
  assert.equal(preview.search('e', consent, rooms).results.length, 0);
  preview.publish('ABCDEF', consent);
  preview.forget('ABCDEF');
  assert.equal(preview.search('f', consent, rooms).results.length, 0);
});

test('nearby bounds query churn, host updates, result size and response lifetime', () => {
  const preview = createNearbyPreview({ enabled: true, now: () => 1000 });
  for (let i = 0; i < 6; i++) assert.equal(preview.search('network-a', consent, []).ok, true);
  assert.equal(preview.search('network-a', consent, []).ok, false);
  assert.equal(preview.search('network-b', consent, []).ok, true);
  for (let i = 0; i < 6; i++) assert.equal(preview.publish('ABCDEF', consent).ok, true);
  assert.equal(preview.publish('ABCDEF', consent).ok, false);
  const crowd = Array.from({ length: 30 }, (_, i) => ({ ...rooms[0], roomId: `room-${i}` }));
  crowd.forEach(room => preview.publish(room.roomId, consent));
  assert.equal(preview.search('network-c', consent, crowd).results.length, 20);
});

test('only a real host can publish; revoke, disconnect and close remove listing; no public status or logs carry area', async t => {
  const logs = [];
  const server = startSignalingServer({ port: 0, host: '127.0.0.1', nearbyPreviewEnabled: true, logger: line => logs.push(line) });
  const port = await server.listen();
  const clients = [];
  t.after(async () => {
    clients.forEach(client => client.disconnect());
    await server.close();
  });
  async function connect() {
    const client = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], reconnection: false });
    clients.push(client);
    await once(client, 'connect');
    return client;
  }
  const host = await connect();
  const created = await host.emitWithAck('room:create', { displayName: 'Ada' });
  const guest = await connect();
  await guest.emitWithAck('room:join', { roomId: created.roomId });
  assert.equal((await guest.emitWithAck('nearby:publish', consent)).ok, false);
  assert.equal((await host.emitWithAck('nearby:publish', { ...consent, roomId: 'SPOOF' })).ok, false);
  assert.equal((await host.emitWithAck('nearby:publish', consent)).ok, true);
  assert.equal((await guest.emitWithAck('nearby:search', consent)).results.length, 1);
  await host.emitWithAck('nearby:revoke');
  assert.equal((await guest.emitWithAck('nearby:search', consent)).results.length, 0);
  await host.emitWithAck('nearby:publish', consent);
  const lost = once(guest, 'room:host-connection');
  host.disconnect();
  await lost;
  assert.equal((await guest.emitWithAck('nearby:search', consent)).results.length, 0);
  const resumedHost = await connect();
  await resumedHost.emitWithAck('room:resume', { roomId: created.roomId, hostResumeToken: created.hostResumeToken });
  assert.equal((await guest.emitWithAck('nearby:search', consent)).results.length, 0);
  await resumedHost.emitWithAck('nearby:publish', consent);
  const status = await (await fetch(`http://127.0.0.1:${port}/status`)).text();
  assert.equal(status.includes('lisbon-region'), false);
  assert.equal(logs.join('').includes('lisbon-region'), false);
  const closed = once(guest, 'room:closed');
  resumedHost.emit('room:leave');
  await closed;
  assert.equal((await guest.emitWithAck('nearby:search', consent)).results.length, 0);
});
