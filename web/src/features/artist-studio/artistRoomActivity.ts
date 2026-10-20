import type { OpenRoom } from '../../shared/types';
import { exactKeys } from '../../../shared/nearby-v2.mjs';
import { publicCoverRef } from '../../../shared/public-cover.mjs';

export type ArtistRoomInvitation = OpenRoom & { visibility: 'nearby' | 'worldwide' };
export type ArtistRoomActivitySnapshot = {
  ok: true;
  roomCount: number;
  connectedCount: number;
  rooms: ArtistRoomInvitation[];
  updatedAt: number;
};
export type ArtistRoomActivityReply = ArtistRoomActivitySnapshot | { ok: false; code: 'SESSION_INVALID' | 'UNAVAILABLE' };

export function isArtistRoomActivitySnapshot(value: unknown, runtime: string): value is ArtistRoomActivitySnapshot {
  if (!exactKeys(value, ['ok', 'roomCount', 'connectedCount', 'rooms', 'updatedAt'])) return false;
  const snapshot = value as ArtistRoomActivitySnapshot;
  return (
    snapshot.ok === true &&
    Number.isSafeInteger(snapshot.roomCount) &&
    snapshot.roomCount >= 0 &&
    snapshot.roomCount <= 2000 &&
    Number.isSafeInteger(snapshot.connectedCount) &&
    snapshot.connectedCount >= snapshot.roomCount &&
    snapshot.connectedCount <= snapshot.roomCount * 10001 &&
    Number.isFinite(snapshot.updatedAt) &&
    Array.isArray(snapshot.rooms) &&
    snapshot.rooms.length <= Math.min(100, snapshot.roomCount) &&
    new Set(snapshot.rooms.map(room => room?.roomId)).size === snapshot.rooms.length &&
    snapshot.rooms.every(
      room =>
        exactKeys(room, ['roomId', 'hostName', 'hostConnected', 'createdAt', 'listenerCount', 'isFull', 'visibility', 'track', 'playerState']) &&
        typeof room.roomId === 'string' &&
        /^[A-Z2-9]{6}$/.test(room.roomId) &&
        typeof room.hostName === 'string' &&
        room.hostName.length <= 32 &&
        room.hostConnected === true &&
        Number.isFinite(room.createdAt) &&
        typeof room.isFull === 'boolean' &&
        (room.visibility === 'nearby' || room.visibility === 'worldwide') &&
        Number.isSafeInteger(room.listenerCount) &&
        room.listenerCount >= 0 &&
        room.listenerCount <= 10000 &&
        typeof room.track?.runtimeAddress === 'string' &&
        room.track?.runtimeAddress?.toLowerCase() === runtime.toLowerCase() &&
        typeof room.track.hash === 'string' &&
        /^0x[0-9a-f]{64}$/i.test(room.track.hash) &&
        typeof room.track.title === 'string' &&
        room.track.title.length <= 120 &&
        typeof room.track.artist === 'string' &&
        room.track.artist.length <= 80 &&
        typeof room.track.imageRef === 'string' &&
        (room.track.imageRef === '' || publicCoverRef(room.track.imageRef) === room.track.imageRef) &&
        (room.playerState === null ||
          (typeof room.playerState === 'object' && !Array.isArray(room.playerState) && typeof room.playerState.playing === 'boolean'))
    )
  );
}
