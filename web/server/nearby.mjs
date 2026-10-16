import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import {
  exactKeys,
  validDiscoverySearch,
  nearbyDistanceBand,
  validNearbyArea,
  validWorldwideArea,
  nearbyAreasMatch,
  nearbyBucket,
  NEARBY_MAX_RESULTS,
  NEARBY_TTL_MS
} from '../shared/nearby-v2.mjs';
import { clientKey } from './signaling-utils.mjs';

// No payloads go to logs, publicRoom, /status, analytics or durable stores.
export function createNearby({ enabled, rooms, trustProxy, maxListeners, now = Date.now }) {
  const presence = new Map();
  const budgets = new Map();
  const secret = randomBytes(32);
  const totals = { searches: 0, publications: 0, reports: 0, throttled: 0 };
  const fail = code => ({ ok: false, code });
  function prune() {
    const time = now();
    for (const [id, value] of presence) if (value.expiresAt <= time || !rooms.get(id)?.hostId) presence.delete(id);
    for (const [id, value] of budgets) if (value.until <= time) budgets.delete(id);
  }
  function allowed(socket, kind, limit) {
    prune();
    // Short-lived keyed hashes resist reconnect churn without retaining raw IPs.
    const network = createHmac('sha256', secret).update(clientKey(socket, { trustProxy })).digest('hex');
    const keys = [`${kind}:s:${socket.id}`, `${kind}:n:${network}`];
    for (const key of keys) {
      let value = budgets.get(key);
      if (!value) {
        if (budgets.size >= 20_000) return false;
        value = { count: 0, until: now() + 60_000 };
        budgets.set(key, value);
      }
      if (++value.count > (key.includes(':n:') ? limit * 10 : limit)) {
        totals.throttled++;
        return false;
      }
    }
    return true;
  }
  function hostRoom(socket) {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    return socket.data.role === 'host' && room?.hostId === socket.id ? roomId : null;
  }
  return {
    prune,
    remove: roomId => presence.delete(roomId),
    diagnostics: () => ({ ...totals }),
    register(socket) {
      const handler = (event, action) =>
        socket.on(event, (payload, ack) => {
          if (typeof ack !== 'function') return;
          if (!enabled) {
            ack(fail('DISABLED'));
            return;
          }
          ack(action(payload));
        });
      handler('nearby:publish', payload => {
        if (!allowed(socket, 'publish', 12)) return fail('RATE_LIMITED');
        const roomId = hostRoom(socket);
        if (!roomId) return fail('HOST_REQUIRED');
        if (!validNearbyArea(payload) && !validWorldwideArea(payload)) return fail('INVALID_AREA');
        if (!presence.has(roomId) && presence.size >= 10_000) return fail('BUSY');
        const old = presence.get(roomId);
        const rotate =
          !old || old.worldwide !== payload.worldwide || old.cell !== payload.cell || old.radiusKm !== payload.radiusKm || now() - old.rotatedAt >= 900_000;
        const record = {
          ...payload,
          discoveryId: rotate ? randomUUID() : old.discoveryId,
          rotatedAt: rotate ? now() : old.rotatedAt,
          expiresAt: now() + NEARBY_TTL_MS
        };
        presence.set(roomId, record);
        totals.publications++;
        return { ok: true, expiresInMs: NEARBY_TTL_MS };
      });
      // Revocation is never rate limited; no stale payload can target another room.
      handler('nearby:off', payload => {
        if (!exactKeys(payload, [])) return fail('INVALID_AREA');
        const roomId = hostRoom(socket);
        if (roomId) presence.delete(roomId);
        return { ok: true };
      });
      handler('nearby:search', payload => {
        if (!allowed(socket, payload?.worldwide === true ? 'worldwide-search' : 'search', 6)) return fail('RATE_LIMITED');
        if (!validDiscoverySearch(payload)) return fail('INVALID_AREA');
        const area = { ...payload, schemaVersion: 2 };
        totals.searches++;
        const results = [];
        // Stable per-lease ordering, never distance ordering; no cells in replies.
        for (const [roomId, item] of [...presence].sort((a, b) => a[1].discoveryId.localeCompare(b[1].discoveryId))) {
          const room = rooms.get(roomId);
          if (!room?.hostId) continue;
          if (
            validWorldwideArea(area)
              ? !item.worldwide
              : item.worldwide || !nearbyAreasMatch({ schemaVersion: 2, cell: item.cell, radiusKm: item.radiusKm }, area)
          )
            continue;
          results.push({
            roomId,
            discoveryId: item.discoveryId,
            expiresInMs: Math.max(0, item.expiresAt - now()),
            hostName: room.hostName,
            title: room.track?.title ?? 'Listening room',
            artist: room.track?.artist ?? '',
            presence: nearbyBucket(room.listeners.size + 1),
            isFull: room.listeners.size >= maxListeners,
            ...(payload.schemaVersion === 3 ? { distanceBand: item.worldwide ? null : nearbyDistanceBand(item.cell, area.cell) } : {})
          });
          if (results.length === NEARBY_MAX_RESULTS) break;
        }
        return { ok: true, schemaVersion: payload.schemaVersion, expiresInMs: 45_000, results };
      });
      handler('nearby:report', payload => {
        if (!allowed(socket, 'report', 3)) return fail('RATE_LIMITED');
        if (
          !exactKeys(payload, ['discoveryId', 'reason']) ||
          typeof payload.discoveryId !== 'string' ||
          payload.discoveryId.length > 40 ||
          !['unwanted', 'misleading', 'offensive'].includes(payload.reason)
        )
          return fail('INVALID_REPORT');
        if (![...presence.values()].some(item => item.discoveryId === payload.discoveryId)) return fail('EXPIRED');
        // Aggregate safety signal only. Never promise a staffed moderation inbox.
        totals.reports++;
        return { ok: true };
      });
    }
  };
}
