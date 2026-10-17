import { buildSessionLink, getInitialRoomCode } from '../rooms/roomState';

/** Only a public route crosses into the browser; never account or host resume tokens. */
export function productNearbyBrowserUrl(publicAppUrl: string | undefined, currentHash = '', roomId = ''): string | null {
  if (!publicAppUrl) return null;
  try {
    const url = new URL(publicAppUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    url.search = '';
    url.hash = '/rooms';
    const currentRoom = roomId || getInitialRoomCode(currentHash);
    return /^[A-Z2-9]{6}$/.test(currentRoom) ? buildSessionLink(currentRoom, url.toString()) : url.toString();
  } catch {
    return null;
  }
}
