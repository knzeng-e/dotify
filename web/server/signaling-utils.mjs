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

export function sanitizeTrack(track) {
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

// Curated room reaction language. Keep in sync with ROOM_REACTIONS in
// web/src/shared/social.ts (the client copy). The bar is a designed set,
// not an open emoji picker.
export const ROOM_REACTION_EMOJI = ['❤️', '\u{1F525}', '\u{1F33F}', '✨', '\u{1F64C}', '\u{1F979}'];

export const CHAT_TEXT_MAX_LENGTH = 280;

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
    }
  };
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
