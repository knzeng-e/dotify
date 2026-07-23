import type { CatalogApiMetadata } from '../../services/catalog';

export const CATALOG_LOAD_ERROR_STATUS = 'Catalog temporarily unavailable. Check your connection or try again shortly.';

export function catalogLoadFailureStatus(_error: unknown): string {
  return CATALOG_LOAD_ERROR_STATUS;
}

export function catalogApiStatus(metadata: CatalogApiMetadata, trackCount: number): string {
  if (metadata.state === 'rpc-outage') {
    return metadata.cacheAvailable ? 'Showing the saved catalog while the music registry reconnects' : 'Music registry temporarily unreachable';
  }
  if (metadata.state === 'indexer-outage') {
    return metadata.cacheAvailable ? 'Showing the saved catalog while the catalog index recovers' : 'Catalog index temporarily unavailable';
  }
  if (metadata.state === 'stale-cache') return 'Showing saved catalog data while new releases are checked';
  if (metadata.state === 'empty' || trackCount === 0) return 'No tracks registered on this directory yet';
  return `Loaded ${trackCount} registered track${trackCount === 1 ? '' : 's'}`;
}
