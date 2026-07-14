const ROOM_ID_LENGTH = 6;

export function createRoomId(rooms) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let roomId = '';

  do {
    roomId = Array.from({ length: ROOM_ID_LENGTH }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
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
// signaling), the real client sits in the first x-forwarded-for hop; we read
// it ONLY when trustProxy is on, because that header is client-spoofable
// unless a proxy is guaranteed to overwrite it. This is best-effort abuse
// dampening, NOT an identity guarantee: co-located clients behind one NAT
// share a key, which is why message limits stay per-socket and only join
// churn is throttled per address.
export function clientKey(socket, { trustProxy = false } = {}) {
  if (trustProxy) {
    const forwarded = socket?.handshake?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      const first = forwarded.split(',')[0].trim();
      if (first) return first;
    }
  }
  return socket?.handshake?.address || 'unknown';
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
