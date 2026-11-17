import { createHash } from 'node:crypto';
import type { CatalogArtist, CatalogRelease, CatalogSnapshot } from './types.js';

/** Content arrays are replaced, never mutated. Metadata-only checkpoints share
 * them, so HTTP requests and progress ticks do not rehash/rebuild the catalog. */
const views = new WeakMap<CatalogRelease[], { artists: CatalogArtist[]; excluded: CatalogSnapshot['excludedReleases']; view: CatalogContent }>();
export type CatalogContent = {
  revision: string;
  byId: Map<string, CatalogRelease>;
  byHash: Map<string, CatalogRelease[]>;
  byRuntime: Map<string, CatalogRelease[]>;
  byArtist: Map<string, CatalogArtist>;
  active: CatalogRelease[];
};
export function catalogContent(snapshot: CatalogSnapshot): CatalogContent {
  const cached = views.get(snapshot.releases);
  if (cached?.artists === snapshot.artists && cached.excluded === snapshot.excludedReleases) return cached.view;
  const view: CatalogContent = {
    revision: createHash('sha256')
      .update(
        JSON.stringify({
          artists: snapshot.artists,
          releases: snapshot.releases,
          ...(snapshot.excludedReleases?.length ? { excludedReleases: snapshot.excludedReleases } : {})
        })
      )
      .digest('hex'),
    byId: new Map(),
    byHash: new Map(),
    byRuntime: new Map(),
    byArtist: new Map(),
    active: []
  };
  for (const artist of snapshot.artists) view.byArtist.set(artist.artistAddress.toLowerCase(), artist);
  for (const release of snapshot.releases) {
    view.byId.set(release.id.toLowerCase(), release);
    for (const [map, key] of [
      [view.byHash, release.hash],
      [view.byRuntime, release.runtimeAddress]
    ] as const) {
      const normalized = key.toLowerCase();
      const group = map.get(normalized);
      if (group) group.push(release);
      else map.set(normalized, [release]);
    }
    if (release.active) view.active.push(release);
  }
  views.set(snapshot.releases, { artists: snapshot.artists, excluded: snapshot.excludedReleases, view });
  return view;
}
