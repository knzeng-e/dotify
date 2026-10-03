import type { CatalogTrack, TrackInfo } from '../../shared/types';
import { runtimeAddressFromTrackId } from '../catalog/trackModel';

export type RoomContributionTrackResolution =
  | { state: 'ready'; track: CatalogTrack }
  | { state: 'recoverable'; track: CatalogTrack }
  | {
      state: 'unavailable';
      reason: 'missing-track' | 'catalog-unverified' | 'missing-catalog-release' | 'ambiguous-release' | 'runtime-mismatch';
    };

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
