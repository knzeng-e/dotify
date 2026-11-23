import type { CatalogTrack } from '../../shared/types';

export const normalizeCatalogText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+[—·]\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function searchCatalog(tracks: CatalogTrack[], query: string): CatalogTrack[] {
  const terms = normalizeCatalogText(query).split(' ').filter(Boolean);
  if (!terms.length) return tracks;
  return tracks.filter(track => {
    const text = normalizeCatalogText(`${track.title} ${track.artist}`);
    return terms.every(term => text.includes(term));
  });
}
