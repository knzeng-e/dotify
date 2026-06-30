// Room state - pure helpers for the listening-room share-link flow.
//
// Extracted from useSession so the URL parsing and link building can be unit
// tested without a DOM. Callers in the browser rely on the window.location
// defaults; tests pass explicit strings.

/**
 * Read the room code from a share link hash.
 * Preferred form `#/rooms/<id>`, with legacy `#/?room=<id>` still honored.
 * Returns the uppercased code, or '' when none is present.
 */
export function getInitialRoomCode(hash: string = typeof window === 'undefined' ? '' : window.location.hash): string {
  // Preferred share-link form: #/rooms/<roomId>
  const hashPath = hash.split('?')[0] ?? '';
  const roomsMatch = hashPath.match(/\/rooms\/([A-Za-z0-9]{4,12})/);
  if (roomsMatch) return roomsMatch[1].toUpperCase();

  // Legacy form: #/?room=<roomId> (older shared links keep working)
  const hashQuery = hash.split('?')[1] ?? '';
  return new URLSearchParams(hashQuery).get('room')?.toUpperCase() ?? '';
}

/**
 * Build the shareable join link for a room.
 * Uses the hash route `#/rooms/<id>` so links survive static hosting
 * (GitHub Pages, IPFS gateways) without server-side rewrites.
 */
export function buildSessionLink(roomId: string, href: string = typeof window === 'undefined' ? '' : window.location.href): string {
  if (!roomId || !href) return '';
  const url = new URL(href);
  url.hash = `/rooms/${roomId}`;
  return url.toString();
}

/** People present in a room: listeners plus the host, or 0 when not in a room. */
export function roomPresenceCount(listenerCount: number, inRoom: boolean): number {
  return inRoom ? listenerCount + 1 : 0;
}
