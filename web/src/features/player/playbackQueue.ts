import type { CatalogTrack, RoomLineupItem } from '../../shared/types';
import { ROOM_LINEUP_CLIENT_LIMIT } from '../../shared/social';

export const ROOM_LINEUP_LIMIT = ROOM_LINEUP_CLIENT_LIMIT;
export const PREVIOUS_RESTART_SECONDS = 3;
const PLAYBACK_HISTORY_LIMIT = 100;

export function lineupItemFromTrack(track: CatalogTrack): RoomLineupItem {
  return {
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    imageRef: track.imageRef,
    hash: track.hash,
    accessMode: track.accessMode
  };
}

export function playableLineupTracks(lineup: readonly RoomLineupItem[], catalog: readonly CatalogTrack[]): CatalogTrack[] {
  const activeById = new Map(catalog.filter(track => track.active !== false).map(track => [track.id, track]));
  const seen = new Set<string>();
  const tracks: CatalogTrack[] = [];
  for (const item of lineup) {
    if (seen.has(item.trackId)) continue;
    const track = activeById.get(item.trackId);
    if (!track) continue;
    seen.add(item.trackId);
    tracks.push(track);
    if (tracks.length === ROOM_LINEUP_LIMIT) break;
  }
  return tracks;
}

export function recordPlaybackHistory(history: readonly string[], trackId: string): string[] {
  if (!trackId || history[history.length - 1] === trackId) return [...history];
  return [...history, trackId].slice(-PLAYBACK_HISTORY_LIMIT);
}

export type PreviousTrackDecision = { action: 'restart' } | { action: 'open'; trackId: string; history: string[] } | { action: 'catalog' };

export function previousTrackDecision(history: readonly string[], selectedTrackId: string, currentTime: number): PreviousTrackDecision {
  if (Number.isFinite(currentTime) && currentTime > PREVIOUS_RESTART_SECONDS) return { action: 'restart' };

  const normalized = recordPlaybackHistory(history, selectedTrackId);
  if (normalized.length < 2) return { action: 'catalog' };
  const previous = normalized[normalized.length - 2];
  return { action: 'open', trackId: previous, history: normalized.slice(0, -1) };
}
