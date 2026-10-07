import { useEffect } from 'react';
import type { CatalogTrack, TrackInfo } from '../../shared/types';
import type { RoomTrackEmitter } from '../rooms/roomRealtimePort';
import { runtimeAddressFromTrackId } from '../catalog/trackModel';
import { resolveRoomContributionTrack } from './roomContributionTrack';

/** Session-owned recovery continues while the host browses outside the player. */
export function useRoomContributionTrackRecovery({
  mode,
  roomId,
  socketStatus,
  tracks,
  catalogIsAuthoritative,
  trackInfo,
  setTrackInfo,
  socketEmit
}: {
  mode: 'host' | 'listener';
  roomId: string | null;
  socketStatus: string;
  tracks: CatalogTrack[];
  catalogIsAuthoritative: boolean;
  trackInfo: TrackInfo | null;
  setTrackInfo: (track: TrackInfo | null) => void;
  socketEmit: RoomTrackEmitter;
}) {
  useEffect(() => {
    if (!roomId || mode !== 'host' || socketStatus !== 'online' || !trackInfo) return;
    const resolution = resolveRoomContributionTrack(tracks, trackInfo, catalogIsAuthoritative);
    if (resolution.state !== 'recoverable') return;
    const runtimeAddress = runtimeAddressFromTrackId(resolution.track);
    if (!runtimeAddress) return;

    const repairedTrack = { ...trackInfo, runtimeAddress };
    setTrackInfo(repairedTrack);
    socketEmit('room:track', repairedTrack);
  }, [mode, roomId, socketStatus, tracks, catalogIsAuthoritative, trackInfo, setTrackInfo, socketEmit]);
}
