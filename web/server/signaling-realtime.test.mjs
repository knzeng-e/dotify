import assert from 'node:assert/strict';
import { createECDH } from 'node:crypto';
import { afterEach, beforeEach, it } from 'node:test';
import { io } from 'socket.io-client';
import { startSignalingServer } from './signaling.mjs';

let server;
let port;
let clients;
const ack = (client, event, payload) =>
  new Promise((resolve, reject) => client.timeout(2000).emit(event, payload, (error, value) => (error ? reject(error) : resolve(value))));
const once = (client, event) => new Promise(resolve => client.once(event, resolve));
// A registration ack can arrive before its broadcast on another socket. Wait
// for the newer revision under test, rather than consuming that queued roster.
function nextRoster(client, afterRevision) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off('room:realtime-roster', onRoster);
      reject(new Error('Updated roster not received'));
    }, 2000);
    function onRoster(roster) {
      if (roster.revision <= afterRevision) return;
      clearTimeout(timer);
      client.off('room:realtime-roster', onRoster);
      resolve(roster);
    }
    client.on('room:realtime-roster', onRoster);
  });
}
function key() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return ecdh.getPublicKey().toString('base64url');
}
async function client() {
  const socket = io(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
  clients.push(socket);
  await once(socket, 'connect');
  return socket;
}
beforeEach(async () => {
  server = startSignalingServer({ port: 0, host: '127.0.0.1', logger: () => {} });
  port = await server.listen();
  clients = [];
});
afterEach(async () => {
  clients.forEach(socket => socket.disconnect());
  await server.close();
});
async function pair() {
  const host = await client();
  const created = await ack(host, 'room:create', {});
  const guest = await client();
  await ack(guest, 'room:join', { roomId: created.roomId });
  return { host, guest, created };
}

it('calibrates only admitted room clients with a bounded, process-scoped clock', async () => {
  const outsider = await client();
  assert.deepEqual(await ack(outsider, 'room:realtime-clock', {}), { ok: false });
  const { host, guest } = await pair();
  const before = Date.now();
  const first = await ack(host, 'room:realtime-clock', {});
  assert.equal(first.ok, true);
  assert.ok(first.time >= before && first.time <= Date.now());
  assert.match(first.server, /^[a-f0-9]{32}$/);
  assert.equal((await ack(guest, 'room:realtime-clock', {})).server, first.server);
  for (let i = 0; i < 9; i++) assert.equal((await ack(host, 'room:realtime-clock', {})).ok, true);
  assert.deepEqual(await ack(host, 'room:realtime-clock', {}), { ok: false });
});

it('binds ephemeral keys to real membership and server roles, never self-declared identities', async () => {
  const outsider = await client();
  assert.equal((await ack(outsider, 'room:realtime-register', { publicKey: key() })).ok, false);
  const { host, guest } = await pair();
  const first = await ack(host, 'room:realtime-register', { publicKey: key(), role: 'listener', id: 'fake' });
  assert.equal(first.ok, true);
  assert.equal(first.roster.peers[0].role, 'host');
  assert.notEqual(first.self, 'fake');
  const update = nextRoster(host, first.roster.revision);
  const second = await ack(guest, 'room:realtime-register', { publicKey: key(), role: 'host' });
  assert.equal(second.roster.scope, first.roster.scope);
  assert.equal(second.roster.peers.find(peer => peer.id === second.self).role, 'listener');
  assert.equal((await update).revision, second.roster.revision);
  assert.equal(second.roster.peers.length, 2);
  const status = JSON.stringify(await (await fetch(`http://127.0.0.1:${port}/status`)).json());
  assert.equal(status.includes(second.self), false);
  assert.equal(status.includes(second.roster.scope), false);
  assert.equal(status.includes(first.roster.peers[0].publicKey), false);
});

it('revokes disconnected members and gives reconnects new producer identities', async () => {
  const { host, guest, created } = await pair();
  const hostRegistered = await ack(host, 'room:realtime-register', { publicKey: key() });
  const added = nextRoster(host, hostRegistered.roster.revision);
  const registered = await ack(guest, 'room:realtime-register', { publicKey: key() });
  await added;
  const removed = nextRoster(host, registered.roster.revision);
  guest.disconnect();
  const roster = await removed;
  assert.ok(roster.revision > registered.roster.revision);
  assert.equal(
    roster.peers.some(peer => peer.id === registered.self),
    false
  );
  const returning = await client();
  await ack(returning, 'room:join', { roomId: created.roomId });
  const fresh = await ack(returning, 'room:realtime-register', { publicKey: key() });
  assert.notEqual(fresh.self, registered.self);
});

it('revokes host identity during reconnect and restores host role only via resume token', async () => {
  const { host, guest, created } = await pair();
  const registered = await ack(host, 'room:realtime-register', { publicKey: key() });
  const listenerRegistered = await ack(guest, 'room:realtime-register', { publicKey: key() });
  const removed = nextRoster(guest, listenerRegistered.roster.revision);
  host.disconnect();
  assert.equal(
    (await removed).peers.some(peer => peer.role === 'host'),
    false
  );
  const returning = await client();
  assert.equal((await ack(returning, 'room:realtime-register', { publicKey: key() })).ok, false);
  assert.equal((await ack(returning, 'room:resume', { roomId: created.roomId, hostResumeToken: created.hostResumeToken })).ok, true);
  const fresh = await ack(returning, 'room:realtime-register', { publicKey: key() });
  assert.notEqual(fresh.self, registered.self);
  assert.equal(fresh.roster.peers.find(peer => peer.id === fresh.self).role, 'host');
});

it('isolates rooms and rejects malformed curve points and duplicated peer keys', async () => {
  const { host, guest } = await pair();
  const publicKey = key();
  const first = await ack(host, 'room:realtime-register', { publicKey });
  assert.equal((await ack(guest, 'room:realtime-register', { publicKey })).ok, false);
  const other = await client();
  await ack(other, 'room:create', {});
  const second = await ack(other, 'room:realtime-register', { publicKey: key() });
  assert.notEqual(second.roster.scope, first.roster.scope);
  assert.equal(second.roster.peers.length, 1);
  const malformed = await client();
  const rooms = await (await fetch(`http://127.0.0.1:${port}/status`)).json();
  await ack(malformed, 'room:join', { roomId: rooms.rooms[0].roomId });
  assert.equal(
    (await ack(malformed, 'room:realtime-register', { publicKey: Buffer.concat([Buffer.from([4]), Buffer.alloc(64)]).toString('base64url') })).ok,
    false
  );
});

it('ignores stale unsubscribe credentials and unregisters only the caller', async () => {
  const { host, guest } = await pair();
  const h = await ack(host, 'room:realtime-register', { publicKey: key() });
  const g = await ack(guest, 'room:realtime-register', { publicKey: key() });
  guest.emit('room:realtime-unregister', { scope: h.roster.scope, self: h.self });
  await ack(guest, 'room:rename', { displayName: 'still admitted' });
  const updated = nextRoster(host, g.roster.revision);
  guest.emit('room:realtime-unregister', { scope: g.roster.scope, self: g.self });
  assert.deepEqual(
    (await updated).peers.map(peer => peer.id),
    [h.self]
  );
});
