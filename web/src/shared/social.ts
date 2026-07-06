// Room social layer constants.
//
// The reaction bar is a designed, curated language -- not an open emoji
// picker. Keep this list in sync with ROOM_REACTION_EMOJI in
// web/server/signaling-utils.mjs (the server-side allowlist).
export const ROOM_REACTIONS = ['❤️', '\u{1F525}', '\u{1F33F}', '✨', '\u{1F64C}', '\u{1F979}'] as const;

export const CHAT_TEXT_MAX_LENGTH = 280;

// Collaborative request queue. Mirror of the server: a request is a short
// "play this next" line, and the queue is capped so it stays scannable.
// Keep in sync with REQUEST_TEXT_MAX_LENGTH / requestQueueLimit in
// web/server/signaling.mjs (the server copy is authoritative).
export const REQUEST_TEXT_MAX_LENGTH = 120;
export const REQUEST_QUEUE_CLIENT_LIMIT = 20;

// Client-side cap for the in-memory chat list; matches the server's
// per-room history buffer so late joiners and long-lived participants
// converge on the same window.
export const CHAT_CLIENT_LIMIT = 50;
