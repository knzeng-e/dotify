import { useEffect, useState } from 'react';

import { roomBeaconToOpenRoom } from '../features/rooms/roomBeaconDiscovery';
import type { OpenRoom } from '../shared/types';

// Build-time gate matching the publisher. The tracked Product profile keeps it
// off until the host path has live evidence.
const BEACONS_ENABLED = import.meta.env.VITE_DOTIFY_ROOM_BEACONS === 'on';

/** Subscribe to additive Product room discovery without owning room joining. */
export function useRoomBeaconDiscovery(): OpenRoom[] {
  const [rooms, setRooms] = useState<OpenRoom[]>([]);

  useEffect(() => {
    if (!BEACONS_ENABLED) return;

    let cancelled = false;
    let stop: (() => void) | undefined;

    void (async () => {
      const { subscribeRoomBeacons } = await import('../features/rooms/roomBeaconPublisher');
      if (cancelled) return;

      const listener = await subscribeRoomBeacons({
        onChange: beacons => {
          if (!cancelled) setRooms(beacons.map(roomBeaconToOpenRoom));
        }
      });

      if (cancelled) {
        listener?.stop();
        return;
      }
      if (!listener) {
        console.warn('[dotify] Product room discovery is unavailable; continuing with the room service.');
        return;
      }
      stop = listener?.stop;
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return rooms;
}
