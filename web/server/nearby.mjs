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
import { publicCoverRef } from '../shared/public-cover.mjs';
import { clientKey } from './signaling-utils.mjs';
import { sameRoomTrack } from './room-track.mjs';
import { announcedArtistPresent } from './room-profile.mjs';

// No payloads go to logs, publicRoom, /status, analytics or durable stores.
export function createNearby({ enabled, rooms, trustProxy, maxListeners, getPublicTrack = async () => null, now = Date.now }) {
  const presence = new Map();
  const watches = new Map(); // socket -> at most two short-lived search areas
  const published = new Map(); // public state only, used to ignore private/no-op activity
  const invalidated = new Map(); // room -> old/new areas affected during this batch
  const pending = new Set(); // watches changed while their previous read was in flight
  let timer;
  let closed = false;
  const WATCH_MS = 45_000;
  const GRACE_MS = 8000;
  const queryKey = area => (area.worldwide ? 'worldwide' : `${area.cell}:${area.radiusKm}`);
  function matches(item, area) {
    return (
      item &&
      (area.worldwide === true
        ? item.worldwide === true
        : !item.worldwide &&
          nearbyAreasMatch({ schemaVersion: 2, cell: item.cell, radiusKm: item.radiusKm }, { schemaVersion: 2, cell: area.cell, radiusKm: area.radiusKm }))
    );
  }
  function changed(roomId) {
    const previous = published.get(roomId);
    const lease = presence.get(roomId);
    const room = rooms.get(roomId);
    const current =
      lease && room
        ? {
            area: { ...lease },
            fingerprint: JSON.stringify([
              lease.discoveryId,
              lease.expiresAt,
              Boolean(room.hostId),
              room.hostName,
              room.track?.runtimeAddress,
              room.track?.hash,
              room.track?.title,
              room.track?.artist,
              room.listeners.size,
              room.profile,
              announcedArtistPresent(room)
            ])
          }
        : undefined;
    if (current?.fingerprint === previous?.fingerprint) return;
    if (current) published.set(roomId, current);
    else published.delete(roomId);
    if (closed || !watches.size) return;
    const areas = invalidated.get(roomId) ?? new Map();
    if (previous) areas.set(queryKey(previous.area), previous.area);
    if (current) areas.set(queryKey(current.area), current.area);
    invalidated.set(roomId, areas);
    schedule();
  }
  function schedule() {
    if (closed || timer || !watches.size) return;
    timer = setTimeout(() => {
      timer = undefined;
      prune();
      const areas = [...invalidated.values()].flatMap(areas => [...areas.values()]);
      invalidated.clear();
      // One result computation/enrichment per distinct query in this batch,
      // rather than one full presence scan for every watching socket.
      const snapshots = new Map();
      for (const [socket, entries] of watches)
        for (const watch of entries.values()) {
          if (!pending.has(watch) && !areas.some(area => matches(area, watch.area))) continue;
          pending.delete(watch);
          void push(socket, watch, snapshots);
        }
    }, 200);
    timer.unref?.();
  }
  async function push(socket, watch, snapshots) {
    if (watch.busy) {
      watch.dirty = true;
      return;
    }
    watch.busy = true;
    const sequence = watch.sequence + 1;
    try {
      const key = queryKey(watch.area);
      if (!snapshots.has(key)) snapshots.set(key, search(watch.area));
      const snapshot = await snapshots.get(key);
      const remaining = Math.max(0, watch.expiresAt - now());
      const reply = {
        ...snapshot,
        sequence,
        expiresInMs: remaining,
        results: snapshot.results
          .map(item => ({
            ...item,
            expiresInMs: Math.max(0, Math.min(presence.get(item.roomId)?.expiresAt ?? 0, watch.expiresAt) - now())
          }))
          .filter(item => item.expiresInMs > 0)
      };
      const fingerprint = signature(reply, watch);
      if (
        !closed &&
        socket.connected &&
        watches.get(socket)?.get(watch.area.watchId) === watch &&
        watch.expiresAt > now() &&
        fingerprint !== watch.fingerprint
      ) {
        watch.fingerprint = fingerprint;
        watch.sequence = sequence;
        socket.emit('nearby:updated', { watchId: watch.area.watchId, reply });
      }
    } catch {
      // Keep the last bounded snapshot. A failed enrichment never widens scope.
    } finally {
      watch.busy = false;
      if (watch.dirty && watches.get(socket)?.get(watch.area.watchId) === watch) {
        watch.dirty = false;
        pending.add(watch);
        schedule();
      }
    }
  }
  function signature(reply, watch) {
    // Unrelated/private room activity must not generate observable empty pushes
    // or sequence gaps. Compare public fields and absolute lease deadlines.
    return JSON.stringify(
      reply.results.map(({ expiresInMs: _ttl, ...item }) => ({ ...item, deadline: Math.min(presence.get(item.roomId)?.expiresAt ?? 0, watch.expiresAt) }))
    );
  }
  const budgets = new Map();
  const secret = randomBytes(32);
  const totals = { searches: 0, publications: 0, reports: 0, throttled: 0 };
  const fail = code => ({ ok: false, code });
  function prune() {
    const time = now();
    for (const [id, value] of presence)
      if (value.expiresAt <= time || !rooms.has(id)) {
        presence.delete(id);
        changed(id);
      }
    for (const [socket, entries] of watches) {
      for (const [id, watch] of entries)
        if (watch.expiresAt <= time || socket.connected === false) {
          pending.delete(watch);
          entries.delete(id);
        }
      if (!entries.size) watches.delete(socket);
    }
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
  async function artwork(track) {
    let timer;
    try {
      // Discovery must remain usable when the registry is slow. The shared
      // metadata promise continues warming its cache for the following scan.
      return await Promise.race([
        getPublicTrack(track).catch(() => null),
        new Promise(resolve => {
          timer = setTimeout(() => resolve(null), 300);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  function search(payload, watch, sequence) {
    const { watchId: _id, ...searchArea } = payload;
    const area = { ...searchArea, schemaVersion: 2 };
    const results = [];
    // Stable per-lease ordering, never distance ordering; no cells in replies.
    for (const [roomId, item] of [...presence].sort((a, b) => a[1].discoveryId.localeCompare(b[1].discoveryId))) {
      const room = rooms.get(roomId);
      if (!room || (!room.hostId && payload.schemaVersion !== 5)) continue;
      if (
        validWorldwideArea(area) ? !item.worldwide : item.worldwide || !nearbyAreasMatch({ schemaVersion: 2, cell: item.cell, radiusKm: item.radiusKm }, area)
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
        ...(payload.schemaVersion >= 3 ? { distanceBand: item.worldwide ? null : nearbyDistanceBand(item.cell, area.cell) } : {})
      });
      if (results.length === NEARBY_MAX_RESULTS) break;
    }
    if (payload.schemaVersion >= 4) {
      return Promise.all(
        results.map(async result => {
          const room = rooms.get(result.roomId);
          const track = room?.track;
          const release = await artwork(track);
          prune();
          const lease = presence.get(result.roomId);
          // Do not finish an asynchronous read after revocation/track change.
          if (
            !room ||
            (!room.hostId && payload.schemaVersion !== 5) ||
            rooms.get(result.roomId) !== room ||
            (room.track !== track && !sameRoomTrack(room.track, track)) ||
            lease?.discoveryId !== result.discoveryId
          )
            return null;
          return {
            ...result,
            expiresInMs: Math.max(0, Math.min(lease.expiresAt, watch?.expiresAt ?? Infinity) - now()),
            title: release?.title?.slice(0, 160) || result.title,
            artist: release?.artistName?.slice(0, 160) || result.artist,
            listenerCount: room.listeners.size,
            isFull: room.listeners.size >= maxListeners,
            imageRef: publicCoverRef(release?.imageRef),
            ...(payload.schemaVersion === 5
              ? {
                  roomName: room.profile?.name ?? '',
                  introduction: room.profile?.introduction ?? '',
                  artistPresent: announcedArtistPresent(room),
                  connection: room.hostId ? 'online' : 'reconnecting'
                }
              : {})
          };
        })
      ).then(hydrated => ({
        ok: true,
        schemaVersion: payload.schemaVersion,
        expiresInMs: Math.max(0, Math.min(WATCH_MS, (watch?.expiresAt ?? Infinity) - now())),
        results: hydrated.filter(item => item && item.expiresInMs > 0),
        ...(watch ? { sequence } : {})
      }));
    }
    return { ok: true, schemaVersion: payload.schemaVersion, expiresInMs: 45_000, results };
  }
  return {
    prune,
    changed,
    remove(roomId) {
      if (presence.delete(roomId)) changed(roomId);
    },
    touch(roomId) {
      const record = presence.get(roomId);
      if (record?.hold && record.expiresAt > now() && rooms.get(roomId)?.hostId) {
        record.expiresAt = now() + NEARBY_TTL_MS;
        changed(roomId);
      }
    },
    disconnected(roomId) {
      const record = presence.get(roomId);
      if (record) {
        record.expiresAt = Math.min(record.expiresAt, now() + GRACE_MS);
        changed(roomId);
      }
    },
    resumed(roomId) {
      const record = presence.get(roomId);
      if (record && record.expiresAt > now()) {
        record.expiresAt = now() + NEARBY_TTL_MS;
        changed(roomId);
      }
    },
    close() {
      closed = true;
      clearTimeout(timer);
      watches.clear();
      presence.clear();
      published.clear();
      invalidated.clear();
      pending.clear();
    },
    diagnostics: () => ({ ...totals }),
    publicVisibility(roomId) {
      prune();
      const item = enabled && presence.get(roomId);
      return item ? (item.worldwide ? 'worldwide' : 'nearby') : null;
    },
    register(socket) {
      const handler = (event, action) =>
        socket.on(event, (payload, ack) => {
          if (typeof ack !== 'function') return;
          if (!enabled) {
            ack(fail('DISABLED'));
            return;
          }
          const result = action(payload);
          if (result?.then) result.then(ack, () => ack(fail('UNAVAILABLE')));
          else ack(result);
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
        // Warm the canonical cover while the host opens visibility, without
        // putting registry latency on the publication acknowledgement.
        void getPublicTrack(rooms.get(roomId)?.track).catch(() => null);
        totals.publications++;
        changed(roomId);
        return { ok: true, expiresInMs: NEARBY_TTL_MS };
      });
      // Revocation is never rate limited; no stale payload can target another room.
      handler('nearby:off', payload => {
        if (!exactKeys(payload, [])) return fail('INVALID_AREA');
        const roomId = hostRoom(socket);
        if (roomId && presence.delete(roomId)) changed(roomId);
        return { ok: true };
      });
      handler('nearby:hold', payload => {
        if (!exactKeys(payload, [])) return fail('INVALID_AREA');
        prune();
        const record = presence.get(hostRoom(socket));
        if (!record) return fail('HOST_REQUIRED');
        record.hold = true;
        return { ok: true, expiresInMs: Math.max(0, record.expiresAt - now()) };
      });
      socket.on('nearby:unwatch', payload => {
        if (!exactKeys(payload, ['watchId']) || typeof payload.watchId !== 'string') return;
        const entries = watches.get(socket);
        pending.delete(entries?.get(payload.watchId));
        entries?.delete(payload.watchId);
        if (!entries?.size) watches.delete(socket);
      });
      socket.on('disconnect', () => {
        for (const watch of watches.get(socket)?.values() ?? []) pending.delete(watch);
        watches.delete(socket);
      });
      handler('nearby:search', payload => {
        if (!allowed(socket, payload?.worldwide === true ? 'worldwide-search' : 'search', 6)) return fail('RATE_LIMITED');
        if (!validDiscoverySearch(payload)) return fail('INVALID_AREA');
        totals.searches++;
        if (payload.schemaVersion !== 5) return search(payload);
        let entries = watches.get(socket);
        if (!entries) {
          if (watches.size >= 2000) return fail('BUSY');
          entries = new Map();
          watches.set(socket, entries);
        }
        // One watch per mode; a changed query invalidates older async responses.
        for (const [id, old] of entries)
          if (old.area.worldwide === payload.worldwide && id !== payload.watchId) {
            pending.delete(old);
            entries.delete(id);
          }
        const previous = entries.get(payload.watchId);
        pending.delete(previous);
        const watch = { area: payload, expiresAt: now() + WATCH_MS, sequence: (previous?.sequence ?? 0) + 1, busy: true };
        entries.set(payload.watchId, watch);
        return search(payload, watch, watch.sequence)
          .then(reply => {
            watch.fingerprint = signature(reply, watch);
            return reply;
          })
          .finally(() => {
            watch.busy = false;
            if (watch.dirty && watches.get(socket)?.get(watch.area.watchId) === watch) {
              watch.dirty = false;
              pending.add(watch);
              schedule();
            }
          });
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
