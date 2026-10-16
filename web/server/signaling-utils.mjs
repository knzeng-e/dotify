import { randomInt } from 'node:crypto';

const ROOM_ID_LENGTH = 6;

export function createRoomId(rooms) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let roomId = '';

  do {
    // The code is the only secret of a link-only room: use a CSPRNG, never Math.random.
    roomId = Array.from({ length: ROOM_ID_LENGTH }, () => alphabet[randomInt(alphabet.length)]).join('');
  } while (rooms.has(roomId));

  return roomId;
}

export function normalizeRoomId(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

export function sanitizeText(value, fallback, maxLength) {
  const text = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
  return text || fallback;
}

export function sanitizeAddress(value) {
  const text = String(value ?? '').trim();
  return /^0x[0-9a-fA-F]{40}$/.test(text) ? text.toLowerCase() : null;
}

// Catalog identity used by anonymous, ephemeral solo-presence events. Accept
// only a full bytes32 hash so one noisy client cannot create arbitrary keys in
// the in-memory aggregate map.
export function sanitizeTrackHash(value) {
  const text = String(value ?? '').trim();
  return /^0x[0-9a-fA-F]{64}$/.test(text) ? text.toLowerCase() : null;
}

export function sanitizeTrack(track) {
  if (!track || typeof track !== 'object') {
    return null;
  }

  const accessMode = ['free', 'classic', 'human-free'].includes(track.accessMode) ? track.accessMode : 'human-free';

  return {
    title: sanitizeText(track.title, 'Untitled', 120),
    artist: sanitizeText(track.artist, 'Unknown artist', 80),
    hash: sanitizeText(track.hash, '', 80),
    ...(/^0x[\da-f]{40}$/i.test(track.runtimeAddress ?? '') ? { runtimeAddress: track.runtimeAddress.toLowerCase() } : {}),
    // TrackInfo crosses the public room and anonymous join boundaries. Source
    // and manifest references are not needed for WebRTC playback: a manifest
    // can reveal the encrypted audio CID even when audioRef itself is absent.
    // Keep the required legacy bulletin field empty and omit every other
    // source-bearing reference from signaling payloads.
    bulletinRef: '',
    imageRef: sanitizeText(track.imageRef, '', 6000),
    description: sanitizeText(track.description, '', 500),
    accessMode,
    priceDot: sanitizeText(track.priceDot, '0', 32),
    personhoodLevel: track.personhoodLevel === 'DIM2' ? 'DIM2' : 'DIM1',
    duration: Number.isFinite(track.duration) ? Number(track.duration) : 0,
    updatedAt: Number.isFinite(track.updatedAt) ? Number(track.updatedAt) : Date.now()
  };
}

export function sanitizeLineupItem(item) {
  if (!item || typeof item !== 'object') return null;
  const trackId = sanitizeText(item.trackId, '', 180);
  if (!trackId) return null;
  const track = sanitizeTrack(item);
  if (!track) return null;
  return {
    trackId,
    title: track.title,
    artist: track.artist,
    imageRef: track.imageRef,
    hash: track.hash,
    accessMode: track.accessMode
  };
}

// Curated room reaction language. Keep in sync with ROOM_REACTIONS in
// web/src/shared/social.ts (the client copy). The bar is a designed set,
// not an open emoji picker.
export const ROOM_REACTION_EMOJI = ['❤️', '\u{1F525}', '\u{1F33F}', '✨', '\u{1F64C}', '\u{1F979}'];

export const CHAT_TEXT_MAX_LENGTH = 280;

// A room request is a short "play this" line, not a paragraph. Shorter than
// chat so the shared queue stays a scannable list of intents.
export const REQUEST_TEXT_MAX_LENGTH = 120;

export function sanitizeReactionEmoji(value) {
  const text = String(value ?? '').trim();
  return ROOM_REACTION_EMOJI.includes(text) ? text : null;
}

export function sanitizeChatText(value, maxLength = CHAT_TEXT_MAX_LENGTH) {
  // Chat is single-line by design: collapse whitespace runs (including
  // newlines) and strip non-printable control characters.
  const text = String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength)
    .trim();
  return text || null;
}

// Fixed-window rate limiter. Social events fail closed and silent: past the
// limit we drop, we do not queue or error back.
export function createWindowLimiter(limit, windowMs) {
  const buckets = new Map();
  return {
    allow(key, now = Date.now()) {
      const bucket = buckets.get(key);
      if (!bucket || now - bucket.start >= windowMs) {
        buckets.set(key, { start: now, count: 1 });
        return true;
      }
      if (bucket.count >= limit) {
        return false;
      }
      bucket.count += 1;
      return true;
    },
    clear(key) {
      buckets.delete(key);
    },
    // Drop buckets whose window has fully elapsed. The server sweep calls this
    // for limiters keyed by a durable identity (e.g. network address) that we
    // deliberately never clear() on disconnect, so their Map cannot grow
    // unbounded over the process lifetime.
    prune(now = Date.now()) {
      for (const [key, bucket] of buckets) {
        if (now - bucket.start >= windowMs) {
          buckets.delete(key);
        }
      }
    },
    // Introspection aid (tests, health): number of live buckets.
    size() {
      return buckets.size;
    }
  };
}

// Resolve a durable-ish network identity for a socket. Anonymous listeners
// carry no wallet, signature, or account, so the network address is the only
// durable signal we can throttle on. Behind a trusted reverse proxy (hosted
// signaling), the real client is Fly-Client-IP or the last appended hop; we read
// it ONLY when trustProxy is on, because that header is client-spoofable
// unless a proxy is guaranteed to overwrite it. This is best-effort abuse
// dampening, NOT an identity guarantee: co-located clients behind one NAT
// share a key, which is why message limits stay per-socket and only join
// churn is throttled per address.
export function clientIdentity(socket, { trustProxy = false } = {}) {
  if (trustProxy) {
    const headers = socket?.handshake?.headers ?? {};
    // Fly's edge sets Fly-Client-IP itself. Otherwise only the last
    // X-Forwarded-For hop was appended by the trusted proxy; earlier hops are
    // whatever the client sent and must never become its identity.
    const flyClient = headers['fly-client-ip'];
    if (typeof flyClient === 'string' && flyClient.trim()) return { key: flyClient.trim(), source: 'fly-client-ip' };
    const forwarded = headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      const hops = forwarded
        .split(',')
        .map(hop => hop.trim())
        .filter(Boolean);
      if (hops.length) return { key: hops[hops.length - 1], source: 'x-forwarded-for' };
    }
  }
  return { key: socket?.handshake?.address || 'unknown', source: 'socket' };
}

export function clientKey(socket, options) {
  return clientIdentity(socket, options).key;
}

export function sanitizePlayerState(state) {
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

// Fresh join snapshots use elapsed SERVER time, not the host/listener wall clock.
// Match the client's short extrapolation window; silence is safer than an
// indefinitely advancing clock after a host stops sending state.
export function snapshotPlayerState(state, receivedAt, now = Date.now()) {
  if (!state) return null;
  const age = Math.max(0, now - receivedAt);
  const duration = Math.max(0, state.duration);
  const currentTime = Math.max(0, state.currentTime) + (state.playing ? Math.min(age, 2500) / 1000 : 0);
  return {
    ...state,
    currentTime: duration > 0 ? Math.min(duration, currentTime) : currentTime,
    playing: state.playing && age <= 2500,
    stale: state.playing && age > 2500,
    updatedAt: now
  };
}
