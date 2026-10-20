export const CELERITY_TTL_MS = 30_000;
export const CELERITY_CLOCK_SKEW_MS = 5_000;
export const CELERITY_MAX_BYTES = 512;

export type PresenceEnvelope = {
  v: 1;
  room: string;
  kind: 'presence';
  id: string;
  producer: string;
  seq: number;
  created: number;
  expires: number;
  pv: 1;
  payload: { listeners: number };
};

export function presenceEnvelope(room: string, producer: string, seq: number, listeners: number, now: number): PresenceEnvelope {
  return { v: 1, room, kind: 'presence', id: `${producer}.${seq}`, producer, seq, created: now, expires: now + CELERITY_TTL_MS, pv: 1, payload: { listeners } };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
}

export function parsePresenceEnvelope(value: unknown, room: string, now: number, sdkExpiry: bigint | undefined): PresenceEnvelope | null {
  if (!record(value) || !exactKeys(value, ['v', 'room', 'kind', 'id', 'producer', 'seq', 'created', 'expires', 'pv', 'payload'])) return null;
  if (value.v !== 1 || value.pv !== 1 || value.kind !== 'presence' || value.room !== room || !/^[A-Z0-9]{4,12}$/.test(room)) return null;
  if (typeof value.producer !== 'string' || !/^[a-f0-9]{32}$/.test(value.producer)) return null;
  if (!Number.isSafeInteger(value.seq) || Number(value.seq) < 1 || value.id !== `${value.producer}.${value.seq}`) return null;
  if (!Number.isSafeInteger(value.created) || !Number.isSafeInteger(value.expires)) return null;
  const created = Number(value.created),
    expires = Number(value.expires);
  if (created < 0 || created > now + CELERITY_CLOCK_SKEW_MS || expires <= now || expires - created !== CELERITY_TTL_MS) return null;
  if (typeof sdkExpiry !== 'bigint') return null;
  const transportExpiry = Number(sdkExpiry >> 32n) * 1000;
  if (transportExpiry <= now || Math.abs(transportExpiry - expires) > 1000) return null;
  if (!record(value.payload) || !exactKeys(value.payload, ['listeners']) || !Number.isSafeInteger(value.payload.listeners)) return null;
  if (Number(value.payload.listeners) < 0 || Number(value.payload.listeners) > 9999) return null;
  if (new TextEncoder().encode(JSON.stringify(value)).length > CELERITY_MAX_BYTES) return null;
  return value as PresenceEnvelope;
}

export type PresenceObservation = { status: 'accepted'; gap: number; ageMs: number } | { status: 'duplicate' | 'reordered' | 'capacity' };

/** Bounded high-water marks outlive payload TTL so old sequence numbers cannot revive. */
export function createPresenceReceiver(maxProducers = 128) {
  const producers = new Map<string, { seq: number; retainUntil: number }>();
  return (event: PresenceEnvelope, now: number): PresenceObservation => {
    for (const [key, entry] of producers) if (entry.retainUntil <= now) producers.delete(key);
    const previous = producers.get(event.producer);
    if (previous && event.seq <= previous.seq) return { status: event.seq === previous.seq ? 'duplicate' : 'reordered' };
    if (!previous && producers.size >= maxProducers) return { status: 'capacity' };
    producers.set(event.producer, { seq: event.seq, retainUntil: Math.max(now, event.created) + CELERITY_TTL_MS + CELERITY_CLOCK_SKEW_MS });
    return { status: 'accepted', gap: previous ? event.seq - previous.seq - 1 : 0, ageMs: now - event.created };
  };
}

/** Local reservation only; other tabs and sponsored-account consumers are invisible. */
export function createCelerityBudget(reservedBytes = 512) {
  const live = new Map<string, { bytes: number; expires: number }>();
  return {
    reserve(channel: string, bytes: number, expires: number, now: number, accountLimit: number, statementLimit: number): boolean {
      if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > statementLimit || expires <= now) return false;
      for (const [key, entry] of live) if (entry.expires <= now) live.delete(key);
      // A smaller/shorter replacement can fail; the previous statement may still exist.
      const previous = live.get(channel);
      const retainedBytes = Math.max(bytes, previous?.bytes ?? 0);
      const used = [...live].reduce((total, [key, entry]) => total + (key === channel ? 0 : entry.bytes), reservedBytes);
      if (used + retainedBytes > accountLimit) return false;
      live.set(channel, { bytes: retainedBytes, expires: Math.max(expires, previous?.expires ?? 0) });
      return true;
    }
  };
}

// Shared by public and private observers; reserve a beacon only in builds that publish it.
export const celerityBudget = createCelerityBudget(import.meta.env.VITE_DOTIFY_ROOM_BEACONS === 'on' ? 512 : 0);
