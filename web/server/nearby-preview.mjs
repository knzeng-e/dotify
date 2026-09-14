import { randomUUID } from 'node:crypto';
import { createWindowLimiter } from './signaling-utils.mjs';

// A bounded manual-area feasibility slice of W18. No geolocation API, arbitrary
// cell queries, public location beacon, persistent store, or coordinate fields.
// These broad pilot areas are choices, never evidence of a device's position.
export const NEARBY_PILOT_AREAS = [
  { id: 'lisbon-region', label: 'Lisbon region' },
  { id: 'paris-region', label: 'Paris region' },
  { id: 'london-region', label: 'London region' }
];
const TTL_MS = 90_000;
const RESULT_TTL_MS = 30_000;
const areaIds = new Set(NEARBY_PILOT_AREAS.map(area => area.id));
function validConsent(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2 && value.consent === true && areaIds.has(value.areaId);
}
function countBucket(count) {
  return count <= 0 ? '0' : count < 4 ? '1-3' : count < 10 ? '4-9' : '10+';
}

export function createNearbyPreview({ enabled = false, now = Date.now, ttlMs = TTL_MS, rotationMs = 15 * 60_000 } = {}) {
  const records = new Map();
  const queryLimiter = createWindowLimiter(6, 60_000);
  const publishLimiter = createWindowLimiter(6, 60_000);
  return {
    areas() {
      return enabled ? NEARBY_PILOT_AREAS : [];
    },
    publish(roomId, payload) {
      if (!enabled || !validConsent(payload)) return { ok: false, message: 'Choose an available area and explicitly share this room.' };
      if (!publishLimiter.allow(roomId, now())) return { ok: false, message: 'Please wait a moment before sharing again.' };
      const previous = records.get(roomId);
      const keepId = previous && previous.expiresAt > now() && previous.areaId === payload.areaId && now() - previous.rotatedAt < rotationMs;
      const record = {
        areaId: payload.areaId,
        discoveryId: keepId ? previous.discoveryId : randomUUID(),
        rotatedAt: keepId ? previous.rotatedAt : now(),
        expiresAt: now() + ttlMs
      };
      records.set(roomId, record);
      return { ok: true, areaId: record.areaId, expiresAt: record.expiresAt };
    },
    revoke(roomId) {
      records.delete(roomId);
    },
    forget(roomId) {
      records.delete(roomId);
      publishLimiter.clear(roomId);
    },
    search(key, payload, publicRooms) {
      if (!enabled || !validConsent(payload)) return { ok: false, message: 'Choose an available area to search.' };
      if (!queryLimiter.allow(key, now())) return { ok: false, message: 'Please wait a minute before searching again.' };
      const results = [];
      for (const room of publicRooms) {
        const record = records.get(room.roomId);
        if (!record || record.expiresAt <= now() || record.areaId !== payload.areaId) continue;
        results.push({
          discoveryId: record.discoveryId,
          roomId: room.roomId,
          title: room.track?.title || 'Shared listening',
          artist: room.track?.artist || '',
          listenerCountBucket: countBucket(room.listenerCount),
          expiresAt: record.expiresAt
        });
        if (results.length === 20) break;
      }
      return {
        ok: true,
        results,
        expiresAt: Math.min(now() + RESULT_TTL_MS, ...results.map(room => room.expiresAt)),
        resultBucket: countBucket(results.length)
      };
    },
    sweep() {
      for (const [id, record] of records) if (record.expiresAt <= now()) records.delete(id);
      queryLimiter.prune(now());
      publishLimiter.prune(now());
    }
  };
}
