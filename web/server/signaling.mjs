// Dotify signaling server (Sprint 0, Ticket 04).
//
// Coordinates room discovery and WebRTC SDP/ICE exchange. It NEVER carries
// audio: media flows host -> listeners over WebRTC only.
//
// Room access doctrine (docs/backlog/README.md):
//   - Rooms are host-based. Only the host satisfies the track access policy.
//   - Listeners join with a link or code: no wallet, no signature, no payment.
//   - Listeners never receive content keys or encrypted source files, only
//     the ephemeral WebRTC stream (which they can of course hear and record;
//     we do not claim otherwise).
//
// Hardening in this revision: configurable allowed origins, room expiration,
// host heartbeat, per-room listener cap, structured lifecycle logs, and a
// status endpoint exposing public room metadata.

import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Server } from 'socket.io';
import { createRoomId, normalizeRoomId, sanitizeAddress, sanitizePlayerState, sanitizeText, sanitizeTrack } from './signaling-utils.mjs';

export const defaultConfig = {
  port: 8788,
  host: '0.0.0.0',
  // '*' (demo) or an array of exact origins.
  origins: '*',
  // Hard lifetime of a room. Long sessions are legitimate; zombies are not.
  roomTtlMs: 6 * 60 * 60 * 1000,
  // Host must show signs of life (heartbeat or any host event) within this
  // window, otherwise the room is closed even if the socket looks open.
  hostHeartbeatTimeoutMs: 120_000,
  sweepIntervalMs: 30_000,
  maxListenersPerRoom: 24,
  logger: line => console.log(line)
};

export function readConfigFromEnv(env = process.env) {
  const origins = (env.SIGNAL_ORIGINS ?? env.SIGNAL_ORIGIN ?? '*').trim();
  return {
    ...defaultConfig,
    port: Number(env.SIGNAL_PORT ?? defaultConfig.port),
    host: env.SIGNAL_HOST ?? defaultConfig.host,
    origins:
      origins === '*'
        ? '*'
        : origins
            .split(',')
            .map(o => o.trim().replace(/\/$/, ''))
            .filter(Boolean),
    roomTtlMs: Number(env.SIGNAL_ROOM_TTL_MS ?? defaultConfig.roomTtlMs),
    hostHeartbeatTimeoutMs: Number(env.SIGNAL_HOST_TIMEOUT_MS ?? defaultConfig.hostHeartbeatTimeoutMs),
    maxListenersPerRoom: Number(env.SIGNAL_MAX_LISTENERS ?? defaultConfig.maxListenersPerRoom)
  };
}

export function startSignalingServer(overrides = {}) {
  const config = { ...defaultConfig, ...overrides };
  const rooms = new Map();
  const startedAt = Date.now();

  function logEvent(event, fields = {}) {
    config.logger(JSON.stringify({ at: new Date().toISOString(), app: 'dotify-signal', event, ...fields }));
  }

  function isOriginAllowed(origin) {
    if (config.origins === '*') return true;
    if (!origin) return false;
    return config.origins.includes(origin.replace(/\/$/, ''));
  }

  function corsHeaders(request) {
    const origin = request?.headers?.origin;
    const headers = {
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'content-type'
    };

    if (config.origins === '*') {
      headers['access-control-allow-origin'] = '*';
    } else if (isOriginAllowed(origin)) {
      headers['access-control-allow-origin'] = origin;
    }

    return headers;
  }

  function sendJson(request, response, status, payload) {
    response.writeHead(status, { ...corsHeaders(request), 'content-type': 'application/json' });
    response.end(JSON.stringify(payload));
  }

  const httpServer = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    if (requestUrl.pathname === '/health') {
      const listenerTotal = Array.from(rooms.values()).reduce((total, room) => total + room.listeners.size, 0);
      sendJson(request, response, 200, {
        ok: true,
        app: 'dotify',
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        rooms: rooms.size,
        listeners: listenerTotal
      });
      return;
    }

    if (requestUrl.pathname === '/status') {
      sendJson(request, response, 200, { rooms: publicRooms() });
      return;
    }

    response.writeHead(200, { ...corsHeaders(request), 'content-type': 'text/plain' });
    response.end('Dotify signaling server\n');
  });

  const io = new Server(httpServer, {
    cors: { origin: config.origins === '*' ? '*' : config.origins, methods: ['GET', 'POST'] }
  });

  function publicRoom(roomId, room) {
    return {
      roomId,
      title: room.track?.title ?? 'Listening room',
      hostName: room.hostName,
      hostAddress: room.hostAddress,
      track: room.track,
      playerState: room.playerState,
      playbackMode: room.playbackMode,
      // Every registered track sits behind an artist access policy that the
      // HOST must satisfy. Listeners never need wallet access for rooms.
      hostAccessRequired: Boolean(room.track),
      listenersNeedWalletAccess: false,
      createdAt: room.createdAt,
      expiresAt: room.createdAt + config.roomTtlMs,
      listenerCount: room.listeners.size
    };
  }

  function publicRooms() {
    return Array.from(rooms.entries()).map(([roomId, room]) => publicRoom(roomId, room));
  }

  function emitRooms() {
    io.emit('rooms:updated', publicRooms());
  }

  function closeRoom(roomId, room, reason, event) {
    io.to(roomId).emit('room:closed', { reason });
    rooms.delete(roomId);
    io.in(roomId).socketsLeave(roomId);
    logEvent(event, { roomId, listenerCount: room.listeners.size, reason });
    emitRooms();
  }

  function touchHost(room) {
    room.lastHostSeenAt = Date.now();
  }

  io.on('connection', socket => {
    socket.emit('rooms:updated', publicRooms());

    socket.on('room:create', (payload = {}, reply) => {
      leaveRoom(socket);

      const roomId = createRoomId(rooms);
      const room = {
        hostId: socket.id,
        hostName: sanitizeText(payload.displayName, 'Host', 32),
        hostAddress: sanitizeAddress(payload.hostAddress),
        listeners: new Map(),
        track: sanitizeTrack(payload.track),
        playerState: null,
        playbackMode: payload.playbackMode === 'preview' ? 'preview' : 'full',
        createdAt: Date.now(),
        lastHostSeenAt: Date.now()
      };

      rooms.set(roomId, room);
      socket.data.roomId = roomId;
      socket.data.role = 'host';
      socket.join(roomId);

      logEvent('room:created', { roomId, hostName: room.hostName, hostAddress: room.hostAddress, track: room.track?.title ?? null });
      reply?.({ ok: true, roomId, hostName: room.hostName, expiresAt: room.createdAt + config.roomTtlMs });
      emitRooms();
    });

    socket.on('room:join', (payload = {}, reply) => {
      leaveRoom(socket);

      const roomId = normalizeRoomId(payload.roomId);
      const room = rooms.get(roomId);
      if (!room) {
        reply?.({ ok: false, error: 'Room not found. It may have ended or expired.', code: 'ROOM_NOT_FOUND' });
        return;
      }
      if (room.listeners.size >= config.maxListenersPerRoom) {
        reply?.({ ok: false, error: 'Room is full.', code: 'ROOM_FULL' });
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
      logEvent('room:joined', { roomId, listenerId: socket.id, listenerCount });
      reply?.({
        ok: true,
        roomId,
        hostId: room.hostId,
        hostName: room.hostName,
        listenerCount,
        track: room.track,
        playerState: room.playerState,
        playbackMode: room.playbackMode,
        expiresAt: room.createdAt + config.roomTtlMs
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

      touchHost(room);
      room.track = sanitizeTrack(track);
      socket.to(socket.data.roomId).emit('room:track', room.track);
      emitRooms();
    });

    // Host-declared playback mode: 'full' when the host satisfies the track
    // access policy, 'preview' when streaming the 42% fallback.
    socket.on('room:playback-mode', (payload = {}) => {
      const room = getHostedRoom(socket);
      if (!room) return;

      touchHost(room);
      const playbackMode = payload.playbackMode === 'preview' ? 'preview' : 'full';
      if (room.playbackMode !== playbackMode) {
        room.playbackMode = playbackMode;
        logEvent('room:playback-mode', { roomId: socket.data.roomId, playbackMode });
      }
      socket.to(socket.data.roomId).emit('room:playback-mode', { playbackMode });
      emitRooms();
    });

    socket.on('player:state', state => {
      const room = getHostedRoom(socket);
      if (!room) return;

      touchHost(room);
      room.playerState = sanitizePlayerState(state);
      socket.to(socket.data.roomId).emit('player:state', room.playerState);
      emitRooms();
    });

    socket.on('host:heartbeat', () => {
      const room = getHostedRoom(socket);
      if (room) touchHost(room);
    });

    socket.on('webrtc:offer', (payload = {}) => {
      routePeerMessage(payload.targetId, 'webrtc:offer', { from: socket.id, offer: payload.offer });
    });

    socket.on('webrtc:answer', (payload = {}) => {
      routePeerMessage(payload.targetId, 'webrtc:answer', { from: socket.id, answer: payload.answer });
    });

    socket.on('webrtc:ice-candidate', (payload = {}) => {
      routePeerMessage(payload.targetId, 'webrtc:ice-candidate', { from: socket.id, candidate: payload.candidate });
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

  // Sweep: enforce room TTL and host liveness so zombie rooms cannot pile up.
  const sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms) {
      if (now - room.createdAt > config.roomTtlMs) {
        closeRoom(roomId, room, 'Room expired', 'room:expired');
        continue;
      }
      if (now - room.lastHostSeenAt > config.hostHeartbeatTimeoutMs) {
        closeRoom(roomId, room, 'Host connection lost', 'room:host-timeout');
      }
    }
  }, config.sweepIntervalMs);
  sweepTimer.unref?.();

  function routePeerMessage(targetId, eventName, message) {
    if (typeof targetId === 'string' && targetId) {
      io.to(targetId).emit(eventName, message);
    }
  }

  function getHostedRoom(socket) {
    const room = rooms.get(socket.data.roomId);
    return room?.hostId === socket.id ? room : null;
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
      socket.leave(roomId);
      clearSocketRoom(socket);
      closeRoom(roomId, room, 'Host left the room', 'room:closed');
      return;
    }

    if (role === 'listener') {
      room.listeners.delete(socket.id);
      const listenerCount = room.listeners.size;
      logEvent('room:left', { roomId, listenerId: socket.id, listenerCount });
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

  return {
    httpServer,
    io,
    rooms,
    config,
    listen() {
      return new Promise(resolve => {
        httpServer.listen(config.port, config.host, () => {
          logEvent('server:listening', { host: config.host, port: httpServer.address().port, origins: config.origins });
          resolve(httpServer.address().port);
        });
      });
    },
    async close() {
      clearInterval(sweepTimer);
      await io.close();
    }
  };
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const server = startSignalingServer(readConfigFromEnv());
  void server.listen();
}
