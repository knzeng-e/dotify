// Announce a hosted room on the Statement Store, for as long as it is hosted.
//
// Kept out of useSession on purpose: the room lifecycle is already the most
// intricate part of the app, and discovery is an optional enhancement that must
// never be able to interrupt it. Everything here fails quiet.
//
// Only a host announces, and only while actually hosting. A listener publishes
// nothing, which is what keeps joining free of identity.

import { useEffect, useRef } from 'react';
import type { RoomBeaconPublisher } from '../features/rooms/roomBeaconPublisher';

// Build-time constant, so a build that did not opt in lets Rollup prove the
// dynamic import below is unreachable and drop the statement-store chunks
// entirely rather than shipping ~84 KB that can never be fetched.
const BEACONS_ENABLED = import.meta.env.VITE_DOTIFY_ROOM_BEACONS === 'on';

export type UseRoomBeaconInput = {
  /** True only while this client is hosting the room. */
  isHosting: boolean;
  roomCode: string;
  hostName: string;
  listenerCount: number;
  /** Present only when the host opted into announcing what is playing. */
  nowPlaying?: { title: string; artist: string } | null;
};

export function useRoomBeacon(input: UseRoomBeaconInput): void {
  const { isHosting, roomCode } = input;

  // The latest values, read by the refresh timer without restarting it. A
  // listener joining should update the next beacon, not tear down the publisher.
  // Written in an effect rather than during render: a ref mutated while
  // rendering can be torn between a discarded render and the committed one.
  const latest = useRef(input);
  useEffect(() => {
    latest.current = input;
  });

  useEffect(() => {
    if (!BEACONS_ENABLED || !isHosting || !roomCode) return;

    let cancelled = false;
    let publisher: RoomBeaconPublisher | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function announce() {
      const current = latest.current;
      if (!publisher || !current.isHosting || !current.roomCode) return;
      await publisher.announce({
        roomCode: current.roomCode,
        hostName: current.hostName,
        listenerCount: current.listenerCount,
        nowPlaying: current.nowPlaying ?? null
      });
    }

    void (async () => {
      const { createRoomBeaconPublisher, BEACON_REFRESH_MS } = await import('../features/rooms/roomBeaconPublisher');
      // Null when no Product host is present - an ordinary outcome, not a failure.
      const created = await createRoomBeaconPublisher();
      if (cancelled) {
        created?.stop();
        return;
      }
      publisher = created;
      if (!publisher) return;

      await announce();
      // Statements expire chain-side, so a live room has to keep saying so.
      timer = setInterval(() => void announce(), BEACON_REFRESH_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      publisher?.stop();
      publisher = null;
    };
    // Restart only when the identity of the hosted room changes. Listener count
    // and now-playing ride the ref, so a busy room does not thrash the connection.
  }, [isHosting, roomCode]);
}
