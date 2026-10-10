import assert from 'node:assert/strict';
import { test } from 'node:test';
import { io } from 'socket.io-client';
import { startSignalingServer } from './signaling.mjs';
import { createRoomLife } from './room-life.mjs';
import { createRoomContributions } from './room-contributions.mjs';

const address = `0x${'11'.repeat(20)}`;
const other = `0x${'33'.repeat(20)}`;
const hash = `0x${'22'.repeat(32)}`;
const track = { title: 'Submitted title', artist: 'Submitted alias', hash, runtimeAddress: address };
const config = { chainId: 42, directory: address, api: 'https://api.example/api' };
const deps = {
  client: {
    getChainId: async () => 42,
    readContract: async ({ functionName }) =>
      functionName === 'runtimeOf' ? address : [{ artist: address, active: true, title: 'Canonical title', artistName: 'Canonical artist' }]
  },
  fetch: async (_url, options) => ({ ok: options.headers.Authorization === 'Bearer valid', json: async () => ({ address, chainId: 42 }) })
};
const ack = (socket, event, payload) =>
  new Promise((resolve, reject) => socket.timeout(3000).emit(event, payload, (error, result) => (error ? reject(error) : resolve(result))));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function setup(t) {
  const server = startSignalingServer({ port: 0, host: '127.0.0.1', contributions: config, logger: () => {} }, { contributions: deps });
  const port = await server.listen();
  const clients = [];
  t.after(async () => {
    clients.forEach(socket => socket.disconnect());
    await server.close();
  });
  async function connect() {
    const socket = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], reconnection: false });
    clients.push(socket);
    await new Promise(resolve => socket.once('connect', resolve));
    return socket;
  }
  const host = await connect();
  const { roomId, hostResumeToken } = await ack(host, 'room:create', { displayName: 'Host', track });
  return { server, port, host, roomId, hostResumeToken, connect };
}

test('typing is admitted, attributed, room-only, expires and never carries drafts', async t => {
  const { host, roomId, connect, port } = await setup(t);
  const guest = await connect();
  const outsider = await connect();
  assert.equal((await ack(outsider, 'room:join', null)).ok, false);
  assert.equal((await ack(host, 'room:pin', null)).ok, false);
  host.emit('room:typing', null);
  await ack(guest, 'room:join', { roomId, displayName: 'Ada' });
  const events = [];
  host.on('room:typing', event => events.push(event));
  outsider.emit('room:typing', { active: true, name: 'Spoof' });
  guest.emit('room:typing', { active: true, name: 'Spoof', draft: 'private draft' });
  await pause(50);
  assert.equal(events.length, 1);
  assert.equal(events[0][0].name, 'Ada');
  assert.equal(events[0][0].draft, undefined);
  const status = JSON.stringify(await (await fetch(`http://127.0.0.1:${port}/status`)).json());
  assert.ok(!status.includes('Ada') && !status.includes('typing'));
  await pause(4550);
  assert.deepEqual(events.at(-1), []);
});

test('replies, mentions and pins use server history and host authority', async t => {
  const { host, roomId, connect, server } = await setup(t);
  const guest = await connect();
  await ack(guest, 'room:join', { roomId, displayName: 'Ada' });
  await ack(host, 'room:chat', { text: 'Ask me anything' });
  const first = server.rooms.get(roomId).chat[0];
  await ack(guest, 'room:chat', { text: 'Hello', replyTo: first.id, mentions: [host.id, 'forged-id'], artist: { name: 'Forged artist' } });
  const second = server.rooms.get(roomId).chat[1];
  assert.equal(second.replyTo.text, 'Ask me anything');
  assert.deepEqual(second.mentions, [host.id]);
  assert.equal(second.artist, undefined);
  assert.equal((await ack(guest, 'room:pin', { id: second.id })).ok, false);
  assert.equal((await ack(host, 'room:pin', { id: second.id })).ok, true);
  const newcomer = await connect();
  const joined = await ack(newcomer, 'room:join', { roomId, displayName: 'Bo' });
  assert.equal(joined.pinnedMessage.id, second.id);
  assert.equal((await ack(host, 'room:pin', { id: 'not-in-history' })).ok, false);
  assert.equal((await ack(host, 'room:pin', { id: null })).ok, true);
  assert.equal(server.rooms.get(roomId).pinnedMessage, null);
});

test('artist visits require a valid session and canonical release, and discreet joins expose no badge', async t => {
  const { host, roomId, connect, server, port } = await setup(t);
  const guest = await connect();
  assert.equal((await ack(guest, 'room:join', { roomId, displayName: 'Canonical artist', announceArtist: true, artistToken: 'forged' })).ok, false);
  const joined = await ack(guest, 'room:join', { roomId, displayName: 'Alias', announceArtist: true, artistToken: 'valid' });
  assert.equal(joined.ok, true);
  await ack(guest, 'room:chat', { text: 'Hello everyone' });
  assert.deepEqual(server.rooms.get(roomId).chat[0].artist, { name: 'Canonical artist', title: 'Canonical title', runtime: address, hash });
  await pause(1300);
  assert.equal(server.rooms.get(roomId).activity[0].kind, 'artist-joined');
  const status = await (await fetch(`http://127.0.0.1:${port}/status`)).text();
  assert.ok(!status.includes('Canonical artist') && !status.includes(joined.listenerResumeToken));
  guest.emit('room:artist-clear');
  await ack(guest, 'room:chat', { text: 'Changed account' });
  assert.equal(server.rooms.get(roomId).chat.at(-1).artist, undefined);
  guest.emit('room:leave');
  await ack(host, 'room:chat', { text: 'Goodbye' });
  assert.equal(server.rooms.get(roomId).activity.at(-1).kind, 'artist-left');
  await ack(guest, 'room:join', { roomId, displayName: 'Quiet', artistToken: 'valid' });
  await ack(guest, 'room:chat', { text: 'Ordinary guest' });
  assert.equal(server.rooms.get(roomId).chat.at(-1).artist, undefined);
});

test('a short reconnect preserves artist continuity without duplicate welcomes', async t => {
  const { roomId, connect, server } = await setup(t);
  const guest = await connect();
  const joined = await ack(guest, 'room:join', { roomId, displayName: 'Ada', announceArtist: true, artistToken: 'valid' });
  await pause(1300);
  guest.disconnect();
  await pause(40);
  const reconnect = await connect();
  const resumed = await ack(reconnect, 'room:join', { roomId, displayName: 'Ada', listenerResumeToken: joined.listenerResumeToken });
  assert.equal(resumed.listenerResumeToken, joined.listenerResumeToken);
  await ack(reconnect, 'room:chat', { text: 'Back' });
  assert.equal(server.rooms.get(roomId).chat.at(-1).artist.name, 'Canonical artist');
  await pause(1300);
  assert.deepEqual(
    server.rooms.get(roomId).activity.map(event => event.kind),
    ['artist-joined']
  );
});

test('a resumed host receives the current conversation and pin snapshot', async t => {
  const { host, roomId, hostResumeToken, connect, server } = await setup(t);
  await ack(host, 'room:chat', { text: 'Question for the room' });
  const message = server.rooms.get(roomId).chat[0];
  await ack(host, 'room:pin', { id: message.id });
  host.disconnect();
  await pause(40);
  const returning = await connect();
  const response = await ack(returning, 'room:resume', { roomId, hostResumeToken });
  assert.equal(response.ok, true);
  assert.equal(response.pinnedMessage.id, message.id);
  assert.equal(response.chatHistory[0].id, message.id);
});

test('room closure cannot carry a visitor badge into a later hosting session', async t => {
  const { host, roomId, connect, server } = await setup(t);
  const guest = await connect();
  await ack(guest, 'room:join', { roomId, announceArtist: true, artistToken: 'valid' });
  const closed = new Promise(resolve => guest.once('room:closed', resolve));
  host.emit('room:leave');
  await closed;
  const next = await ack(guest, 'room:create', { displayName: 'Ordinary host' });
  await ack(guest, 'room:chat', { text: 'A new room' });
  assert.equal(server.rooms.get(next.roomId).chat[0].artist, undefined);
});

test('artist verification fails on wrong account, chain, inactive runtime and changed track', async () => {
  for (const override of [
    { fetch: async () => ({ ok: true, json: async () => ({ address: other, chainId: 42 }) }) },
    { fetch: async () => ({ ok: true, json: async () => ({ address, chainId: 1 }) }) },
    { client: { ...deps.client, readContract: async ({ functionName }) => (functionName === 'runtimeOf' ? other : [{ artist: address, active: true }]) } },
    { client: { ...deps.client, readContract: async () => [{ artist: address, active: false }] } }
  ]) {
    await assert.rejects(() => createRoomContributions(config, { ...deps, ...override }).verifyArtist({ track }, 'valid'));
  }
  const room = { track };
  const service = createRoomContributions(config, {
    ...deps,
    fetch: async (...args) => {
      room.track = { ...track, hash: `0x${'44'.repeat(32)}` };
      return deps.fetch(...args);
    }
  });
  await assert.rejects(() => service.verifyArtist(room, 'valid'), /changed tracks/);
});

test('activity and pin retention is bounded and room close cancels pending work', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const events = [];
  const room = {};
  const rooms = new Map([['room', room]]);
  const life = createRoomLife({ rooms, io: { to: () => ({ emit: (...event) => events.push(event) }) }, historyLimit: 3 });
  t.after(() => life.close());
  for (let i = 0; i < 10; i++) life.activity('room', 'joined', `Guest ${i}`);
  assert.equal(room.activity.length, 3);
  life.pin('room', { id: 'question', text: 'Hello' });
  t.mock.timers.tick(600001);
  assert.equal(room.pinnedMessage, null);
  const socket = { id: 's', data: { roomId: 'room' } };
  life.joined('room', socket, 'Ada');
  life.closeRoom(room);
  rooms.delete('room');
  const count = events.length;
  t.mock.timers.tick(2000);
  assert.equal(events.length, count);
});
