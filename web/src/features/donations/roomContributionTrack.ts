import type { CatalogTrack, TrackInfo } from '../../shared/types';
import { runtimeAddressFromTrackId } from '../catalog/trackModel';

export type RoomContributionTrackResolution =
  | { state: 'ready'; track: CatalogTrack }
  | { state: 'recoverable'; track: CatalogTrack }
  | {
      state: 'unavailable';
      reason: 'missing-track' | 'catalog-unverified' | 'missing-catalog-release' | 'ambiguous-release' | 'runtime-mismatch';
    };

export type PlaybackContributionTrackResolution = Exclude<RoomContributionTrackResolution, { state: 'recoverable' }>;

function sameIdentity(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

/**
 * Resolve the live room work without guessing a beneficiary. A unique hash can
 * repair legacy room metadata, but only the host may publish that canonical
 * runtime back to the room before a contribution becomes executable.
 */
export function resolveRoomContributionTrack(
  tracks: CatalogTrack[],
  roomTrack: TrackInfo | null,
  catalogIsAuthoritative = false
): RoomContributionTrackResolution {
  if (!roomTrack?.hash) return { state: 'unavailable', reason: 'missing-track' };

  const matches = tracks.filter(track => track.active !== false && sameIdentity(track.hash, roomTrack.hash));

  if (roomTrack.runtimeAddress) {
    const exact = matches.find(track => sameIdentity(runtimeAddressFromTrackId(track) ?? undefined, roomTrack.runtimeAddress));
    return exact ? { state: 'ready', track: exact } : { state: 'unavailable', reason: 'runtime-mismatch' };
  }

  if (!catalogIsAuthoritative) return { state: 'unavailable', reason: 'catalog-unverified' };
  if (matches.length === 0) return { state: 'unavailable', reason: 'missing-catalog-release' };
  return matches.length === 1 ? { state: 'recoverable', track: matches[0] } : { state: 'unavailable', reason: 'ambiguous-release' };
}

/**
 * Resolve a contribution target for local playback. Product hosts can retain a
 * valid TrackInfo snapshot while a catalog refresh replaces the selected id,
 * so exact id lookup is preferred but is not the only safe identity path.
 */
export function resolvePlaybackContributionTrack(
  tracks: CatalogTrack[],
  selectedTrackId: string,
  currentTrack: TrackInfo | null,
  catalogIsAuthoritative = false
): PlaybackContributionTrackResolution {
  const selectedTrack = tracks.find(track => track.id === selectedTrackId);
  if (selectedTrack) return { state: 'ready', track: selectedTrack };

  const resolution = resolveRoomContributionTrack(tracks, currentTrack, catalogIsAuthoritative);
  if (resolution.state === 'recoverable') return { state: 'ready', track: resolution.track };
  return resolution;
}
