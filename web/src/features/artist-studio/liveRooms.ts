import type { CatalogTrack, OpenRoom } from '../../shared/types';

/** Match the complete release identity, never an artist name or a hash alone. */
export function artistLiveRooms(rooms: OpenRoom[], tracks: CatalogTrack[], runtime: string | null) {
  if (!runtime) return [];
  const byRelease = new Map(tracks.filter(track => track.active !== false).map(track => [track.id.toLowerCase(), track]));
  return rooms
    .flatMap(room => {
      if (room.discoverySource === 'statement-store' || room.track?.runtimeAddress?.toLowerCase() !== runtime.toLowerCase()) return [];
      const track = byRelease.get(`${runtime}:${room.track.hash}`.toLowerCase());
      return track ? [{ room, track }] : [];
    })
    .sort((a, b) => Number(Boolean(b.room.playerState?.playing)) - Number(Boolean(a.room.playerState?.playing)) || b.room.listenerCount - a.room.listenerCount);
}

export function liveRoomState(room: OpenRoom) {
  if (room.hostConnected === false) return 'Reconnecting';
  if (!room.playerState || room.playerState.stale) return 'Waiting for audio';
  return room.playerState.playing ? 'Playing' : 'Paused';
}
