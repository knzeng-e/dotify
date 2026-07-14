// Integration tests for the Dotify signaling server (Ticket 04).
// Run with: npm run test:signal
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { io as ioClient } from 'socket.io-client';
import { startSignalingServer } from './signaling.mjs';
import { clientKey, createWindowLimiter, sanitizeTrack, sanitizeTrackHash } from './signaling-utils.mjs';

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

  it('exposes host-based access metadata without the self-declared host address', async () => {
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
    assert.equal(room.hostAddress, undefined);
    assert.equal(JSON.stringify(body).includes('0xAbCd00000000000000000000000000000000Ef12'), false);
    assert.equal(room.playbackMode, 'full');
    assert.ok(room.expiresAt > room.createdAt);
  });

  it('keeps source and manifest refs out of public summaries, join replies, and track broadcasts', async () => {
    const sourceRef = 'dotify:enc:ipfs://private-source-cid';
    const metadataRef = 'ipfs://manifest-that-reveals-source';
    const bulletinRef = 'bulletin://rights-manifest';
    const host = connectClient();
    const created = await createRoom(host, {
      track: { title: 'Source protected', artist: 'Ada', audioRef: sourceRef, metadataRef, bulletinRef, accessMode: 'free' }
    });

    const publicObserver = connectClient();
    const rooms = await once(publicObserver, 'rooms:updated');
    const publicRoom = rooms.find(room => room.roomId === created.roomId);
    assert.ok(publicRoom, 'room is visible in public summaries');
    assert.equal(publicRoom.track.accessMode, 'free');
    assert.equal(publicRoom.track.audioRef, undefined);
    assert.equal(publicRoom.track.metadataRef, undefined);
    assert.equal(publicRoom.track.bulletinRef, '');
    assert.equal(JSON.stringify(rooms).includes(sourceRef), false);
    assert.equal(JSON.stringify(rooms).includes(metadataRef), false);
    assert.equal(JSON.stringify(rooms).includes(bulletinRef), false);

    const listener = connectClient();
    await once(listener, 'connect');
    const joined = await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Guest' });
    assert.equal(joined.track.accessMode, 'free');
    assert.equal(joined.track.audioRef, undefined);
    assert.equal(joined.track.metadataRef, undefined);
    assert.equal(joined.track.bulletinRef, '');
    assert.equal(JSON.stringify(joined).includes(sourceRef), false);

    const nextSourceRef = 'dotify:enc:ipfs://another-private-source';
    const trackChanged = once(listener, 'room:track');
    host.emit('room:track', {
      title: 'Next source',
      artist: 'Ada',
      audioRef: nextSourceRef,
      metadataRef: 'ipfs://next-manifest',
      bulletinRef: 'bulletin://next-rights',
      accessMode: 'classic'
    });
    const broadcastTrack = await trackChanged;
    assert.equal(broadcastTrack.accessMode, 'classic');
    assert.equal(broadcastTrack.audioRef, undefined);
    assert.equal(broadcastTrack.metadataRef, undefined);
    assert.equal(broadcastTrack.bulletinRef, '');
    assert.equal(JSON.stringify(broadcastTrack).includes(nextSourceRef), false);

    const res = await fetch(`http://127.0.0.1:${port}/status`);
    const body = await res.json();
    assert.equal(JSON.stringify(body).includes('private-source'), false);
  });

  it('exposes counts and non-secret configuration on the health endpoint', async () => {
    const host = connectClient();
    await createRoom(host, { track: { title: 'Night Drive', artist: 'Ada' } });

    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await res.json();

    assert.equal(body.ok, true);
    assert.equal(typeof body.uptimeSeconds, 'number');
    assert.equal(body.rooms, 1);
    assert.equal(body.listeners, 0);
    assert.equal(body.soloListeners, 0);
    assert.equal(body.allowedOrigins, '*');
    assert.equal(typeof body.roomTtlMs, 'number');
    assert.equal(typeof body.hostHeartbeatTimeoutMs, 'number');
    assert.equal(body.maxListenersPerRoom, 2);
  });

  it('aggregates active solo listeners by track and removes stale declarations', async () => {
    const trackHash = `0x${'ab'.repeat(32)}`;
    const observer = connectClient();
    const first = connectClient();
    const second = connectClient();
    await Promise.all([once(observer, 'connect'), once(first, 'connect'), once(second, 'connect')]);

    const firstUpdate = once(observer, 'presence:solo:updated');
    first.emit('presence:solo', { trackHash });
    assert.deepEqual(await firstUpdate, { [trackHash]: 1 });

    const secondUpdate = once(observer, 'presence:solo:updated');
    second.emit('presence:solo', { trackHash: trackHash.toUpperCase().replace('0X', '0x') });
    assert.deepEqual(await secondUpdate, { [trackHash]: 2 });

    const disconnectedUpdate = once(observer, 'presence:solo:updated');
    second.disconnect();
    assert.deepEqual(await disconnectedUpdate, { [trackHash]: 1 });

    const status = await (await fetch(`http://127.0.0.1:${port}/status`)).json();
    assert.deepEqual(status.soloListeningByTrackHash, { [trackHash]: 1 });

    // Becoming a room host clears the same socket's solo declaration. One
    // socket cannot inflate both sides of the combined listening total.
    const roomTransition = once(observer, 'presence:solo:updated');
    const created = await emitAck(first, 'room:create', { displayName: 'Host', track: { title: 'Night Drive', artist: 'Ada', hash: trackHash } });
    assert.equal(created.ok, true);
    assert.deepEqual(await roomTransition, {});
    assert.equal(server.soloPresenceBySocket.size, 0);
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

  it('lets a listener rename themselves and notifies the host', async () => {
    const host = connectClient();
    const created = await createRoom(host);

    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Guest' });

    const other = connectClient();
    await once(other, 'connect');
    await emitAck(other, 'room:join', { roomId: created.roomId, displayName: 'Other' });

    const renamed = once(host, 'listener:renamed');
    const peerRenamed = once(other, 'listener:renamed');
    const response = await emitAck(listener, 'room:rename', { displayName: '  Nina  ' });
    const payload = await renamed;
    const peerPayload = await peerRenamed;

    assert.equal(response.ok, true);
    assert.equal(response.displayName, 'Nina');
    assert.equal(payload.displayName, 'Nina');
    assert.equal(peerPayload.displayName, 'Nina');
    assert.equal(server.rooms.get(created.roomId).listeners.get(listener.id).displayName, 'Nina');
  });

  it('broadcasts the listener roster to every participant', async () => {
    const host = connectClient();
    const created = await createRoom(host);

    const first = connectClient();
    await once(first, 'connect');
    const firstJoined = await emitAck(first, 'room:join', { roomId: created.roomId, displayName: 'Nia' });
    assert.deepEqual(
      firstJoined.listeners.map(listener => listener.displayName),
      ['Nia']
    );

    const second = connectClient();
    await once(second, 'connect');
    const firstRoster = once(first, 'room:listeners');
    const hostRoster = once(host, 'room:listeners');
    const secondJoined = await emitAck(second, 'room:join', { roomId: created.roomId, displayName: 'Kev' });
    const [firstPayload, hostPayload] = await Promise.all([firstRoster, hostRoster]);

    assert.deepEqual(
      secondJoined.listeners.map(listener => listener.displayName),
      ['Nia', 'Kev']
    );
    assert.deepEqual(
      firstPayload.listeners.map(listener => listener.displayName),
      ['Nia', 'Kev']
    );
    assert.deepEqual(
      hostPayload.listeners.map(listener => listener.displayName),
      ['Nia', 'Kev']
    );
  });

  it('rejects default listener rename values', async () => {
    const host = connectClient();
    const created = await createRoom(host);

    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Guest' });

    const response = await emitAck(listener, 'room:rename', { displayName: 'Listener' });
    assert.equal(response.ok, false);
    assert.equal(server.rooms.get(created.roomId).listeners.get(listener.id).displayName, 'Guest');
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

describe('peer signaling authorization', () => {
  it('relays protocol-valid WebRTC messages only between a room host and listener', async () => {
    const host = connectClient();
    const created = await createRoom(host);
    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Guest' });

    const listenerOffers = collect(listener, 'webrtc:offer');
    const hostAnswers = collect(host, 'webrtc:answer');
    const listenerCandidates = collect(listener, 'webrtc:ice-candidate');
    const hostCandidates = collect(host, 'webrtc:ice-candidate');
    const hostConnections = collect(host, 'peer:connected');

    host.emit('webrtc:offer', { targetId: listener.id, offer: { type: 'offer', sdp: 'host-offer' } });
    listener.emit('webrtc:answer', { targetId: host.id, answer: { type: 'answer', sdp: 'listener-answer' } });
    host.emit('webrtc:ice-candidate', { targetId: listener.id, candidate: { candidate: 'host-candidate' } });
    listener.emit('webrtc:ice-candidate', { targetId: host.id, candidate: { candidate: 'listener-candidate' } });
    listener.emit('peer:connected', { targetId: host.id });

    const [offers, answers, listenerIce, hostIce, connections] = await Promise.all([
      listenerOffers,
      hostAnswers,
      listenerCandidates,
      hostCandidates,
      hostConnections
    ]);

    assert.deepEqual(offers, [{ from: host.id, offer: { type: 'offer', sdp: 'host-offer' } }]);
    assert.deepEqual(answers, [{ from: listener.id, answer: { type: 'answer', sdp: 'listener-answer' } }]);
    assert.deepEqual(listenerIce, [{ from: host.id, candidate: { candidate: 'host-candidate' } }]);
    assert.deepEqual(hostIce, [{ from: listener.id, candidate: { candidate: 'listener-candidate' } }]);
    assert.deepEqual(connections, [{ from: listener.id }]);
  });

  it('drops peer messages whose source or target is not a room participant', async () => {
    const host = connectClient();
    const created = await createRoom(host);
    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Guest' });
    const outsider = connectClient();
    await once(outsider, 'connect');

    const hostOffers = collect(host, 'webrtc:offer');
    const hostAnswers = collect(host, 'webrtc:answer');
    const hostCandidates = collect(host, 'webrtc:ice-candidate');
    const hostConnections = collect(host, 'peer:connected');
    const listenerOffers = collect(listener, 'webrtc:offer');
    const outsiderOffers = collect(outsider, 'webrtc:offer');
    const outsiderAnswers = collect(outsider, 'webrtc:answer');
    const outsiderCandidates = collect(outsider, 'webrtc:ice-candidate');
    const outsiderConnections = collect(outsider, 'peer:connected');

    outsider.emit('webrtc:offer', { targetId: listener.id, offer: { sdp: 'forged' } });
    outsider.emit('webrtc:answer', { targetId: host.id, answer: { sdp: 'forged' } });
    outsider.emit('webrtc:ice-candidate', { targetId: host.id, candidate: { candidate: 'forged' } });
    outsider.emit('peer:connected', { targetId: host.id });
    host.emit('webrtc:offer', { targetId: outsider.id, offer: { sdp: 'not-a-listener' } });
    listener.emit('webrtc:answer', { targetId: outsider.id, answer: { sdp: 'not-a-host' } });
    listener.emit('webrtc:ice-candidate', { targetId: outsider.id, candidate: { candidate: 'not-a-host' } });
    listener.emit('peer:connected', { targetId: outsider.id });

    const received = await Promise.all([
      hostOffers,
      hostAnswers,
      hostCandidates,
      hostConnections,
      listenerOffers,
      outsiderOffers,
      outsiderAnswers,
      outsiderCandidates,
      outsiderConnections
    ]);
    assert.equal(
      received.every(messages => messages.length === 0),
      true
    );
  });

  it('drops every peer message between listeners in the same room', async () => {
    const host = connectClient();
    const created = await createRoom(host);
    const first = connectClient();
    await once(first, 'connect');
    await emitAck(first, 'room:join', { roomId: created.roomId, displayName: 'First' });
    const second = connectClient();
    await once(second, 'connect');
    await emitAck(second, 'room:join', { roomId: created.roomId, displayName: 'Second' });

    const offers = collect(second, 'webrtc:offer');
    const answers = collect(second, 'webrtc:answer');
    const candidates = collect(second, 'webrtc:ice-candidate');
    const connections = collect(second, 'peer:connected');

    first.emit('webrtc:offer', { targetId: second.id, offer: { sdp: 'listener-offer' } });
    first.emit('webrtc:answer', { targetId: second.id, answer: { sdp: 'listener-answer' } });
    first.emit('webrtc:ice-candidate', { targetId: second.id, candidate: { candidate: 'listener-candidate' } });
    first.emit('peer:connected', { targetId: second.id });

    const received = await Promise.all([offers, answers, candidates, connections]);
    assert.equal(
      received.every(messages => messages.length === 0),
      true
    );
  });

  it('drops every peer message sent across rooms', async () => {
    const firstHost = connectClient();
    const firstRoom = await createRoom(firstHost);
    const firstListener = connectClient();
    await once(firstListener, 'connect');
    await emitAck(firstListener, 'room:join', { roomId: firstRoom.roomId, displayName: 'First listener' });

    const secondHost = connectClient();
    const secondRoom = await createRoom(secondHost);
    const secondListener = connectClient();
    await once(secondListener, 'connect');
    await emitAck(secondListener, 'room:join', { roomId: secondRoom.roomId, displayName: 'Second listener' });

    const offers = collect(secondListener, 'webrtc:offer');
    const answers = collect(secondHost, 'webrtc:answer');
    const hostCandidates = collect(secondHost, 'webrtc:ice-candidate');
    const listenerCandidates = collect(secondListener, 'webrtc:ice-candidate');
    const connections = collect(secondHost, 'peer:connected');

    firstHost.emit('webrtc:offer', { targetId: secondListener.id, offer: { sdp: 'cross-room-offer' } });
    firstListener.emit('webrtc:answer', { targetId: secondHost.id, answer: { sdp: 'cross-room-answer' } });
    firstListener.emit('webrtc:ice-candidate', { targetId: secondHost.id, candidate: { candidate: 'cross-room-listener' } });
    firstHost.emit('webrtc:ice-candidate', { targetId: secondListener.id, candidate: { candidate: 'cross-room-host' } });
    firstListener.emit('peer:connected', { targetId: secondHost.id });

    const received = await Promise.all([offers, answers, hostCandidates, listenerCandidates, connections]);
    assert.equal(
      received.every(messages => messages.length === 0),
      true
    );
  });

  it('drops offer, answer, and connected notifications sent in the wrong direction', async () => {
    const host = connectClient();
    const created = await createRoom(host);
    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Guest' });

    const hostOffers = collect(host, 'webrtc:offer');
    const listenerAnswers = collect(listener, 'webrtc:answer');
    const listenerConnections = collect(listener, 'peer:connected');

    listener.emit('webrtc:offer', { targetId: host.id, offer: { sdp: 'wrong-direction' } });
    host.emit('webrtc:answer', { targetId: listener.id, answer: { sdp: 'wrong-direction' } });
    host.emit('peer:connected', { targetId: listener.id });

    const received = await Promise.all([hostOffers, listenerAnswers, listenerConnections]);
    assert.equal(
      received.every(messages => messages.length === 0),
      true
    );
  });
});

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

  it('broadcasts the request queue to the room with attribution and replays it to late joiners', async () => {
    const host = connectClient();
    const created = await createRoom(host, { displayName: 'Ada' });

    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Gabe' });

    const hostSees = new Promise(resolve => host.once('room:requests', resolve));
    listener.emit('room:request', { text: '  play  some  Fela  ' });
    const queue = await hostSees;

    assert.equal(queue.length, 1);
    assert.equal(queue[0].text, 'play some Fela', 'text is sanitized to a single line');
    assert.equal(queue[0].senderName, 'Gabe');
    assert.equal(typeof queue[0].id, 'string');
    assert.equal(typeof queue[0].ts, 'number');

    const late = connectClient();
    await once(late, 'connect');
    const joined = await emitAck(late, 'room:join', { roomId: created.roomId, displayName: 'Late' });
    assert.equal(joined.ok, true);
    assert.equal(joined.requests.length, 1);
    assert.equal(joined.requests[0].text, 'play some Fela');
  });

  it('lets only the host veto or clear requests; listener veto/clear are ignored', async () => {
    const host = connectClient();
    const created = await createRoom(host);
    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Gabe' });

    const filled = new Promise(resolve => {
      host.on('room:requests', queue => {
        if (queue.length === 2) resolve(queue);
      });
    });
    listener.emit('room:request', { text: 'first' });
    listener.emit('room:request', { text: 'second' });
    const queue = await filled;
    const target = queue.find(request => request.text === 'first');

    // A listener cannot veto or clear: neither emits a broadcast.
    const listenerMutations = collect(host, 'room:requests');
    listener.emit('room:request:remove', { id: target.id });
    listener.emit('room:request:clear');
    assert.equal((await listenerMutations).length, 0, 'listener veto/clear are ignored');

    // The host veto removes exactly the targeted request.
    const afterRemove = await new Promise(resolve => {
      host.once('room:requests', resolve);
      host.emit('room:request:remove', { id: target.id });
    });
    assert.deepEqual(
      afterRemove.map(request => request.text),
      ['second']
    );

    // The host clear empties the queue.
    const afterClear = await new Promise(resolve => {
      host.once('room:requests', resolve);
      host.emit('room:request:clear');
    });
    assert.equal(afterClear.length, 0);
  });

  it('ignores requests from sockets that are not room participants', async () => {
    const host = connectClient();
    const created = await createRoom(host);

    const outsider = connectClient();
    await once(outsider, 'connect');

    const hostSees = collect(host, 'room:requests');
    outsider.emit('room:request', { text: 'let me pick' });

    assert.equal((await hostSees).length, 0);
    assert.equal(server.rooms.get(created.roomId).requests.length, 0);
  });

  it('rate limits requests per socket, dropping silently past the window limit', async () => {
    await server.close();
    server = startSignalingServer({ port: 0, host: '127.0.0.1', requestRateLimit: { limit: 2, windowMs: 5_000 }, logger: () => {} });
    port = await server.listen();

    const host = connectClient();
    const created = await createRoom(host);
    const listener = connectClient();
    await once(listener, 'connect');
    await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Guest' });

    const hostSees = collect(host, 'room:requests');
    for (let i = 1; i <= 4; i += 1) {
      listener.emit('room:request', { text: `burst ${i}` });
    }
    const broadcasts = await hostSees;

    // Every add rebroadcasts the full list; only 2 adds survive the window.
    const final = broadcasts.at(-1) ?? [];
    assert.equal(final.length, 2);
    assert.deepEqual(
      final.map(request => request.text),
      ['burst 1', 'burst 2']
    );
  });

  it('caps the request queue at the configured limit, dropping further adds silently', async () => {
    await server.close();
    server = startSignalingServer({ port: 0, host: '127.0.0.1', requestQueueLimit: 3, requestRateLimit: { limit: 100, windowMs: 5_000 }, logger: () => {} });
    port = await server.listen();

    const host = connectClient();
    const created = await createRoom(host);

    const broadcasts = collect(host, 'room:requests');
    for (let i = 1; i <= 5; i += 1) {
      host.emit('room:request', { text: `item ${i}` });
    }
    const seen = await broadcasts;

    // Only the first 3 adds broadcast; adds 4 and 5 hit the cap and are dropped
    // silently (no broadcast, no error), so the queue holds exactly 3.
    assert.equal(seen.length, 3);
    assert.deepEqual(
      seen.at(-1).map(request => request.text),
      ['item 1', 'item 2', 'item 3']
    );
    assert.equal(server.rooms.get(created.roomId).requests.length, 3);
  });

  it('keeps the request queue out of the public status endpoint', async () => {
    const host = connectClient();
    const created = await createRoom(host);
    host.emit('room:request', { text: 'a private wish' });
    await collect(host, 'room:requests');

    const res = await fetch(`http://127.0.0.1:${port}/status`);
    const body = await res.json();
    const room = body.rooms.find(r => r.roomId === created.roomId);
    assert.ok(room);
    assert.equal(room.requests, undefined);
    assert.equal(JSON.stringify(body).includes('a private wish'), false);
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

describe('sanitizeTrack', () => {
  it('preserves every supported access mode and strips source-bearing references', () => {
    for (const accessMode of ['free', 'classic', 'human-free']) {
      const track = sanitizeTrack({
        accessMode,
        audioRef: 'dotify:enc:ipfs://private-source',
        metadataRef: 'ipfs://private-manifest',
        bulletinRef: 'bulletin://private-rights'
      });
      assert.equal(track.accessMode, accessMode);
      assert.equal(track.audioRef, undefined);
      assert.equal(Object.hasOwn(track, 'audioRef'), false);
      assert.equal(track.metadataRef, undefined);
      assert.equal(Object.hasOwn(track, 'metadataRef'), false);
      assert.equal(track.bulletinRef, '');
    }
  });

  it('fails closed to human-free for unknown access modes', () => {
    assert.equal(sanitizeTrack({ accessMode: 'surprise' }).accessMode, 'human-free');
  });
});

describe('sanitizeTrackHash', () => {
  it('accepts a bytes32 catalog identity and normalizes its case', () => {
    const mixed = `0x${'Ab'.repeat(32)}`;
    assert.equal(sanitizeTrackHash(mixed), mixed.toLowerCase());
  });

  it('rejects arbitrary aggregate keys', () => {
    assert.equal(sanitizeTrackHash('Pyramides'), null);
    assert.equal(sanitizeTrackHash('0xabc'), null);
  });
});
