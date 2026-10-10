import type { CatalogTrack } from '../../shared/types';
import { REQUEST_TEXT_MAX_LENGTH } from '../../shared/social';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export function searchRoomCatalog(tracks: CatalogTrack[], query: string): CatalogTrack[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return tracks.filter(track => track.active !== false && words.every(word => normalize(`${track.title} ${track.artist}`).includes(word)));
}

// Requests remain bounded text on the existing signaling protocol. A text
// match is a convenience for host curation, never signing or playback authority.
export function roomTrackRequestText(track: CatalogTrack): string {
  return (
    `${track.title} — ${track.artist}`
      // Match the signaling service's single-line text normalization before its cap.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, REQUEST_TEXT_MAX_LENGTH)
      .trim()
  );
}

export function resolveRequestedTrack(tracks: CatalogTrack[], text: string): CatalogTrack | null {
  const matches = tracks.filter(track => track.active !== false && normalize(roomTrackRequestText(track)) === normalize(text));
  return matches.length === 1 ? matches[0] : null;
}
