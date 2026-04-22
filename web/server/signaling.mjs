/* global console, process */

import { createServer } from 'node:http';
import { Server } from 'socket.io';

const port = Number(process.env.SIGNAL_PORT ?? 8788);
const origin = process.env.SIGNAL_ORIGIN ?? '*';
const rooms = new Map();

const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, app: 'dotify' }));
    return;
  }

  response.writeHead(200, { 'content-type': 'text/plain' });
  response.end('Dotify signaling server\n');
});

const io = new Server(httpServer, {
  cors: { origin, methods: ['GET', 'POST'] }
});

io.on('connection', socket => {
  socket.emit('rooms:updated', publicRooms());

  socket.on('room:create', (payload = {}, reply) => {
    leaveRoom(socket);

    const roomId = createRoomId();
    const room = {
      hostId: socket.id,
      hostName: sanitizeText(payload.displayName, 'Host', 32),
      listeners: new Map(),
      track: sanitizeTrack(payload.track),
      playerState: null,
      createdAt: Date.now()
    };

    rooms.set(roomId, room);
    socket.data.roomId = roomId;
    socket.data.role = 'host';
    socket.join(roomId);

    reply?.({ ok: true, roomId, hostName: room.hostName });
    emitRooms();
  });

  socket.on('room:join', (payload = {}, reply) => {
    leaveRoom(socket);

    const roomId = normalizeRoomId(payload.roomId);
    const room = rooms.get(roomId);
    if (!room) {
      reply?.({ ok: false, error: 'Room not found' });
      return;
    }

    const listener = {
      id: socket.id,
      displayName: sanitizeText(payload.displayName, 'Listener', 32)
    };
    room.listeners.set(socket.id, listener);

    socket.data.roomId = roomId;
    socket.data.role = 'listener';
    socket.join(roomId);

    const listenerCount = room.listeners.size;
    reply?.({
      ok: true,
      roomId,
      hostId: room.hostId,
      hostName: room.hostName,
      listenerCount,
      track: room.track,
      playerState: room.playerState
    });

    io.to(room.hostId).emit('listener:joined', {
      listenerId: socket.id,
      displayName: listener.displayName,
      listenerCount
    });
    io.to(roomId).emit('room:listener-count', { listenerCount });
    emitRooms();
  });

  socket.on('room:track', track => {
    const room = getHostedRoom(socket);
    if (!room) return;

    room.track = sanitizeTrack(track);
    socket.to(socket.data.roomId).emit('room:track', room.track);
    emitRooms();
  });

  socket.on('player:state', state => {
    const room = getHostedRoom(socket);
    if (!room) return;

    room.playerState = sanitizePlayerState(state);
    socket.to(socket.data.roomId).emit('player:state', room.playerState);
    emitRooms();
  });

  socket.on('webrtc:offer', (payload = {}) => {
    routePeerMessage(payload.targetId, 'webrtc:offer', {
      from: socket.id,
      offer: payload.offer
    });
  });

  socket.on('webrtc:answer', (payload = {}) => {
    routePeerMessage(payload.targetId, 'webrtc:answer', {
      from: socket.id,
      answer: payload.answer
    });
  });

  socket.on('webrtc:ice-candidate', (payload = {}) => {
    routePeerMessage(payload.targetId, 'webrtc:ice-candidate', {
      from: socket.id,
      candidate: payload.candidate
    });
  });

  socket.on('peer:connected', (payload = {}) => {
    routePeerMessage(payload.targetId, 'peer:connected', { from: socket.id });
  });

  socket.on('rooms:list', reply => {
    reply?.(publicRooms());
  });

  socket.on('room:leave', () => leaveRoom(socket));
  socket.on('disconnect', () => leaveRoom(socket));
});

httpServer.listen(port, '127.0.0.1', () => {
  console.log(`Dotify signaling server listening on http://localhost:${port}`);
});

function createRoomId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let roomId = '';

  do {
    roomId = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (rooms.has(roomId));

  return roomId;
}

function normalizeRoomId(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

function sanitizeText(value, fallback, maxLength) {
  const text = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
  return text || fallback;
}

function sanitizeTrack(track) {
  if (!track || typeof track !== 'object') {
    return null;
  }

  return {
    title: sanitizeText(track.title, 'Untitled', 120),
    artist: sanitizeText(track.artist, 'Unknown artist', 80),
    hash: sanitizeText(track.hash, '', 80),
    bulletinRef: sanitizeText(track.bulletinRef, '', 120),
    audioRef: sanitizeText(track.audioRef, '', 1000),
    metadataRef: sanitizeText(track.metadataRef, '', 1000),
    artistContractRef: sanitizeText(track.artistContractRef, '', 1000),
    imageRef: sanitizeText(track.imageRef, '', 6000),
    description: sanitizeText(track.description, '', 500),
    accessMode: track.accessMode === 'classic' ? 'classic' : 'human-free',
    priceDot: sanitizeText(track.priceDot, '0', 32),
    personhoodLevel: track.personhoodLevel === 'DIM2' ? 'DIM2' : 'DIM1',
    duration: Number.isFinite(track.duration) ? Number(track.duration) : 0,
    updatedAt: Number.isFinite(track.updatedAt) ? Number(track.updatedAt) : Date.now()
  };
}

function sanitizePlayerState(state) {
  if (!state || typeof state !== 'object') {
    return null;
  }

  return {
    playing: Boolean(state.playing),
    currentTime: Number.isFinite(state.currentTime) ? Number(state.currentTime) : 0,
    duration: Number.isFinite(state.duration) ? Number(state.duration) : 0,
    updatedAt: Number.isFinite(state.updatedAt) ? Number(state.updatedAt) : Date.now()
  };
}

function getHostedRoom(socket) {
  const room = rooms.get(socket.data.roomId);
  return room?.hostId === socket.id ? room : null;
}

function publicRooms() {
  return Array.from(rooms.entries()).map(([roomId, room]) => ({
    roomId,
    hostName: room.hostName,
    listenerCount: room.listeners.size,
    track: room.track,
    playerState: room.playerState,
    createdAt: room.createdAt
  }));
}

function emitRooms() {
  io.emit('rooms:updated', publicRooms());
}

function routePeerMessage(targetId, eventName, message) {
  if (typeof targetId === 'string' && targetId) {
    io.to(targetId).emit(eventName, message);
  }
}

function leaveRoom(socket) {
  const roomId = socket.data.roomId;
  const role = socket.data.role;
  if (!roomId || !role) return;

  const room = rooms.get(roomId);
  if (!room) {
    clearSocketRoom(socket);
    return;
  }

  if (role === 'host' && room.hostId === socket.id) {
    socket.to(roomId).emit('room:closed', { reason: 'Host disconnected' });
    rooms.delete(roomId);
    clearSocketRoom(socket);
    socket.leave(roomId);
    emitRooms();
    return;
  }

  if (role === 'listener') {
    room.listeners.delete(socket.id);
    const listenerCount = room.listeners.size;
    io.to(room.hostId).emit('listener:left', { listenerId: socket.id, listenerCount });
    io.to(roomId).emit('room:listener-count', { listenerCount });
    emitRooms();
  }

  clearSocketRoom(socket);
  socket.leave(roomId);
}

function clearSocketRoom(socket) {
  socket.data.roomId = undefined;
  socket.data.role = undefined;
}
