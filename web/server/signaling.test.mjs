// Integration tests for the Dotify signaling server (Ticket 04).
// Run with: npm run test:signal
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { io as ioClient } from 'socket.io-client';
import { startSignalingServer } from './signaling.mjs';

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
