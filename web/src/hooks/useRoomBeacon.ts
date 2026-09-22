// Announce a hosted room on the Statement Store, for as long as it is hosted.
//
// Kept out of useSession on purpose: the room lifecycle is already the most
// intricate part of the app, and discovery is an optional enhancement that must
// never be able to interrupt it.
//
// This is a thin adapter. The lifecycle lives in `startRoomBeaconLoop` so it can
// be tested as plain logic rather than through a renderer.

import { useEffect, useRef } from 'react';

export type UseRoomBeaconInput = {
  /** True only while this client is hosting the room. */
  isHosting: boolean;
  roomCode: string;
  hostName: string;
  listenerCount: number;
  /** Present only when the host opted into announcing what is playing. */
  nowPlaying?: { title: string; artist: string } | null;
};

// Build-time constant, so a build that did not opt in lets Rollup prove the
// dynamic import below is unreachable and drop the statement-store chunks.
const BEACONS_ENABLED = import.meta.env.VITE_DOTIFY_ROOM_BEACONS === 'on';

export function useRoomBeacon(input: UseRoomBeaconInput): void {
  const { isHosting, roomCode } = input;

  // Written in an effect rather than during render: a ref mutated while
  // rendering can be torn between a discarded render and the committed one.
  const latest = useRef(input);
  useEffect(() => {
    latest.current = input;
  });

  useEffect(() => {
    if (!BEACONS_ENABLED || !isHosting || !roomCode) return;

    let stop: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const { startRoomBeaconLoop } = await import('../features/rooms/roomBeaconPublisher');
      if (cancelled) return;
      stop = startRoomBeaconLoop(
        () => {
          const current = latest.current;
          if (!current.isHosting || !current.roomCode) return null;
          return {
            roomCode: current.roomCode,
            hostName: current.hostName,
            listenerCount: current.listenerCount,
            nowPlaying: current.nowPlaying ?? null
          };
        },
        {
          // Additive discovery: a refusal must not surface to the listener or
          // interrupt hosting, but it must not vanish either - otherwise an
          // operator debugging "my room is not discoverable" has nothing to read.
          onOutcome: outcome => {
            if (!outcome.ok) console.warn(`[dotify] room beacon not published (${outcome.reason}): ${outcome.detail}`);
          }
        }
      );
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
    // Restart only when the identity of the hosted room changes. Listener count
    // and now-playing ride the ref, so a busy room does not thrash the connection.
  }, [isHosting, roomCode]);
}
