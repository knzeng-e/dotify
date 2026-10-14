import type { NearbyArea } from '../../../shared/nearby-v2.mjs';
import { exactKeys, NEARBY_MAX_RESULTS, NEARBY_TTL_MS } from '../../../shared/nearby-v2.mjs';
export type { NearbyArea };
export type NearbyResult = {
  roomId: string;
  discoveryId: string;
  expiresInMs: number;
  hostName: string;
  title: string;
  artist: string;
  presence: string;
  isFull: boolean;
};
export type NearbyReply = { ok: false; code: string } | { ok: true; expiresInMs?: number };
export type NearbySearchReply = { ok: false; code: string } | { ok: true; schemaVersion: 2; expiresInMs: number; results: NearbyResult[] };

export function safeNearbyReply(reply: unknown, host: boolean): reply is NearbyReply | NearbySearchReply {
  if (!reply || typeof reply !== 'object') return false;
  const value = reply as Record<string, unknown>;
  if (value.ok === false) return exactKeys(value, ['ok', 'code']) && typeof value.code === 'string' && value.code.length < 40;
  const expiry = (ms: unknown) => typeof ms === 'number' && Number.isFinite(ms) && ms > 0 && ms <= NEARBY_TTL_MS;
  if (host) return exactKeys(value, ['ok', 'expiresInMs']) && value.ok === true && expiry(value.expiresInMs);
  if (
    !exactKeys(value, ['ok', 'schemaVersion', 'expiresInMs', 'results']) ||
    value.ok !== true ||
    value.schemaVersion !== 2 ||
    !expiry(value.expiresInMs) ||
    !Array.isArray(value.results) ||
    value.results.length > NEARBY_MAX_RESULTS
  )
    return false;
  return value.results.every(
    (item: NearbyResult) =>
      exactKeys(item, ['roomId', 'discoveryId', 'expiresInMs', 'hostName', 'title', 'artist', 'presence', 'isFull']) &&
      typeof item.roomId === 'string' &&
      /^[A-Z2-9]{6}$/.test(item.roomId) &&
      typeof item.discoveryId === 'string' &&
      /^[a-f0-9-]{36}$/.test(item.discoveryId) &&
      expiry(item.expiresInMs) &&
      typeof item.hostName === 'string' &&
      item.hostName.length <= 32 &&
      typeof item.title === 'string' &&
      item.title.length <= 160 &&
      typeof item.artist === 'string' &&
      item.artist.length <= 160 &&
      ['0', '1–3', '4–9', '10+'].includes(item.presence) &&
      typeof item.isFull === 'boolean'
  );
}
