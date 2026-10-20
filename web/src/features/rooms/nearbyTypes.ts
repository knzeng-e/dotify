import { publicCoverRef } from '../../../shared/public-cover.mjs';
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
  distanceBand?: string | null;
  /** Connected listeners, excluding the host. Only v4 exposes exact counts. */
  listenerCount?: number;
  imageRef?: string | null;
  roomName?: string;
  introduction?: string;
  artistPresent?: boolean;
  connection?: 'online' | 'reconnecting';
};
export type NearbyReply = { ok: false; code: string } | { ok: true; expiresInMs?: number };
export type NearbySearchReply =
  | { ok: false; code: string }
  | { ok: true; schemaVersion: 2 | 3 | 4 | 5; sequence?: number; expiresInMs: number; results: NearbyResult[] };

export function safeNearbyReply(reply: unknown, host: boolean): reply is NearbyReply | NearbySearchReply {
  if (!reply || typeof reply !== 'object') return false;
  const value = reply as Record<string, unknown>;
  if (value.ok === false) return exactKeys(value, ['ok', 'code']) && typeof value.code === 'string' && value.code.length < 40;
  const expiry = (ms: unknown) => typeof ms === 'number' && Number.isFinite(ms) && ms > 0 && ms <= NEARBY_TTL_MS;
  if (host) return exactKeys(value, ['ok', 'expiresInMs']) && value.ok === true && expiry(value.expiresInMs);
  if (
    !exactKeys(value, ['ok', 'schemaVersion', 'expiresInMs', 'results', ...(value.schemaVersion === 5 ? ['sequence'] : [])]) ||
    value.ok !== true ||
    ![2, 3, 4, 5].includes(value.schemaVersion as number) ||
    (value.schemaVersion === 5 && (!Number.isSafeInteger(value.sequence) || Number(value.sequence) < 1)) ||
    !expiry(value.expiresInMs) ||
    !Array.isArray(value.results) ||
    value.results.length > NEARBY_MAX_RESULTS
  )
    return false;
  return value.results.every(
    (item: NearbyResult) =>
      exactKeys(item, [
        'roomId',
        'discoveryId',
        'expiresInMs',
        'hostName',
        'title',
        'artist',
        'presence',
        'isFull',
        ...(value.schemaVersion !== 2 ? ['distanceBand'] : []),
        ...(Number(value.schemaVersion) >= 4 ? ['listenerCount', 'imageRef'] : []),
        ...(value.schemaVersion === 5 ? ['roomName', 'introduction', 'artistPresent', 'connection'] : [])
      ]) &&
      (value.schemaVersion === 2 ||
        item.distanceBand === null ||
        (typeof item.distanceBand === 'string' && /^(0–5|5–10|10–15|15–20|20–25|25–30|30–35|35–40|40–45) km$/.test(item.distanceBand))) &&
      (Number(value.schemaVersion) < 4 ||
        (Number.isSafeInteger(item.listenerCount) &&
          item.listenerCount! >= 0 &&
          item.listenerCount! <= 10000 &&
          (item.imageRef === null || (typeof item.imageRef === 'string' && publicCoverRef(item.imageRef) === item.imageRef)))) &&
      (value.schemaVersion !== 5 ||
        (typeof item.roomName === 'string' &&
          item.roomName.length <= 60 &&
          typeof item.introduction === 'string' &&
          item.introduction.length <= 240 &&
          typeof item.artistPresent === 'boolean' &&
          ['online', 'reconnecting'].includes(item.connection ?? ''))) &&
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
