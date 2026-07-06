// Catalog track model - pure mappings and identity helpers for catalog tracks.
//
// Extracted from App.tsx (mappers) and de-duplicated from useCatalog/ReleasesTab
// (runtime-id parsing) so track-shape logic lives in one tested place.

import type { AccessMode, CatalogTrack, TrackInfo } from '../../shared/types';

/** Price shown/charged for a track: the set price for Classic, free otherwise. */
export function priceDotForAccessMode(accessMode: AccessMode, priceDot: string): string {
  return accessMode === 'classic' ? priceDot : '0';
}

/** The local (pre-IPFS) audio reference for a track hash. */
export function localAudioRef(hash: string): string {
  return `dotify:local:${hash}`;
}

/** Project a catalog track into the lighter TrackInfo broadcast/shared shape. */
export function catalogTrackToTrackInfo(track: CatalogTrack): TrackInfo {
  return {
    title: track.title,
    artist: track.artist,
    hash: track.hash,
    bulletinRef: track.bulletinRef,
    duration: track.duration ?? 0,
    updatedAt: Date.now(),
    imageRef: track.imageRef,
    audioRef: track.audioRef,
    previewRef: track.previewRef,
    metadataRef: track.metadataRef,
    description: track.description,
    accessMode: track.accessMode,
    priceDot: track.priceDot,
    personhoodLevel: track.personhoodLevel
  };
}

/**
 * Whether a track belongs to the given artist. Prefers the on-chain artist
 * address when present, falling back to the display name for local/demo tracks.
 */
export function isTrackManagedByArtist(track: CatalogTrack, artistAddress: `0x${string}`, artistName: string): boolean {
  if (track.source !== 'artist') return false;
  if (track.artistAddress) return track.artistAddress.toLowerCase() === artistAddress.toLowerCase();
  return track.artist === artistName;
}

/**
 * The artist runtime address encoded in a policy-managed track id
 * (`<runtime>:<hash>`), or null for free/local tracks without a runtime id.
 */
export function runtimeAddressFromTrackId(track: Pick<CatalogTrack, 'source' | 'id'>): `0x${string}` | null {
  if (track.source !== 'artist' || !track.id.includes(':')) return null;
  return track.id.split(':')[0] as `0x${string}`;
}
