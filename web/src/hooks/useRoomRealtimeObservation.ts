import { useEffect, useRef } from 'react';
import type { RoomRealtimePort } from '../features/rooms/roomRealtimePort';

const MODE = import.meta.env.VITE_DOTIFY_ROOM_REALTIME;

export function useRoomRealtimeObservation(input: {
  roomId: string;
  isHosting: boolean;
  online: boolean;
  listenerCount: number;
  port: RoomRealtimePort | null;
}) {
  const { roomId, isHosting, online, port } = input;
  const latest = useRef(input.listenerCount);
  useEffect(() => {
    latest.current = input.listenerCount;
  }, [input.listenerCount]);
  useEffect(() => {
    if ((MODE !== 'observe' && MODE !== 'dual') || !roomId || !online) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    let stopPrivate: (() => void) | undefined;
    void import('../features/rooms/celerityObservation')
      .then(async ({ startCelerityObservation }) => {
        if (cancelled) return;
        const { installCelerityDiagnostics } = await import('../features/rooms/celerityDiagnostics');
        if (cancelled) return;
        installCelerityDiagnostics();
        stop = startCelerityObservation({ room: roomId, mode: MODE, isHosting, listeners: () => latest.current });
        if (port) {
          const { startPrivateCelerityObservation } = await import('../features/rooms/celerityPrivateObservation');
          if (!cancelled) stopPrivate = startPrivateCelerityObservation(port, MODE);
        }
      })
      .catch(() => {
        if (!cancelled) console.warn('[dotify] Room observation unavailable; room service remains authoritative.');
      });
    return () => {
      cancelled = true;
      stop?.();
      stopPrivate?.();
    };
  }, [roomId, isHosting, online, port]);
}
