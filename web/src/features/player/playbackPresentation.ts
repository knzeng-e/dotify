import type { CatalogTrack, Mode, SocketStatus, TrackInfo } from '../../shared/types';
import { playbackStatusLabel, type AudioStatus } from './playbackStatus';

/** Room metadata is a complete snapshot, never a patch over a solo selection. */
export function playbackTrack(mode: Mode, trackInfo: TrackInfo | null, selectedTrack: CatalogTrack | undefined) {
  // Leaving a room restores the local transport before its last remote
  // metadata is cleared. The local selection must own that transition too.
  return mode === 'listener' ? trackInfo : (selectedTrack ?? trackInfo);
}

export function roomPlaybackPresentation(mode: Mode, status: AudioStatus, socketStatus: SocketStatus) {
  const role = mode === 'host' ? 'Hosting' : 'Room';
  if (socketStatus !== 'online') return { label: `${role} · Reconnecting`, live: false };
  if (status === 'playing') return { label: mode === 'host' ? 'Hosting live' : 'Room live', live: true };
  const detail = playbackStatusLabel(status, mode);
  return { label: detail && detail !== 'Hosting' ? `${role} · ${detail}` : role, live: false };
}
