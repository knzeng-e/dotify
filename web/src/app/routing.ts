// App routing - pure view/route + history helpers.
//
// The app keeps its own lightweight routing (a view enum + the /artists portal
// path + history.state). These helpers hold the pure decisions so they are
// testable without a DOM; App.tsx passes the window values in.

import type { View } from '../types';

/** Type guard for the four main app views. */
export function isDotifyView(value: unknown): value is View {
  return value === 'listen' || value === 'player' || value === 'rooms' || value === 'you';
}

/** Landing view: a room share-link opens Rooms, everything else opens Now. */
export function initialView(roomCodePresent: boolean): View {
  return roomCodePresent ? 'rooms' : 'listen';
}

/** Whether the given path is the artist portal (`/artists`, trailing slash ok). */
export function isArtistPortalPath(pathname: string): boolean {
  return pathname.replace(/\/$/, '') === '/artists';
}

/** Normalize `history.state` to a plain object we can safely spread. */
export function historyStateObject(state: unknown): Record<string, unknown> {
  return state && typeof state === 'object' ? (state as Record<string, unknown>) : {};
}

/** Resolve the active view from a popstate `history.state`, falling back cleanly. */
export function viewFromHistoryState(state: unknown, fallback: View): View {
  const stateView = (state as { dotifyView?: unknown } | null)?.dotifyView;
  return isDotifyView(stateView) ? stateView : fallback;
}
