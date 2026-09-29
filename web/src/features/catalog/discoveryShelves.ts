import type { CatalogTrack } from '../../shared/types';

export function rememberRecentPlay(history: string[], id: string): string[] {
  if (!id || history[0] === id) return history;
  return [id, ...history.filter(previous => previous !== id)].slice(0, 12);
}

export function recentListeningTracks<T extends Pick<CatalogTrack, 'id' | 'active'>>(tracks: readonly T[], history: readonly string[]): T[] {
  const byId = new Map(tracks.filter(track => track.active !== false).map(track => [track.id, track]));
  return [...new Set(history)].flatMap(id => {
    const track = byId.get(id);
    return track ? [track] : [];
  });
}

export function hasReleaseChronology(tracks: readonly Pick<CatalogTrack, 'source' | 'registeredAtBlock'>[]): boolean {
  return tracks.length > 0 && tracks.every(track => track.source === 'artist' && Number.isSafeInteger(track.registeredAtBlock) && track.registeredAtBlock! > 0);
}
