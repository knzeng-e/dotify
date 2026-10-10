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

import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Server } from 'socket.io';
import { createRoomRealtimeMembers } from './room-realtime-members.mjs';
import { createRoomContributions } from './room-contributions.mjs';
import { createRoomLife } from './room-life.mjs';
import {
  REQUEST_TEXT_MAX_LENGTH,
  clientKey,
  createRoomId,
  createWindowLimiter,
  normalizeRoomId,
  sanitizeChatText,
  sanitizePlayerState,
  snapshotPlayerState,
  sanitizeReactionEmoji,
  sanitizeLineupItem,
  sanitizeText,
  sanitizeTrack,
  sanitizeTrackHash
} from './signaling-utils.mjs';

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
  // Social layer: in-memory chat history per room (dies with the room; never
  // exposed on /status) and fail-silent per-socket rate limits.
  chatHistoryLimit: 50,
  chatRateLimit: { limit: 5, windowMs: 5_000 },
  reactionRateLimit: { limit: 10, windowMs: 5_000 },
  // Collaborative request queue: every participant can propose a track to
  // hear next; the host vetoes or clears. Lives in the room Map like chat
  // (dies with the room, never on /status). The queue is intent, not
  // playback -- the server never claims it auto-plays.
  requestQueueLimit: 20,
  requestRateLimit: { limit: 5, windowMs: 10_000 },
  // Host-curated playback order. Metadata only; source and manifest refs are
  // stripped by sanitizeLineupItem before the list reaches any listener.
  lineupLimit: 12,
  // Join/reconnect throttle keyed by network address. Chat and reaction
  // limits stay per-socket so co-located listeners each keep their own budget
  // (Dotify's core scenario is people physically together on one network).
  // This throttle caps the reconnect-churn that would otherwise let a client
  // reset its per-socket budget by disconnecting and rejoining with a fresh
  // socket id. Generous by design: honest crowds arriving together stay well
  // under it. Best-effort dampening, not a hard identity guarantee.
  joinRateLimit: { limit: 15, windowMs: 10_000 },
  // Only trust x-forwarded-for for the client key when a reverse proxy is
  // guaranteed to set it. Off by default (raw socket address) so a bare demo
  // deployment cannot be spoofed via a forged header.
  trustProxy: false,
  // Native hosts/webviews may omit Origin entirely on Socket.IO handshakes.
  // This does not allow the literal "null" origin from sandboxed/file pages.
  allowMissingOrigin: false,
  // Shared only with the backend API. It signs a short-lived proof that the
  // requesting socket currently belongs to a room; it never reaches clients.
  turnCapabilitySecret: '',
  turnCapabilityTtlMs: 2 * 60 * 1000,
  logger: line => console.log(line)
};

export function readConfigFromEnv(env = process.env) {
  const origins = (env.SIGNAL_ORIGINS ?? env.SIGNAL_ORIGIN ?? '*').trim();
  return {
    ...defaultConfig,
    contributions: {
      key: env.SIGNAL_CONTRIBUTION_ATTESTOR_KEY,
      rpc: env.SIGNAL_CONTRIBUTION_RPC_URL,
      directory: env.SIGNAL_CONTRIBUTION_DIRECTORY,
      chainId: Number(env.SIGNAL_CONTRIBUTION_CHAIN_ID),
      api: env.SIGNAL_CONTRIBUTION_API_URL
    },
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
    maxListenersPerRoom: Number(env.SIGNAL_MAX_LISTENERS ?? defaultConfig.maxListenersPerRoom),
    trustProxy: /^(1|true|yes)$/i.test(String(env.SIGNAL_TRUST_PROXY ?? '').trim()),
    allowMissingOrigin: /^(1|true|yes)$/i.test(String(env.SIGNAL_ALLOW_MISSING_ORIGIN ?? '').trim()),
    turnCapabilitySecret: String(env.SIGNAL_TURN_CAPABILITY_SECRET ?? '').trim(),
    turnCapabilityTtlMs: Math.min(5 * 60 * 1000, Math.max(30 * 1000, Number(env.SIGNAL_TURN_CAPABILITY_TTL_MS ?? defaultConfig.turnCapabilityTtlMs)))
  };
}

export function isSignalingOriginAllowed(origin, config) {
  if (config.origins === '*') return true;
  if (!origin) return Boolean(config.allowMissingOrigin);
  return config.origins.includes(origin.replace(/\/$/, ''));
}

export function startSignalingServer(overrides = {}, dependencies = {}) {
  const config = { ...defaultConfig, ...overrides };
  if (config.turnCapabilitySecret && config.turnCapabilitySecret.length < 32) {
    throw new Error('SIGNAL_TURN_CAPABILITY_SECRET must contain at least 32 characters');
  }
  const rooms = new Map();
  const contributions = createRoomContributions(config.contributions ?? {}, dependencies.contributions);
  const contributionTrackRecoveries = new WeakMap();
  const realtimeMembers = createRoomRealtimeMembers();
  const clockIdentity = randomBytes(16).toString('hex');
  // One ephemeral solo-listening declaration per connected socket. No wallet,
  // address, IP, or durable profile is exposed; public clients receive only
  // aggregate counts keyed by the catalog track hash.
  const soloPresenceBySocket = new Map();
  const startedAt = Date.now();
  const chatLimiter = createWindowLimiter(config.chatRateLimit.limit, config.chatRateLimit.windowMs);
  const reactionLimiter = createWindowLimiter(config.reactionRateLimit.limit, config.reactionRateLimit.windowMs);
  const requestLimiter = createWindowLimiter(config.requestRateLimit.limit, config.requestRateLimit.windowMs);
  const typingLimiter = createWindowLimiter(8, 5000);
  const pinLimiter = createWindowLimiter(5, 5000);
  // Keyed by network address, never cleared on disconnect (that is the point):
  // a reconnect from the same address keeps consuming the same join budget.
  const joinLimiter = createWindowLimiter(config.joinRateLimit.limit, config.joinRateLimit.windowMs);

  function logEvent(event, fields = {}) {
    config.logger(JSON.stringify({ at: new Date().toISOString(), app: 'dotify-signal', event, ...fields }));
  }

  function isOriginAllowed(origin) {
    return isSignalingOriginAllowed(origin, config);
  }

  function corsHeaders(request) {
    const origin = request?.headers?.origin;
    const headers = {
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'content-type'
    };

    if (config.origins === '*') {
      headers['access-control-allow-origin'] = '*';
    } else if (origin && isOriginAllowed(origin)) {
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
        listeners: listenerTotal,
        soloListeners: soloPresenceBySocket.size,
        // Non-secret configuration echo (ticket 10): lets an operator confirm
        // which origin policy and room lifetimes a deployment is running.
        allowedOrigins: config.origins,
        allowMissingOrigin: config.allowMissingOrigin,
        turnCapabilityConfigured: Boolean(config.turnCapabilitySecret),
        roomTtlMs: config.roomTtlMs,
        hostHeartbeatTimeoutMs: config.hostHeartbeatTimeoutMs,
        maxListenersPerRoom: config.maxListenersPerRoom
      });
      return;
    }

    if (requestUrl.pathname === '/status') {
      sendJson(request, response, 200, { rooms: publicRooms(), soloListeningByTrackHash: publicSoloPresence() });
      return;
    }

    response.writeHead(200, { ...corsHeaders(request), 'content-type': 'text/plain' });
    response.end('Dotify signaling server\n');
  });

  const io = new Server(httpServer, {
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;
      const allowed = isOriginAllowed(origin);
      if (!allowed) {
        logEvent('origin:rejected', {
          origin: origin ?? '<missing>',
          referer: request.headers.referer ?? '',
          userAgent: request.headers['user-agent'] ?? '',
          url: request.url ?? ''
        });
      }
      callback(null, allowed);
    },
    cors: { origin: config.origins === '*' ? '*' : config.origins, methods: ['GET', 'POST'] }
  });
  const life = createRoomLife({ io, rooms, historyLimit: config.chatHistoryLimit });

  function publicRoom(roomId, room) {
    return {
      roomId,
      title: room.track?.title ?? 'Listening room',
      hostName: room.hostName,
      track: room.track,
      playerState: room.playerState,
      hostConnected: Boolean(room.hostId),
      playbackMode: room.playbackMode,
      // Every registered track sits behind an artist access policy that the
      // HOST must satisfy. Listeners never need wallet access for rooms.
      hostAccessRequired: Boolean(room.track),
      listenersNeedWalletAccess: false,
      createdAt: room.createdAt,
      expiresAt: room.createdAt + config.roomTtlMs,
      listenerCount: room.listeners.size,
      maxListeners: config.maxListenersPerRoom,
      isFull: room.listeners.size >= config.maxListenersPerRoom
    };
  }

  function publicRooms() {
    return Array.from(rooms.entries())
      .filter(([, room]) => Boolean(room.hostId))
      .map(([roomId, room]) => publicRoom(roomId, room));
  }

  function emitRooms() {
    io.emit('rooms:updated', publicRooms());
  }

  function recoverRoomContributionTrack(roomId, room, expectedTrack = room.track) {
    if (!expectedTrack || expectedTrack.runtimeAddress) return;
    const current = contributionTrackRecoveries.get(room);
    if (current?.expectedTrack === expectedTrack) return;
    const recovery = contributions.recoverTrack(room, expectedTrack);
    contributionTrackRecoveries.set(room, { expectedTrack, recovery });
    void recovery
      .then(recoveredTrack => {
        if (!recoveredTrack) return;
        io.to(roomId).emit('room:track', recoveredTrack);
        emitRooms();
        logEvent('room:track-attribution-recovered', {
          roomId,
          hash: recoveredTrack.hash,
          runtimeAddress: recoveredTrack.runtimeAddress
        });
      })
      .catch(error => {
        logEvent('room:track-attribution-unavailable', {
          roomId,
          hash: expectedTrack.hash,
          reason: error instanceof Error ? error.message : 'Release verification failed'
        });
      })
      .finally(() => {
        if (contributionTrackRecoveries.get(room)?.recovery === recovery) contributionTrackRecoveries.delete(room);
      });
  }

  function publicSoloPresence() {
    const counts = {};
    for (const trackHash of soloPresenceBySocket.values()) {
      counts[trackHash] = (counts[trackHash] ?? 0) + 1;
    }
    return counts;
  }

  function emitSoloPresence() {
    io.emit('presence:solo:updated', publicSoloPresence());
  }

  function clearSoloPresence(socket) {
    if (!soloPresenceBySocket.delete(socket.id)) return;
    emitSoloPresence();
  }

  function listenerRoster(room) {
    return Array.from(room.listeners.values()).map(listener => ({
      id: listener.id,
      displayName: listener.displayName
    }));
  }

  function emitListenerRoster(roomId, room) {
    io.to(roomId).emit('room:listeners', {
      listenerCount: room.listeners.size,
      listeners: listenerRoster(room)
    });
  }

  function closeRoom(roomId, room, reason, event) {
    life.closeRoom(room);
    io.to(roomId).emit('room:closed', { reason });
    rooms.delete(roomId);
    io.in(roomId).socketsLeave(roomId);
    logEvent(event, { roomId, listenerCount: room.listeners.size, reason });
    emitRooms();
  }

  function emitRealtimeRoster(room, roster) {
    for (const id of realtimeMembers.recipients(room)) io.to(id).emit('room:realtime-roster', roster);
  }

  function removeRealtimeMember(socket, room) {
    const roster = realtimeMembers.remove(room, socket.id);
    if (roster) emitRealtimeRoster(room, roster);
  }

  function touchHost(room) {
    room.lastHostSeenAt = Date.now();
  }

  function createHostResumeCredential() {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      hash: createHash('sha256').update(token).digest()
    };
  }

  function matchesHostResumeToken(room, token) {
    if (typeof token !== 'string' || token.length < 32) return false;
    const candidate = createHash('sha256').update(token).digest();
    return candidate.length === room.hostResumeTokenHash.length && timingSafeEqual(candidate, room.hostResumeTokenHash);
  }

  function currentRoomMembership(socket) {
    const roomId = socket.data.roomId;
    const role = socket.data.role;
    const room = typeof roomId === 'string' ? rooms.get(roomId) : null;
    if (!room || (role !== 'host' && role !== 'listener')) return null;
    if (role === 'host' && room.hostId !== socket.id) return null;
    if (role === 'listener' && !room.listeners.has(socket.id)) return null;
    return { roomId, role };
  }

  function issueTurnCapability(socket, now = Date.now()) {
    if (!config.turnCapabilitySecret) return null;
    const membership = currentRoomMembership(socket);
    if (!membership) return null;
    const iat = Math.floor(now / 1000);
    const exp = Math.floor((now + config.turnCapabilityTtlMs) / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        v: 1,
        aud: 'dotify-turn',
        roomId: membership.roomId,
        participantId: socket.id,
        role: membership.role,
        iat,
        exp
      })
    ).toString('base64url');
    const signature = createHmac('sha256', config.turnCapabilitySecret).update(payload).digest('base64url');
    return { token: `${payload}.${signature}`, expiresAt: exp * 1000 };
  }

  io.on('connection', socket => {
    for (const event of ['room:tip-bind', 'room:tip-quote', 'room:tip-notify']) {
      socket.on(event, async (payload = {}, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        const participant = getParticipant(socket);
        if (!participant || !requestLimiter.allow(socket.id)) return reply({ ok: false, error: 'Reconnect or wait before trying again.' });
        try {
          if (event === 'room:tip-bind') {
            if (participant.role !== 'host') throw new Error('Only the room host can set the receiving account.');
            const revision = (participant.room.tipBindRevision ?? 0) + 1;
            participant.room.tipBindRevision = revision;
            delete participant.room.tipHost;
            if (payload.token === '') {
              return reply({ ok: true });
            }
            await contributions.bind(
              participant.room,
              payload.token,
              () => getParticipant(socket)?.room === participant.room && participant.room.hostId === socket.id && participant.room.tipBindRevision === revision
            );
          } else if (event === 'room:tip-quote') {
            const result = await contributions.quote(participant.room, payload);
            if (getParticipant(socket)?.room !== participant.room) throw new Error('The room changed.');
            return reply(result);
          } else {
            const message = await contributions.notification(participant.room, payload);
            if (message && getParticipant(socket)?.room === participant.room) {
              participant.room.chat.push(message);
              if (participant.room.chat.length > config.chatHistoryLimit) participant.room.chat.shift();
              io.to(participant.roomId).emit('room:chat', message);
            }
          }
          reply({ ok: true });
        } catch (error) {
          reply({ ok: false, error: error.message || 'Room contributions are unavailable.' });
        }
      });
    }
    socket.emit('rooms:updated', publicRooms());
    socket.emit('presence:solo:updated', publicSoloPresence());

    socket.on('room:realtime-clock', (_payload, reply) => {
      if (typeof reply !== 'function') return;
      if (!currentRoomMembership(socket)) {
        reply({ ok: false });
        return;
      }
      const now = Date.now();
      if (!socket.data.clockWindow || now - socket.data.clockWindow.start >= 10_000) socket.data.clockWindow = { start: now, count: 0 };
      if (++socket.data.clockWindow.count > 10) {
        reply({ ok: false });
        return;
      }
      reply({ ok: true, time: now, server: clockIdentity });
    });

    socket.on('room:realtime-register', (payload, reply) => {
      if (typeof reply !== 'function') return;
      const participant = getParticipant(socket);
      if (!participant || !socket.rooms.has(participant.roomId)) {
        reply({ ok: false, error: 'Join the room before enabling private realtime.' });
        return;
      }
      // Bound curve validation and roster fanout independently of room chat.
      const now = Date.now();
      if (now - (socket.data.lastRealtimeRegistration ?? 0) < 1000) {
        reply({ ok: false, error: 'Please wait before trying private realtime again.' });
        return;
      }
      socket.data.lastRealtimeRegistration = now;
      const result = realtimeMembers.register(participant.room, socket.id, participant.role, payload);
      if (!result) {
        reply({ ok: false, error: 'The realtime session key is invalid or already registered.' });
        return;
      }
      const { self, ...roster } = result;
      reply({ ok: true, self, roster });
      emitRealtimeRoster(participant.room, roster);
    });

    socket.on('room:realtime-unregister', payload => {
      const participant = getParticipant(socket);
      if (!participant || typeof payload?.scope !== 'string' || typeof payload?.self !== 'string') return;
      const roster = realtimeMembers.remove(participant.room, socket.id, payload);
      if (roster) emitRealtimeRoster(participant.room, roster);
    });

    socket.on('presence:solo', (payload = {}) => {
      const trackHash = sanitizeTrackHash(payload.trackHash);
      // A socket is either listening solo or participating in a room, never
      // both. Null and invalid hashes clear the caller's own declaration.
      if (!trackHash || socket.data.roomId) {
        clearSoloPresence(socket);
        return;
      }

      if (soloPresenceBySocket.get(socket.id) === trackHash) return;
      soloPresenceBySocket.set(socket.id, trackHash);
      emitSoloPresence();
    });

    socket.on('room:turn-capability', (_payload = {}, reply) => {
      if (!config.turnCapabilitySecret) {
        reply?.({ ok: false, error: 'Room relay authorization is not configured.', code: 'TURN_CAPABILITY_NOT_CONFIGURED' });
        return;
      }
      const capability = issueTurnCapability(socket);
      if (!capability) {
        reply?.({ ok: false, error: 'Join or open a room before requesting relay access.', code: 'ROOM_MEMBERSHIP_REQUIRED' });
        return;
      }
      reply?.({ ok: true, capability: capability.token, expiresAt: capability.expiresAt });
    });

    socket.on('room:create', (payload = {}, reply) => {
      socket.data.joinRevision = (socket.data.joinRevision ?? 0) + 1;
      leaveRoom(socket);

      const roomId = createRoomId(rooms);
      const resumeCredential = createHostResumeCredential();
      const room = {
        hostId: socket.id,
        hostResumeTokenHash: resumeCredential.hash,
        hostName: sanitizeText(payload.displayName, 'Host', 32),
        listeners: new Map(),
        track: sanitizeTrack(payload.track),
        // In-room chat only: capped ring buffer, wiped with the room, never
        // included in publicRoom()/status.
        chat: [],
        // Collaborative request queue: same in-room-only doctrine as chat.
        requests: [],
        lineup: [],
        playerState: null,
        playerStateReceivedAt: 0,
        playbackMode: payload.playbackMode === 'preview' ? 'preview' : 'full',
        createdAt: Date.now(),
        lastHostSeenAt: Date.now()
      };

      rooms.set(roomId, room);
      socket.data.roomId = roomId;
      socket.data.role = 'host';
      socket.join(roomId);

      logEvent('room:created', {
        roomId,
        hostName: room.hostName,
        track: room.track?.title ?? null,
        transport: socket.conn.transport.name
      });
      reply?.({
        ok: true,
        roomId,
        hostName: room.hostName,
        hostResumeToken: resumeCredential.token,
        expiresAt: room.createdAt + config.roomTtlMs
      });
      emitRooms();
      recoverRoomContributionTrack(roomId, room);
    });

    socket.on('room:resume', (payload = {}, reply) => {
      socket.data.joinRevision = (socket.data.joinRevision ?? 0) + 1;
      const roomId = normalizeRoomId(payload.roomId);
      const room = rooms.get(roomId);
      if (!room) {
        reply?.({ ok: false, error: 'Room not found. It may have ended or expired.', code: 'ROOM_NOT_FOUND' });
        return;
      }
      if (!matchesHostResumeToken(room, payload.hostResumeToken)) {
        reply?.({ ok: false, error: 'This host session cannot resume the room.', code: 'INVALID_HOST_RESUME_TOKEN' });
        return;
      }
      if (room.hostId && room.hostId !== socket.id) {
        reply?.({ ok: false, error: 'The room host is already connected.', code: 'HOST_ALREADY_CONNECTED' });
        return;
      }

      if (socket.data.role !== 'host' || socket.data.roomId !== roomId) leaveRoom(socket);
      room.hostId = socket.id;
      socket.data.roomId = roomId;
      socket.data.role = 'host';
      socket.join(roomId);
      touchHost(room);

      logEvent('room:resumed', {
        roomId,
        hostName: room.hostName,
        listenerCount: room.listeners.size,
        transport: socket.conn.transport.name
      });
      reply?.({
        ok: true,
        roomId,
        hostName: room.hostName,
        listenerCount: room.listeners.size,
        listeners: listenerRoster(room),
        chatHistory: room.chat,
        ...life.snapshot(room),
        lineup: room.lineup,
        expiresAt: room.createdAt + config.roomTtlMs
      });
      io.to(roomId).emit('room:host-connection', { status: 'online' });
      for (const listener of room.listeners.values()) {
        socket.emit('listener:ready', {
          listenerId: listener.id,
          displayName: listener.displayName,
          listenerCount: room.listeners.size
        });
      }
      emitRooms();
      recoverRoomContributionTrack(roomId, room);
    });

    socket.on('room:join', async (payload = {}, reply) => {
      reply = typeof reply === 'function' ? reply : () => {};
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        reply({ ok: false, error: 'Invalid room request.' });
        return;
      }
      const joinRevision = (socket.data.joinRevision = (socket.data.joinRevision ?? 0) + 1);
      leaveRoom(socket);

      // Throttle join/reconnect churn per network address. Anonymous listeners
      // give us no durable per-user identity, so without this a client could
      // reset its per-socket chat/reaction budget just by disconnecting and
      // rejoining with a fresh socket id. This is the only limiter keyed by
      // address rather than socket id, so it survives that reconnect.
      if (!joinLimiter.allow(clientKey(socket, { trustProxy: config.trustProxy }))) {
        reply?.({ ok: false, error: 'Too many join attempts. Please wait a moment.', code: 'JOIN_THROTTLED' });
        return;
      }

      const roomId = normalizeRoomId(payload.roomId);
      const room = rooms.get(roomId);
      if (!room) {
        reply?.({ ok: false, error: 'Room not found. It may have ended or expired.', code: 'ROOM_NOT_FOUND' });
        return;
      }
      if (!room.hostId) {
        reply?.({ ok: false, error: 'The room host is reconnecting. Try again in a moment.', code: 'HOST_RECONNECTING' });
        return;
      }
      if (room.listeners.size >= config.maxListenersPerRoom) {
        reply?.({ ok: false, error: 'Room is full.', code: 'ROOM_FULL' });
        return;
      }

      const resumed = life.resumable(room, payload.listenerResumeToken);
      let artist = resumed?.artist;
      if (!resumed && payload.announceArtist === true) {
        let deadline;
        try {
          artist = await Promise.race([
            contributions.verifyArtist(room, payload.artistToken),
            new Promise((_, reject) => {
              deadline = setTimeout(() => reject(new Error('Artist verification is taking too long. Try again or join discreetly.')), 6000);
            })
          ]);
        } catch (error) {
          reply?.({ ok: false, error: error instanceof Error ? error.message : 'The artist visit could not be verified.' });
          return;
        } finally {
          clearTimeout(deadline);
        }
      }
      if (!socket.connected || socket.data.joinRevision !== joinRevision) return;
      if (rooms.get(roomId) !== room || !room.hostId || room.listeners.size >= config.maxListenersPerRoom) {
        reply?.({ ok: false, error: 'The room changed or is full. Please try again.' });
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
      const listenerResumeToken = life.joined(roomId, socket, listener.displayName, artist, payload.listenerResumeToken);

      const listenerCount = room.listeners.size;
      logEvent('room:joined', { roomId, listenerId: socket.id, listenerCount });
      reply?.({
        ok: true,
        roomId,
        hostId: room.hostId,
        hostName: room.hostName,
        listenerCount,
        track: room.track,
        playerState: snapshotPlayerState(room.playerState, room.playerStateReceivedAt),
        playbackMode: room.playbackMode,
        chatHistory: room.chat,
        ...life.snapshot(room),
        listenerResumeToken,
        artistAnnounced: Boolean(socket.data.artist),
        requests: room.requests,
        lineup: room.lineup,
        listeners: listenerRoster(room),
        expiresAt: room.createdAt + config.roomTtlMs
      });

      io.to(room.hostId).emit('listener:joined', {
        listenerId: socket.id,
        displayName: listener.displayName,
        listenerCount
      });
      io.to(roomId).emit('room:listener-count', { listenerCount });
      emitListenerRoster(roomId, room);
      emitRooms();
      recoverRoomContributionTrack(roomId, room);
    });

    socket.on('room:track', track => {
      const room = getHostedRoom(socket);
      if (!room) return;

      touchHost(room);
      const nextTrack = sanitizeTrack(track);
      if (nextTrack && (room.track?.hash !== nextTrack.hash || room.track?.runtimeAddress !== nextTrack.runtimeAddress)) {
        life.activity(socket.data.roomId, 'track', `Now playing: ${nextTrack.title} — ${nextTrack.artist}`);
      }
      if (room.track?.hash !== nextTrack?.hash || room.track?.title !== nextTrack?.title) {
        room.playerState = null;
        room.playerStateReceivedAt = 0;
        socket.to(socket.data.roomId).emit('player:state', null);
      }
      room.track = nextTrack;
      socket.to(socket.data.roomId).emit('room:track', room.track);
      emitRooms();
      recoverRoomContributionTrack(socket.data.roomId, room, nextTrack);
    });

    socket.on('room:lineup', (payload = []) => {
      const room = getHostedRoom(socket);
      if (!room || !Array.isArray(payload)) return;

      touchHost(room);
      const seen = new Set();
      const previousIds = new Set(room.lineup.map(item => item.trackId));
      room.lineup = payload
        .slice(0, config.lineupLimit * 2)
        .map(sanitizeLineupItem)
        .filter(item => {
          if (!item || seen.has(item.trackId)) return false;
          seen.add(item.trackId);
          return true;
        })
        .slice(0, config.lineupLimit);
      const additions = room.lineup.filter(item => !previousIds.has(item.trackId));
      if (additions.length)
        life.activity(
          socket.data.roomId,
          'queue',
          additions.length === 1
            ? `${room.hostName} added “${additions[0].title}” to Up next.`
            : `${room.hostName} added ${additions.length} tracks to Up next.`
        );
      io.to(socket.data.roomId).emit('room:lineup', room.lineup);
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

    socket.on('room:rename', (payload = {}, reply) => {
      const participant = getParticipant(socket);
      if (!participant) {
        reply?.({ ok: false, error: 'Not in a room.' });
        return;
      }

      const displayName = sanitizeText(payload.displayName, '', 32);
      if (!displayName || displayName === 'Listener') {
        reply?.({ ok: false, error: 'Choose a room name first.' });
        return;
      }

      if (participant.role === 'host') {
        participant.room.hostName = displayName;
        touchHost(participant.room);
        io.to(participant.roomId).emit('host:renamed', { displayName });
        emitRooms();
        reply?.({ ok: true, displayName });
        return;
      }

      const listener = participant.room.listeners.get(socket.id);
      if (!listener) {
        reply?.({ ok: false, error: 'Listener not found.' });
        return;
      }

      listener.displayName = displayName;
      life.rename(socket, displayName);
      io.to(participant.roomId).emit('listener:renamed', { listenerId: socket.id, displayName });
      emitListenerRoster(participant.roomId, participant.room);
      reply?.({ ok: true, displayName });
    });

    socket.on('player:state', state => {
      const room = getHostedRoom(socket);
      if (!room) return;

      touchHost(room);
      room.playerState = sanitizePlayerState(state);
      room.playerStateReceivedAt = Date.now();
      socket.to(socket.data.roomId).emit('player:state', room.playerState);
      emitRooms();
    });

    // Host media transport is independent from metadata. When the host swaps
    // or refreshes the WebRTC sender track, listeners may keep the same
    // receiver but still need to restart their hidden audio element.
    socket.on('room:stream-ready', () => {
      const room = getHostedRoom(socket);
      if (!room) return;

      touchHost(room);
      socket.to(socket.data.roomId).emit('room:stream-ready', { updatedAt: Date.now() });
    });

    socket.on('host:heartbeat', () => {
      const room = getHostedRoom(socket);
      if (room) touchHost(room);
    });

    // Social layer: reactions and chat are open to every room participant
    // (host and listeners alike). Malformed or over-limit events are dropped
    // silently -- fail closed, no error channel to probe.
    socket.on('room:reaction', (payload = {}) => {
      const participant = getParticipant(socket);
      if (!participant) return;
      if (!reactionLimiter.allow(socket.id)) return;

      const emoji = sanitizeReactionEmoji(payload.emoji);
      if (!emoji) return;

      if (participant.role === 'host') touchHost(participant.room);
      io.to(participant.roomId).emit('room:reaction', {
        id: randomUUID(),
        emoji,
        senderId: socket.id,
        senderName: participant.displayName,
        ts: Date.now()
      });
    });

    socket.on('room:typing', (payload = {}) => {
      const participant = getParticipant(socket);
      if (!participant || typeof payload?.active !== 'boolean' || !typingLimiter.allow(socket.id)) return;
      life.typing(socket, payload.active, participant.displayName);
    });
    socket.on('room:pin', (payload = {}, ack) => {
      ack = typeof ack === 'function' ? ack : () => {};
      if (!payload || (payload.id !== null && typeof payload.id !== 'string')) {
        ack({ ok: false });
        return;
      }
      const room = getHostedRoom(socket);
      if (!room || !pinLimiter.allow(socket.id)) {
        ack?.({ ok: false });
        return;
      }
      const message = payload.id === null ? null : room.chat.find(message => message.id === payload.id && message.senderId !== 'dotify-confirmed-tip');
      if (message === undefined) {
        ack?.({ ok: false });
        return;
      }
      life.pin(socket.data.roomId, message);
      ack?.({ ok: true });
    });
    socket.on('room:artist-clear', () => {
      delete socket.data.artist;
      const participant = getParticipant(socket);
      const member = participant?.room.lifeMembers?.get(socket.data.lifeToken);
      if (member) member.artist = undefined;
    });
    socket.on('room:chat', (payload = {}, ack) => {
      const reply = result => {
        if (typeof ack === 'function') ack(result);
      };
      const participant = getParticipant(socket);
      if (!participant) {
        reply({ ok: false, message: 'Reconnect to the room before sending.' });
        return;
      }
      if (!chatLimiter.allow(socket.id)) {
        reply({ ok: false, message: 'A little too fast. Try again in a moment.' });
        return;
      }

      const text = sanitizeChatText(payload.text);
      if (!text) {
        reply({ ok: false, message: 'Write a message first.' });
        return;
      }

      if (participant.role === 'host') touchHost(participant.room);
      const message = {
        id: randomUUID(),
        text,
        senderId: socket.id,
        senderName: participant.displayName,
        ts: Date.now()
      };
      if (socket.data.artist) message.artist = socket.data.artist;
      const parent = participant.room.chat.find(entry => entry.id === payload.replyTo && entry.senderId !== 'dotify-confirmed-tip');
      if (parent) message.replyTo = { id: parent.id, text: parent.text, senderId: parent.senderId, senderName: parent.senderName };
      // Mentions address current participants; arbitrary ids and payload labels are ignored.
      const ids = new Set([participant.room.hostId, ...participant.room.listeners.keys()]);
      message.mentions = Array.isArray(payload.mentions) ? [...new Set(payload.mentions.filter(id => ids.has(id)))].slice(0, 5) : [];
      life.typing(socket, false);

      participant.room.chat.push(message);
      if (participant.room.chat.length > config.chatHistoryLimit) {
        participant.room.chat.shift();
      }
      io.to(participant.roomId).emit('room:chat', message);
      reply({ ok: true });
    });

    // Collaborative request queue. Any participant proposes a track to hear
    // next; the host vetoes or clears. Every mutation broadcasts the full
    // list (room:requests) so the queue has a single server-authoritative
    // render path, exactly like chat -- no optimistic divergence.
    socket.on('room:request', (payload = {}, ack) => {
      const reply = result => {
        if (typeof ack === 'function') ack(result);
      };
      const participant = getParticipant(socket);
      if (!participant) {
        reply({ ok: false, message: 'Reconnect to the room before sending.' });
        return;
      }
      if (!requestLimiter.allow(socket.id)) {
        reply({ ok: false, message: 'A little too fast. Try again in a moment.' });
        return;
      }

      const text = sanitizeChatText(payload.text, REQUEST_TEXT_MAX_LENGTH);
      if (!text) {
        reply({ ok: false, message: 'Name a track first.' });
        return;
      }
      if (participant.room.requests.length >= config.requestQueueLimit) {
        reply({ ok: false, message: 'Requests are full. Wait for the host to make room.' });
        return;
      }

      if (participant.role === 'host') touchHost(participant.room);
      participant.room.requests.push({
        id: randomUUID(),
        text,
        senderId: socket.id,
        senderName: participant.displayName,
        ts: Date.now()
      });
      io.to(participant.roomId).emit('room:requests', participant.room.requests);
      reply({ ok: true });
    });

    // Host veto: remove one request by id. Host-only.
    socket.on('room:request:remove', (payload = {}) => {
      const room = getHostedRoom(socket);
      if (!room) return;

      touchHost(room);
      const id = typeof payload.id === 'string' ? payload.id : null;
      if (!id) return;
      const next = room.requests.filter(request => request.id !== id);
      if (next.length === room.requests.length) return;
      room.requests = next;
      io.to(socket.data.roomId).emit('room:requests', room.requests);
    });

    // Host clears the whole queue. Host-only.
    socket.on('room:request:clear', () => {
      const room = getHostedRoom(socket);
      if (!room) return;

      touchHost(room);
      if (room.requests.length === 0) return;
      room.requests = [];
      io.to(socket.data.roomId).emit('room:requests', room.requests);
    });

    socket.on('webrtc:offer', (payload = {}) => {
      routePeerMessage(socket, payload.targetId, 'webrtc:offer', { from: socket.id, offer: payload.offer }, 'host', 'listener');
    });

    socket.on('webrtc:answer', (payload = {}) => {
      routePeerMessage(socket, payload.targetId, 'webrtc:answer', { from: socket.id, answer: payload.answer }, 'listener', 'host');
    });

    socket.on('webrtc:ice-candidate', (payload = {}) => {
      routePeerMessage(socket, payload.targetId, 'webrtc:ice-candidate', { from: socket.id, candidate: payload.candidate });
    });

    socket.on('peer:connected', (payload = {}) => {
      routePeerMessage(socket, payload.targetId, 'peer:connected', { from: socket.id }, 'listener', 'host');
    });

    // Client-side WebRTC failures are otherwise invisible inside native
    // Product webviews. Keep this deliberately metadata-only: no SDP, ICE
    // candidates, IP addresses, media identifiers, or user agent strings.
    socket.on('webrtc:diagnostic', (payload = {}) => {
      const participant = getParticipant(socket);
      if (!participant || !socket.rooms.has(participant.roomId)) return;

      const states = new Set([
        'new',
        'connecting',
        'connected',
        'disconnected',
        'failed',
        'closed',
        'checking',
        'completed',
        'gathering',
        'stable',
        'have-local-offer',
        'have-remote-offer'
      ]);
      const safeState = value => (states.has(value) ? value : null);
      const errorCode = Number(payload.errorCode);
      logEvent('webrtc:diagnostic', {
        roomId: participant.roomId,
        sourceId: socket.id,
        sourceRole: participant.role,
        phase: sanitizeText(payload.phase, 'unknown', 80),
        errorName: sanitizeText(payload.errorName, '', 80),
        message: sanitizeText(payload.message, '', 240),
        errorCode: Number.isSafeInteger(errorCode) ? errorCode : null,
        peerConnectionAvailable: payload.peerConnectionAvailable === true,
        turnRelayAvailable: payload.turnRelayAvailable === true,
        protocol: sanitizeText(payload.protocol, '', 20),
        embedded: payload.embedded === true,
        connectionState: safeState(payload.connectionState),
        iceConnectionState: safeState(payload.iceConnectionState),
        iceGatheringState: safeState(payload.iceGatheringState),
        signalingState: safeState(payload.signalingState)
      });
    });

    socket.on('listener:ready', () => {
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (socket.data.role !== 'listener' || !room?.hostId) return;

      const listener = room.listeners.get(socket.id);
      logEvent('listener:ready', {
        roomId,
        listenerId: socket.id,
        hostId: room.hostId,
        listenerCount: room.listeners.size
      });
      io.to(room.hostId).emit('listener:ready', {
        listenerId: socket.id,
        displayName: listener?.displayName ?? 'Listener',
        listenerCount: room.listeners.size
      });
    });

    socket.on('rooms:list', reply => {
      reply?.(publicRooms());
    });

    socket.on('room:leave', () => {
      socket.data.joinRevision = (socket.data.joinRevision ?? 0) + 1;
      leaveRoom(socket);
    });
    socket.on('disconnect', reason => disconnectFromRoom(socket, reason));
  });

  // Sweep: enforce room TTL and host liveness so zombie rooms cannot pile up.
  const sweepTimer = setInterval(() => {
    const now = Date.now();
    // Reclaim expired join-throttle buckets (keyed by address, never cleared
    // on disconnect) so the limiter Map stays bounded.
    joinLimiter.prune(now);
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

  function routePeerMessage(sourceSocket, targetId, eventName, message, expectedSourceRole, expectedTargetRole) {
    const logPeerEvent = eventName !== 'webrtc:ice-candidate';
    const logPeerDrop = reason => {
      if (!logPeerEvent) return;
      logEvent('peer:route-dropped', {
        event: eventName,
        reason,
        sourceId: sourceSocket.id,
        sourceRole: sourceSocket.data.role ?? null,
        roomId: sourceSocket.data.roomId ?? null,
        targetId: typeof targetId === 'string' ? targetId : null
      });
    };

    if (typeof targetId !== 'string' || !targetId) {
      logPeerDrop('missing-target');
      return;
    }

    const source = getParticipant(sourceSocket);
    if (!source || !sourceSocket.rooms.has(source.roomId)) {
      logPeerDrop('invalid-source');
      return;
    }
    if (expectedSourceRole && source.role !== expectedSourceRole) {
      logPeerDrop('unexpected-source-role');
      return;
    }

    const targetSocket = io.sockets.sockets.get(targetId);
    if (!targetSocket || !targetSocket.rooms.has(source.roomId)) {
      logPeerDrop('target-not-in-room');
      return;
    }

    const target = getParticipant(targetSocket);
    if (!target || target.roomId !== source.roomId || target.role === source.role) {
      logPeerDrop('invalid-target');
      return;
    }
    if (expectedTargetRole && target.role !== expectedTargetRole) {
      logPeerDrop('unexpected-target-role');
      return;
    }

    if (logPeerEvent) {
      logEvent('peer:route', {
        event: eventName,
        roomId: source.roomId,
        sourceId: sourceSocket.id,
        sourceRole: source.role,
        targetId,
        targetRole: target.role
      });
    }
    targetSocket.emit(eventName, message);
  }

  function getHostedRoom(socket) {
    const room = rooms.get(socket.data.roomId);
    return room?.hostId === socket.id ? room : null;
  }

  // Resolve the socket to a verified room participant (host or listener).
  // Returns null for sockets that claim a room they are not actually in.
  function getParticipant(socket) {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return null;

    if (socket.data.role === 'host' && room.hostId === socket.id) {
      return { room, roomId, role: 'host', displayName: room.hostName };
    }

    if (socket.data.role === 'listener') {
      const listener = room.listeners.get(socket.id);
      if (listener) {
        return { room, roomId, role: 'listener', displayName: listener.displayName };
      }
    }

    return null;
  }

  function leaveRoom(socket, disconnected = false) {
    clearSoloPresence(socket);
    const roomId = socket.data.roomId;
    const role = socket.data.role;
    if (!roomId || !role) return;

    const room = rooms.get(roomId);
    if (!room) {
      clearSocketRoom(socket);
      return;
    }

    removeRealtimeMember(socket, room);
    life.leaving(socket, disconnected);

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
      if (room.hostId) io.to(room.hostId).emit('listener:left', { listenerId: socket.id, listenerCount });
      io.to(roomId).emit('room:listener-count', { listenerCount });
      emitListenerRoster(roomId, room);
      emitRooms();
    }

    clearSocketRoom(socket);
    socket.leave(roomId);
  }

  function disconnectFromRoom(socket, reason) {
    clearSoloPresence(socket);
    const roomId = socket.data.roomId;
    const role = socket.data.role;
    if (!roomId || !role) return;

    const room = rooms.get(roomId);
    if (!room) {
      clearSocketRoom(socket);
      return;
    }

    if (role === 'host' && room.hostId === socket.id) {
      room.hostId = null;
      life.leaving(socket, true);
      delete room.tipHost;
      room.tipBindRevision = (room.tipBindRevision ?? 0) + 1;
      removeRealtimeMember(socket, room);
      touchHost(room);
      clearSocketRoom(socket);
      logEvent('room:host-disconnected', {
        roomId,
        listenerCount: room.listeners.size,
        reason,
        transport: socket.conn.transport.name,
        resumeWindowMs: config.hostHeartbeatTimeoutMs
      });
      io.to(roomId).emit('room:host-connection', {
        status: 'reconnecting',
        resumeUntil: room.lastHostSeenAt + config.hostHeartbeatTimeoutMs
      });
      emitRooms();
      return;
    }

    leaveRoom(socket, true);
  }

  function clearSocketRoom(socket) {
    delete socket.data.artist;
    delete socket.data.lifeToken;
    socket.data.roomId = undefined;
    socket.data.role = undefined;
    chatLimiter.clear(socket.id);
    reactionLimiter.clear(socket.id);
    requestLimiter.clear(socket.id);
    typingLimiter.clear(socket.id);
    pinLimiter.clear(socket.id);
  }

  return {
    httpServer,
    io,
    rooms,
    soloPresenceBySocket,
    config,
    listen() {
      return new Promise(resolve => {
        httpServer.listen(config.port, config.host, () => {
          logEvent('server:listening', {
            host: config.host,
            port: httpServer.address().port,
            origins: config.origins,
            allowMissingOrigin: config.allowMissingOrigin
          });
          resolve(httpServer.address().port);
        });
      });
    },
    async close() {
      clearInterval(sweepTimer);
      life.close();
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
