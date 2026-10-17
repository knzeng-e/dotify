import { createHmac, randomBytes } from 'node:crypto';
import { exactKeys } from '../shared/nearby-v2.mjs';
import { publicCoverRef } from '../shared/public-cover.mjs';
import { clientKey, sanitizeTrack, snapshotPlayerState } from './signaling-utils.mjs';

// Artist-only snapshots. Private room codes, names, covers and participants
// never leave this process; only the aggregate includes link-only rooms.
export function createArtistRoomActivity({ rooms, nearby, contributions, maxListeners, trustProxy, now = Date.now }) {
  const networks = new Map();
  const secret = randomBytes(32);
  function allowed(socket) {
    for (const [key, value] of networks) if (value.until <= now()) networks.delete(key);
    const key = createHmac('sha256', secret).update(clientKey(socket, { trustProxy })).digest('hex');
    let value = networks.get(key);
    if (!value) {
      if (networks.size >= 2000) return false;
      value = { count: 0, until: now() + 60_000 };
      networks.set(key, value);
    }
    if (++value.count > 180 || now() - (socket.data.artistActivityAt ?? -Infinity) < 2000) return false;
    socket.data.artistActivityAt = now();
    return true;
  }
  return {
    register(socket) {
      socket.on('artist:rooms', async (payload, reply) => {
        if (typeof reply !== 'function') return;
        if (!exactKeys(payload, ['runtime', 'token']) || !allowed(socket) || socket.data.artistActivityPending) {
          reply({ ok: false, code: 'UNAVAILABLE' });
          return;
        }
        socket.data.artistActivityPending = true;
        try {
          const identity = await contributions.verifyArtistRuntime(payload.runtime, payload.token);
          const candidates = [...rooms].filter(([, room]) => room.hostId && room.track?.runtimeAddress?.toLowerCase() === identity.runtime);
          const releases = new Map();
          // Coalesced in the registry service, and bounded by maxRooms. A room
          // can claim a title but cannot claim another artist's registered work.
          await Promise.all(
            candidates.map(async ([, room]) => {
              const track = room.track;
              const result = await contributions.publicTrackStatus(track);
              if (result.status === 'unavailable') throw new Error('Release verification is unavailable.');
              if (result.status === 'verified' && result.release.artist?.toLowerCase() === identity.address) releases.set(track, result.release);
            })
          );
          // A cold registry lookup can outlive a short session. Re-use the
          // bounded verified cache or re-check before releasing aggregates.
          await contributions.verifyArtistRuntime(payload.runtime, payload.token);
          if (!socket.connected) return;
          let roomCount = 0;
          let connectedCount = 0;
          const publicRooms = [];
          for (const [roomId, room] of candidates) {
            const release = releases.get(room.track);
            if (!release || rooms.get(roomId) !== room || !room.hostId) continue;
            roomCount++;
            connectedCount += room.listeners.size + 1;
            const visibility = nearby.publicVisibility(roomId);
            if (!visibility || publicRooms.length >= 100) continue;
            publicRooms.push({
              roomId,
              hostName: room.hostName,
              hostConnected: true,
              createdAt: room.createdAt,
              listenerCount: room.listeners.size,
              isFull: room.listeners.size >= maxListeners,
              visibility,
              // Never copy the whole registry or host record: source and
              // manifest references must not travel with these invitations.
              track: sanitizeTrack({ ...room.track, title: release.title, artist: release.artistName, imageRef: publicCoverRef(release.imageRef) ?? '' }),
              playerState: snapshotPlayerState(room.playerState, room.playerStateReceivedAt)
            });
          }
          reply({ ok: true, roomCount, connectedCount, rooms: publicRooms, updatedAt: now() });
        } catch (error) {
          reply({ ok: false, code: error.code === 'SESSION_INVALID' ? 'SESSION_INVALID' : 'UNAVAILABLE' });
        } finally {
          socket.data.artistActivityPending = false;
        }
      });
    }
  };
}
