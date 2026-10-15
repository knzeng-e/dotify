import { useCallback, useEffect, useRef, useState } from 'react';
import { NEARBY_RADII } from '../../../shared/nearby-v2.mjs';
import type { NearbySession } from './nearbySession';

/** Consume a creation choice once, against the newly acknowledged room only. */
export function useRoomVisibilityIntent(roomId: string, session: NearbySession | null) {
  const [intent, setIntent] = useState<{ roomId: string; radius: number } | null>(null);
  const consumed = useRef<typeof intent>(null);
  const enableForRoom = useCallback((createdRoomId: string, radius: number) => {
    if (createdRoomId && NEARBY_RADII.includes(radius)) setIntent({ roomId: createdRoomId, radius });
  }, []);

  useEffect(() => {
    if (!intent || !session || roomId !== intent.roomId || consumed.current === intent) return;
    consumed.current = intent;
    // This is the explicit Open-room choice, never a persisted preference or
    // an automatic retry after expiry/reconnect/permission denial.
    void session.start({ kind: 'device' }, intent.radius);
    setIntent(null);
  }, [intent, roomId, session]);

  return enableForRoom;
}
