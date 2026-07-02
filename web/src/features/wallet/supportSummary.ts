// Support summary - the "artists backed / tracks unlocked" rollup shown in the
// wallet modal and the account view. Pure: derived from the catalog and the
// per-track paid-access map, no DOM or chain deps. Previously computed inline in
// App.tsx; extracted so the listener shell and the artist shell share one source.

import type { CatalogTrack } from '../../shared/types';

export type SupportedArtist = {
  artist: string;
  artistAddress?: `0x${string}`;
  trackCount: number;
};

export type SupportSummary = {
  paidTracks: CatalogTrack[];
  supportedArtists: SupportedArtist[];
};

/**
 * Roll up the tracks a wallet has paid to unlock and the artists behind them.
 * Artists are keyed by address when present, else by (lowercased) name, so the
 * same artist is not double-counted across casings.
 */
export function deriveSupportSummary(catalogTracks: CatalogTrack[], paidAccessByTrackId: Record<string, boolean>): SupportSummary {
  const paidTrackIds = Object.entries(paidAccessByTrackId)
    .filter(([, granted]) => granted)
    .map(([id]) => id);

  const paidTracks = paidTrackIds.map(id => catalogTracks.find(track => track.id === id)).filter((track): track is CatalogTrack => Boolean(track));

  const supportedArtists = Array.from(
    paidTracks
      .reduce((artistsByKey, track) => {
        const key = track.artistAddress?.toLowerCase() ?? track.artist.toLowerCase();
        const existing = artistsByKey.get(key);
        artistsByKey.set(key, {
          artist: track.artist,
          artistAddress: track.artistAddress,
          trackCount: (existing?.trackCount ?? 0) + 1
        });
        return artistsByKey;
      }, new Map<string, SupportedArtist>())
      .values()
  );

  return { paidTracks, supportedArtists };
}
