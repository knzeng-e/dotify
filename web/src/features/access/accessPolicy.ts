// Access policy - pure track-access predicates.
//
// A track is "policy-managed" when it is an artist-published track that carries
// a runtime-qualified id (`<runtime>:<hash>`); those sit behind an on-chain
// access policy. Free/local tracks (no runtime id) are always playable in full.
// These helpers centralize the predicate that was previously duplicated across
// App.tsx, useCatalog.ts, and PlayerView.tsx.

import type { CatalogTrack, RoomPlaybackMode } from '../../shared/types';

/** True when the track sits behind an artist runtime access policy. */
export function isPolicyManagedTrack(track: Pick<CatalogTrack, 'source' | 'id'>): boolean {
  return track.source === 'artist' && track.id.includes(':');
}

/**
 * Whether the given access map grants this track to the current listener.
 * Non-policy-managed tracks are always granted; policy-managed tracks require
 * an explicit `true` entry in the access map.
 */
export function trackHasAccess(track: Pick<CatalogTrack, 'source' | 'id'>, accessByTrackId: Record<string, boolean>): boolean {
  if (!isPolicyManagedTrack(track)) return true;
  return accessByTrackId[track.id] === true;
}

/** Whether the listener should be shown the preview/unlock affordance. */
export function trackNeedsAccess(track: Pick<CatalogTrack, 'source' | 'id'>, hasAccess: boolean): boolean {
  return isPolicyManagedTrack(track) && !hasAccess;
}

/** Honest playback mode for a given access decision. */
export function playbackModeForAccess(hasAccess: boolean): RoomPlaybackMode {
  return hasAccess ? 'full' : 'preview';
}
