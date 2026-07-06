// Integration tests for the Dotify signaling server (Ticket 04).
// Run with: npm run test:signal
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { io as ioClient } from 'socket.io-client';
import { startSignalingServer } from './signaling.mjs';
import { clientKey, createWindowLimiter } from './signaling-utils.mjs';

let server;
let port;
let clients;

function connectClient() {
  const client = ioClient(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
  clients.push(client);
  return client;
}

function once(socket, event) {
  return new Promise(resolve => socket.once(event, resolve));
}

function emitAck(socket, event, payload) {
  return new Promise(resolve => socket.emit(event, payload, resolve));
}

async function createRoom(hostSocket, payload = {}) {
  await once(hostSocket, 'connect');
  return emitAck(hostSocket, 'room:create', { displayName: 'Host', ...payload });
}

beforeEach(async () => {
  server = startSignalingServer({
    port: 0,
    host: '127.0.0.1',
    maxListenersPerRoom: 2,
    sweepIntervalMs: 40,
    logger: () => {}
  });
  port = await server.listen();
  clients = [];
});

afterEach(async () => {
  for (const client of clients) client.disconnect();
  await server.close();
});

describe('signaling server', () => {
  it('creates a room and lets a listener join by code without any credential', async () => {
    const host = connectClient();
    const created = await createRoom(host, { hostAddress: '0x1111111111111111111111111111111111111111', track: { title: 'Night Drive', artist: 'Ada' } });
    assert.equal(created.ok, true);
    assert.match(created.roomId, /^[A-Z2-9]{6}$/);

    const listener = connectClient();
    await once(listener, 'connect');
    const joined = await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Guest' });

    assert.equal(joined.ok, true);
    assert.equal(joined.hostName, 'Host');
    assert.equal(joined.listenerCount, 1);
    assert.equal(joined.playbackMode, 'full');
    assert.equal(joined.track.title, 'Night Drive');
  });

  it('exposes host-based access metadata on the status endpoint', async () => {
    const host = connectClient();
    const created = await createRoom(host, {
      hostAddress: '0xAbCd00000000000000000000000000000000Ef12',
      track: { title: 'Aurora', artist: 'Ada', accessMode: 'classic' }
    });

    const res = await fetch(`http://127.0.0.1:${port}/status`);
    const body = await res.json();
    const room = body.rooms.find(r => r.roomId === created.roomId);

    assert.ok(room, 'room is listed');
    assert.equal(room.listenersNeedWalletAccess, false);
    assert.equal(room.hostAccessRequired, true);
    assert.equal(room.hostAddress, '0xabcd00000000000000000000000000000000ef12');
    assert.equal(room.playbackMode, 'full');
    assert.ok(room.expiresAt > room.createdAt);
  });

  it('honors preview playback mode at room creation', async () => {
    const host = connectClient();
    const created = await createRoom(host, {
      playbackMode: 'preview',
      track: { title: 'Preview locked', artist: 'Ada', accessMode: 'classic' }
    });

    const listener = connectClient();
    await once(listener, 'connect');
    const joined = await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Guest' });
    assert.equal(joined.playbackMode, 'preview');

    const res = await fetch(`http://127.0.0.1:${port}/status`);
    const body = await res.json();
    assert.equal(body.rooms.find(r => r.roomId === created.roomId).playbackMode, 'preview');
  });

  it('omits access-control-allow-origin for disallowed status origins', async () => {
    await server.close();
    server = startSignalingServer({
      port: 0,
      host: '127.0.0.1',
      origins: ['https://dotify.example'],
      logger: () => {}
    });
    port = await server.listen();

    const denied = await fetch(`http://127.0.0.1:${port}/status`, {
      headers: { origin: 'https://evil.example' }
    });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);

    const allowed = await fetch(`http://127.0.0.1:${port}/status`, {
      headers: { origin: 'https://dotify.example' }
    });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://dotify.example');
  });

  it('broadcasts host playback-mode changes to listeners and room metadata', async () => {
    const host = connectClient();
    const created = await createRoom(host, { track: { title: 'Aurora', artist: 'Ada' } });

    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Guest' });

    const modeChange = once(listener, 'room:playback-mode');
    host.emit('room:playback-mode', { playbackMode: 'preview' });
    const received = await modeChange;
    assert.equal(received.playbackMode, 'preview');

    const res = await fetch(`http://127.0.0.1:${port}/status`);
    const body = await res.json();
    assert.equal(body.rooms.find(r => r.roomId === created.roomId).playbackMode, 'preview');
  });

  it('rejects listeners beyond the per-room cap', async () => {
    const host = connectClient();
    const created = await createRoom(host);

    const first = connectClient();
    await once(first, 'connect');
    assert.equal((await emitAck(first, 'room:join', { roomId: created.roomId })).ok, true);

    const second = connectClient();
    await once(second, 'connect');
    assert.equal((await emitAck(second, 'room:join', { roomId: created.roomId })).ok, true);

    const third = connectClient();
    await once(third, 'connect');
    const rejected = await emitAck(third, 'room:join', { roomId: created.roomId });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.code, 'ROOM_FULL');
  });

  it('closes the room and notifies listeners when the host disconnects', async () => {
    const host = connectClient();
    const created = await createRoom(host);

    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId });

    const closed = once(listener, 'room:closed');
    host.disconnect();
    const payload = await closed;
    assert.match(payload.reason, /Host left/i);
    assert.equal(server.rooms.size, 0);
  });

  it('cleans up listener state on listener disconnect', async () => {
    const host = connectClient();
    const created = await createRoom(host);

    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId });

    const left = once(host, 'listener:left');
    listener.disconnect();
    const payload = await left;
    assert.equal(payload.listenerCount, 0);
    assert.equal(server.rooms.get(created.roomId).listeners.size, 0);
  });

  it('routes listener audio retry requests back to the host', async () => {
    const host = connectClient();
    const created = await createRoom(host);

    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Gabe' });

    const ready = once(host, 'listener:ready');
    listener.emit('listener:ready');
    const payload = await ready;
    assert.equal(payload.displayName, 'Gabe');
    assert.equal(payload.listenerCount, 1);
    assert.equal(typeof payload.listenerId, 'string');
  });

  it('expires rooms past their TTL', async () => {
    await server.close();
    server = startSignalingServer({ port: 0, host: '127.0.0.1', roomTtlMs: 50, sweepIntervalMs: 20, logger: () => {} });
    port = await server.listen();

    const host = connectClient();
    const created = await createRoom(host);
    assert.equal(created.ok, true);

    const closed = await once(host, 'room:closed');
    assert.match(closed.reason, /expired/i);
    assert.equal(server.rooms.size, 0);
  });

  it('closes rooms whose host stops heartbeating', async () => {
    await server.close();
    server = startSignalingServer({ port: 0, host: '127.0.0.1', hostHeartbeatTimeoutMs: 60, sweepIntervalMs: 20, logger: () => {} });
    port = await server.listen();

    const host = connectClient();
    await createRoom(host);

    // Heartbeats keep the room alive past the timeout window.
    const keepAlive = setInterval(() => host.emit('host:heartbeat'), 25);
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(server.rooms.size, 1, 'heartbeating host keeps the room open');

    clearInterval(keepAlive);
    const closed = await once(host, 'room:closed');
    assert.match(closed.reason, /Host connection lost/i);
    assert.equal(server.rooms.size, 0);
  });

  it('reports health with room and listener counts', async () => {
    const host = connectClient();
    await createRoom(host);

    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.rooms, 1);
    assert.equal(body.listeners, 0);
  });
});

// Collect every emission of an event for a short window; used to assert both
// what arrives and what is (correctly) never sent.
function collect(socket, event, ms = 150) {
  const received = [];
  socket.on(event, payload => received.push(payload));
  return new Promise(resolve => setTimeout(() => resolve(received), ms));
}

describe('room social layer', () => {
  it('broadcasts curated reactions to the whole room with sender attribution', async () => {
    const host = connectClient();
    const created = await createRoom(host, { displayName: 'Ada' });

    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Guest' });

    const hostSees = collect(host, 'room:reaction');
    const listenerSees = collect(listener, 'room:reaction');
    host.emit('room:reaction', { emoji: '✨' });

    const [hostReactions, listenerReactions] = await Promise.all([hostSees, listenerSees]);
    assert.equal(hostReactions.length, 1, 'sender receives the echo');
    assert.equal(listenerReactions.length, 1);
    assert.equal(listenerReactions[0].emoji, '✨');
    assert.equal(listenerReactions[0].senderName, 'Ada');
    assert.equal(typeof listenerReactions[0].id, 'string');
    assert.equal(typeof listenerReactions[0].ts, 'number');
  });

  it('drops reactions outside the curated set', async () => {
    const host = connectClient();
    const created = await createRoom(host);

    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Guest' });

    const hostSees = collect(host, 'room:reaction');
    listener.emit('room:reaction', { emoji: '\u{1F480}' });
    listener.emit('room:reaction', { emoji: 'not-an-emoji' });
    listener.emit('room:reaction', {});

    assert.equal((await hostSees).length, 0);
  });

  it('relays chat to the room and replays capped history to late joiners', async () => {
    const host = connectClient();
    const created = await createRoom(host, { displayName: 'Ada' });

    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Gabe' });

    const hostSees = collect(host, 'room:chat');
    listener.emit('room:chat', { text: '  this   track \n is alive  ' });
    const [message] = await hostSees;

    assert.ok(message, 'host receives the chat message');
    assert.equal(message.text, 'this track is alive', 'text is sanitized to a single line');
    assert.equal(message.senderName, 'Gabe');

    const late = connectClient();
    await once(late, 'connect');
    const joined = await emitAck(late, 'room:join', { roomId: created.roomId, displayName: 'Late' });
    assert.equal(joined.ok, true);
    assert.equal(joined.chatHistory.length, 1);
    assert.equal(joined.chatHistory[0].text, 'this track is alive');
  });

  it('caps the per-room chat history at the configured limit', async () => {
    await server.close();
    server = startSignalingServer({ port: 0, host: '127.0.0.1', chatHistoryLimit: 3, chatRateLimit: { limit: 100, windowMs: 5_000 }, logger: () => {} });
    port = await server.listen();

    const host = connectClient();
    const created = await createRoom(host);
    for (let i = 1; i <= 5; i += 1) {
      host.emit('room:chat', { text: `message ${i}` });
    }
    await collect(host, 'room:chat');

    const listener = connectClient();
    await once(listener, 'connect');
    const joined = await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Guest' });
    assert.deepEqual(
      joined.chatHistory.map(m => m.text),
      ['message 3', 'message 4', 'message 5']
    );
  });

  it('rate limits chat per socket, dropping silently past the window limit', async () => {
    await server.close();
    server = startSignalingServer({ port: 0, host: '127.0.0.1', chatRateLimit: { limit: 2, windowMs: 5_000 }, logger: () => {} });
    port = await server.listen();

    const host = connectClient();
    const created = await createRoom(host);

    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Guest' });

    const hostSees = collect(host, 'room:chat');
    for (let i = 1; i <= 4; i += 1) {
      listener.emit('room:chat', { text: `burst ${i}` });
    }

    const received = await hostSees;
    assert.equal(received.length, 2);
    assert.deepEqual(
      received.map(m => m.text),
      ['burst 1', 'burst 2']
    );
  });

  it('ignores social events from sockets that are not room participants', async () => {
    const host = connectClient();
    const created = await createRoom(host);

    const outsider = connectClient();
    await once(outsider, 'connect');

    const hostSees = collect(host, 'room:chat');
    outsider.emit('room:chat', { text: 'let me in' });

    assert.equal((await hostSees).length, 0);
    assert.equal(server.rooms.get(created.roomId).chat.length, 0);
  });

  it('throttles join churn per network address so reconnects cannot reset per-socket budgets', async () => {
    await server.close();
    server = startSignalingServer({ port: 0, host: '127.0.0.1', joinRateLimit: { limit: 2, windowMs: 10_000 }, logger: () => {} });
    port = await server.listen();

    const host = connectClient();
    const created = await createRoom(host);

    // Each rejoin is a fresh socket id but the same loopback address -- the
    // exact disconnect/rejoin move an attacker would use to reset limits.
    const first = connectClient();
    await once(first, 'connect');
    assert.equal((await emitAck(first, 'room:join', { roomId: created.roomId })).ok, true);

    const second = connectClient();
    await once(second, 'connect');
    assert.equal((await emitAck(second, 'room:join', { roomId: created.roomId })).ok, true);

    // Third join from the same address within the window is refused even
    // though it is a brand-new socket id.
    const third = connectClient();
    await once(third, 'connect');
    const throttled = await emitAck(third, 'room:join', { roomId: created.roomId });
    assert.equal(throttled.ok, false);
    assert.equal(throttled.code, 'JOIN_THROTTLED');
  });

  it('keeps chat out of the public status endpoint', async () => {
    const host = connectClient();
    const created = await createRoom(host);
    host.emit('room:chat', { text: 'private to the room' });
    await collect(host, 'room:chat');

    const res = await fetch(`http://127.0.0.1:${port}/status`);
    const body = await res.json();
    const room = body.rooms.find(r => r.roomId === created.roomId);
    assert.ok(room);
    assert.equal(room.chat, undefined);
    assert.equal(JSON.stringify(body).includes('private to the room'), false);
  });
});

describe('window limiter', () => {
  it('drops buckets whose window has fully elapsed so durable keys stay bounded', () => {
    const limiter = createWindowLimiter(3, 1_000);
    assert.equal(limiter.allow('1.2.3.4', 0), true);
    assert.equal(limiter.allow('5.6.7.8', 0), true);
    assert.equal(limiter.size(), 2);

    limiter.prune(500); // still inside the window: nothing dropped
    assert.equal(limiter.size(), 2);

    limiter.prune(1_500); // window elapsed for both keys
    assert.equal(limiter.size(), 0);
  });
});

describe('clientKey', () => {
  it('uses the raw socket address by default and ignores x-forwarded-for', () => {
    const socket = { handshake: { address: '10.0.0.9', headers: { 'x-forwarded-for': '1.1.1.1' } } };
    assert.equal(clientKey(socket), '10.0.0.9');
  });

  it('reads the first forwarded hop only when trustProxy is enabled', () => {
    const socket = { handshake: { address: '10.0.0.9', headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' } } };
    assert.equal(clientKey(socket, { trustProxy: true }), '1.1.1.1');
  });

  it('falls back to unknown when no address is present', () => {
    assert.equal(clientKey({ handshake: {} }), 'unknown');
    assert.equal(clientKey(undefined), 'unknown');
  });
});
