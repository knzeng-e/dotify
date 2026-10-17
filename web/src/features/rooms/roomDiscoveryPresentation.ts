import type { NearbyResult } from './nearbyTypes';

/** The host is listening too, matching the in-room presence counter. */
export function discoveryPresenceCount(room: Pick<NearbyResult, 'listenerCount'>): number | null {
  return typeof room.listenerCount === 'number' && Number.isSafeInteger(room.listenerCount) && room.listenerCount >= 0 ? room.listenerCount + 1 : null;
}

export function discoveryPresenceLabel(room: Pick<NearbyResult, 'listenerCount' | 'presence'>): string {
  const count = discoveryPresenceCount(room);
  return count === null ? `${room.presence} here` : `${count} listening`;
}
