import type { AccessMode, CatalogTrack, Mode, SocketStatus, TrackInfo } from '../../shared/types';
import { playbackStatusLabel, type AudioStatus } from './playbackStatus';
import { runtimeAddressFromTrackId } from '../catalog/trackModel';

/** Public discovery only: never use this enrichment as an access/payment decision. */
export function roomReleaseDetails(roomTrack: TrackInfo | null, tracks: CatalogTrack[]): CatalogTrack | TrackInfo | null {
  if (!roomTrack?.title.trim()) return null;
  const matches = roomTrack.hash
    ? tracks.filter(
        track =>
          track.hash.toLowerCase() === roomTrack.hash.toLowerCase() &&
          (!roomTrack.runtimeAddress || runtimeAddressFromTrackId(track)?.toLowerCase() === roomTrack.runtimeAddress.toLowerCase())
      )
    : [];
  if (matches.length === 1) return matches[0];
  // An unknown/ambiguous room release still has a useful snapshot. Do not
  // borrow another selection or follow an arbitrary host-provided HTTP URL.
  return {
    title: roomTrack.title,
    artist: roomTrack.artist,
    duration: roomTrack.duration,
    updatedAt: roomTrack.updatedAt,
    imageRef: roomTrack.imageRef,
    hash: roomTrack.hash,
    runtimeAddress: roomTrack.runtimeAddress,
    bulletinRef: roomTrack.bulletinRef,
    description: roomTrack.description,
    accessMode: roomTrack.accessMode,
    priceDot: roomTrack.priceDot,
    personhoodLevel: roomTrack.personhoodLevel,
    metadataRef: /^ipfs:\/\/[A-Za-z0-9]+(?:\/(?:release|metadata)\.json)?$/.test(roomTrack.metadataRef ?? '') ? roomTrack.metadataRef : undefined
  };
}

/** Room metadata is a complete snapshot, never a patch over a solo selection. */
export function playbackTrack(mode: Mode, trackInfo: TrackInfo | null, selectedTrack: CatalogTrack | undefined) {
  // Leaving a room restores the local transport before its last remote
  // metadata is cleared. The local selection must own that transition too.
  return mode === 'listener' ? trackInfo : (selectedTrack ?? trackInfo);
}

export function playbackTrackDetails(
  mode: Mode,
  trackInfo: TrackInfo | null,
  selectedTrack: CatalogTrack | undefined,
  draft: { accessMode: AccessMode; priceDot: string }
) {
  const track = playbackTrack(mode, trackInfo, selectedTrack);
  return {
    accessMode: track?.accessMode ?? draft.accessMode,
    priceDot: track?.priceDot ?? draft.priceDot,
    description: track?.description
  };
}

export function roomPlaybackPresentation(mode: Mode, status: AudioStatus, socketStatus: SocketStatus) {
  const role = mode === 'host' ? 'Hosting' : 'Room';
  if (socketStatus !== 'online') return { label: `${role} · Reconnecting`, live: false };
  if (status === 'playing') return { label: mode === 'host' ? 'Hosting live' : 'Room live', live: true };
  const detail = playbackStatusLabel(status, mode);
  return { label: detail && detail !== 'Hosting' ? `${role} · ${detail}` : role, live: false };
}
