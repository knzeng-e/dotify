// Room discovery beacons for the Statement Store.
//
// What this is and is not:
//
// A beacon announces that a room exists and is live, so a listening room can be
// found without asking Dotify's signaling server. It is *additive discovery*. It
// never carries SDP, ICE, chat, or audio, and it is never required to join a
// room - a share link still works with no wallet, no account, and no chain.
// That invariant is the reason the beacon is deliberately small and dull.
//
// Why joining cannot move here:
//
// A WebRTC offer is 1.5-4 KB against a 512-byte statement ceiling, and a guest
// would have to publish an answer to complete a handshake - which requires an
// identity and an allowance. Moving the handshake here would convert every
// listener into a registered person and delete the gesture the product exists to
// protect. The host is already identified, so only the host publishes.
//
// The budget is the hard part:
//
//   MAX_STATEMENT_SIZE  512 bytes   per statement
//   MAX_USER_TOTAL     1024 bytes   per account, across all live statements
//
// One account therefore holds at most two full statements. A beacon is written
// to a per-room channel so last-write-wins keeps exactly one live statement per
// hosted room, and `assertBeaconBudget` refuses a set of rooms that would exceed
// the account total. Publishing blind would get later rooms silently rejected by
// the chain, which reads as "the room vanished".

/** Mirrors MAX_STATEMENT_SIZE in @parity/product-sdk-statement-store. */
export const MAX_BEACON_BYTES = 512;
/** Mirrors MAX_USER_TOTAL. One account across every live statement it holds. */
export const MAX_ACCOUNT_BYTES = 1024;

/** Field bounds, chosen so a worst-case record still fits the ceiling. */
const MAX_ROOM_CODE = 12;
const MAX_HOST_NAME = 40;
const MAX_TRACK_TEXT = 60;
const MAX_LISTENERS = 9_999;

export type RoomBeacon = {
  /** Schema version, so a reader can reject shapes it does not understand. */
  v: 1;
  /** Room code, matching the share link. */
  room: string;
  /** Host display name, already public to anyone holding the link. */
  host: string;
  /** Listener count. Aggregate only - never identities. */
  n: number;
  /** Now playing, present only when the host opted in. */
  t?: string;
  /** Artist, present only alongside `t`. */
  a?: string;
};

export type RoomBeaconInput = {
  roomCode: string;
  hostName: string;
  listenerCount: number;
  /**
   * Now-playing text. Omitted unless the host opted in.
   *
   * This is the one field with a real privacy cost. A room link is semi-public -
   * whoever holds it can look - but a beacon is globally readable and outlives
   * the room by up to the retention window. Publishing what someone is listening
   * to is therefore a different exposure than sharing a link, and it stays a
   * deliberate choice rather than a default.
   */
  nowPlaying?: { title: string; artist: string } | null;
};

function clamp(value: string, max: number): string {
  // Trim first so a long run of spaces cannot consume the budget.
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Build a beacon that is guaranteed to fit MAX_BEACON_BYTES.
 *
 * Returns null for an unusable room code rather than publishing a beacon nobody
 * can join. Optional fields are dropped before required ones if the record is
 * still too large, so discovery degrades to "a room exists here" instead of
 * failing outright.
 */
export function buildRoomBeacon(input: RoomBeaconInput): RoomBeacon | null {
  const room = clamp(input.roomCode, MAX_ROOM_CODE).toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(room)) return null;

  const listeners = Number.isFinite(input.listenerCount) ? Math.max(0, Math.min(MAX_LISTENERS, Math.trunc(input.listenerCount))) : 0;

  const beacon: RoomBeacon = {
    v: 1,
    room,
    host: clamp(input.hostName || 'Host', MAX_HOST_NAME),
    n: listeners
  };

  if (input.nowPlaying) {
    const title = clamp(input.nowPlaying.title, MAX_TRACK_TEXT);
    const artist = clamp(input.nowPlaying.artist, MAX_TRACK_TEXT);
    if (title) beacon.t = title;
    if (artist) beacon.a = artist;
  }

  // Shed optional fields in order of least value until the record fits. A
  // multi-byte host name can still overflow after clamping by character count,
  // so the byte check is authoritative rather than the length bounds above.
  if (byteLength(beacon) > MAX_BEACON_BYTES) delete beacon.a;
  if (byteLength(beacon) > MAX_BEACON_BYTES) delete beacon.t;
  while (byteLength(beacon) > MAX_BEACON_BYTES && beacon.host.length > 1) {
    beacon.host = beacon.host.slice(0, Math.floor(beacon.host.length / 2));
  }

  return byteLength(beacon) <= MAX_BEACON_BYTES ? beacon : null;
}

/** Serialized size of a beacon, in the bytes the chain will actually count. */
export function beaconByteLength(beacon: RoomBeacon): number {
  return byteLength(beacon);
}

/**
 * Channel name for a room, giving last-write-wins per room.
 *
 * Without a per-room channel every heartbeat would be a new statement and the
 * account budget would be exhausted within a couple of beats.
 */
export function roomBeaconChannel(roomCode: string): string {
  return `room/${roomCode.toUpperCase()}`;
}

/** Secondary topic, so a subscriber can filter to one room. */
export function roomBeaconTopic(roomCode: string): string {
  return `dotify-room-${roomCode.toUpperCase()}`;
}

export type BeaconBudget = { ok: true; usedBytes: number } | { ok: false; usedBytes: number; reason: string };

/**
 * Check a set of live beacons against the per-account ceiling.
 *
 * The chain enforces this silently by rejecting the write, which surfaces to a
 * user as a room that never appears. Checking first turns that into an
 * explainable refusal.
 */
export function assertBeaconBudget(beacons: RoomBeacon[]): BeaconBudget {
  const usedBytes = beacons.reduce((total, beacon) => total + byteLength(beacon), 0);
  if (usedBytes > MAX_ACCOUNT_BYTES) {
    return {
      ok: false,
      usedBytes,
      reason: `${beacons.length} live beacons need ${usedBytes} bytes, over the ${MAX_ACCOUNT_BYTES}-byte account limit. Host fewer rooms from one account.`
    };
  }
  return { ok: true, usedBytes };
}

/**
 * Parse a received statement payload into a beacon.
 *
 * Everything here is untrusted: statements are published by arbitrary accounts,
 * so a reader must not assume shape, types, or bounds. Returns null rather than
 * throwing, so one malformed beacon cannot break a discovery list.
 */
export function parseRoomBeacon(data: unknown): RoomBeacon | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (record.v !== 1) return null;

  const room = typeof record.room === 'string' ? record.room.toUpperCase() : '';
  if (!/^[A-Z0-9]{4,12}$/.test(room)) return null;

  const host = typeof record.host === 'string' ? clamp(record.host, MAX_HOST_NAME) : '';
  if (!host) return null;

  const rawCount = typeof record.n === 'number' && Number.isFinite(record.n) ? Math.trunc(record.n) : 0;
  const beacon: RoomBeacon = { v: 1, room, host, n: Math.max(0, Math.min(MAX_LISTENERS, rawCount)) };

  if (typeof record.t === 'string' && record.t.trim()) beacon.t = clamp(record.t, MAX_TRACK_TEXT);
  if (typeof record.a === 'string' && record.a.trim()) beacon.a = clamp(record.a, MAX_TRACK_TEXT);

  return beacon;
}
