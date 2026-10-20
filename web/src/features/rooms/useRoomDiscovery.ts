import { useEffect, useRef, useState } from 'react';
import { useNearby } from './useNearby';
import type { RoomRealtimePort } from './roomRealtimePort';
import type { NearbySession } from './nearbySession';
import type { NearbyResult } from './nearbyTypes';

export type DiscoveredRoom = NearbyResult & { scope: 'nearby' | 'worldwide'; owner: NearbySession };

// One instance lives in the listener shell, so opening Rooms uses the scan
// already started on app entry. No coordinates or consent are persisted.
export function useRoomDiscovery(port: RoomRealtimePort | null, enabled: boolean) {
  const nearby = useNearby(port, false, 'radar');
  const worldwide = useNearby(port, false, 'worldwide');
  const [paused, setPaused] = useState(false);
  const [radius, setRadius] = useState(5);
  const [rangePending, setRangePending] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const radiusRef = useRef(radius);
  const denied = useRef(false);
  const pausedRef = useRef(paused);

  useEffect(() => {
    if (!port) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      // Coalesce socket, permission and StrictMode events before asking a Host.
      timer = setTimeout(() => {
        if (disposed || !enabled || document.visibilityState !== 'visible' || !port.connected) return;
        let wait = Infinity;
        for (const [session, kind] of [
          [worldwide.session, 'worldwide'],
          [nearby.session, 'device']
        ] as const) {
          if (!session) continue;
          const state = session.snapshot();
          if (kind === 'device' && state.phase === 'denied') {
            denied.current = true;
            setLocationDenied(true);
          }
          if (kind === 'device' && (pausedRef.current || denied.current)) continue;
          if (state.phase !== 'off' && state.phase !== 'disconnected') continue;
          if (state.retryInSeconds) wait = Math.min(wait, state.retryInSeconds * 1000 + 50);
          else void session.start({ kind }, radiusRef.current);
        }
        if (Number.isFinite(wait)) {
          clearTimeout(timer);
          timer = setTimeout(schedule, wait);
        }
      }, 0);
    };
    const unsubscribeNear = nearby.session?.subscribe(schedule);
    const unsubscribeWorld = worldwide.session?.subscribe(schedule);
    port.on('connect', schedule);
    document.addEventListener('visibilitychange', schedule);
    schedule();
    return () => {
      disposed = true;
      clearTimeout(timer);
      unsubscribeNear?.();
      unsubscribeWorld?.();
      port.off('connect', schedule);
      document.removeEventListener('visibilitychange', schedule);
      nearby.session?.stop();
      worldwide.session?.stop();
    };
  }, [port, enabled, nearby.session, worldwide.session]);

  useEffect(() => {
    if (!rangePending || paused || !enabled || !port?.connected || document.visibilityState !== 'visible') return;
    if (nearby.state.retryInSeconds || nearby.state.phase === 'locating' || nearby.state.phase === 'checking') return;
    setRangePending(false);
    if (denied.current) return;
    void nearby.session?.start({ kind: 'device' }, radius);
  }, [rangePending, paused, enabled, port, radius, nearby.session, nearby.state.phase, nearby.state.retryInSeconds]);

  const rooms: DiscoveredRoom[] = [];
  for (const [value, scope] of [
    [nearby, 'nearby'],
    [worldwide, 'worldwide']
  ] as const) {
    if (value.session)
      for (const result of value.state.results) {
        if (!rooms.some(room => room.roomId === result.roomId)) rooms.push({ ...result, scope, owner: value.session });
      }
  }
  return {
    nearby,
    worldwide,
    rooms,
    radius,
    hiddenRooms: [...new Map([...(nearby.state.hiddenRooms ?? []), ...(worldwide.state.hiddenRooms ?? [])].map(room => [room.roomId, room])).values()],
    hide: (room: NearbyResult) => {
      nearby.session?.hide(room.roomId, room.roomName || room.title);
      worldwide.session?.hide(room.roomId, room.roomName || room.title);
    },
    restore: (roomId: string) => {
      nearby.session?.restore(roomId);
      worldwide.session?.restore(roomId);
    },
    locationDenied,
    paused,
    rangePending,
    setPaused: (value: boolean) => {
      pausedRef.current = value;
      setPaused(value);
      if (value) nearby.session?.pause();
      else if (enabled) {
        denied.current = false;
        setLocationDenied(false);
        void nearby.session?.start({ kind: 'device' }, radius);
      }
    },
    applyRadius: (value: number) => {
      radiusRef.current = value;
      setRadius(value);
      setRangePending(true);
    },
    retry: () => {
      denied.current = false;
      setLocationDenied(false);
      if (!paused) void nearby.session?.start({ kind: 'device' }, radius);
    }
  };
}
