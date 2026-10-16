import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { RoomRealtimePort } from './roomRealtimePort';
import { NearbySession, type NearbyState } from './nearbySession';
import { roomExperienceFlags } from './roomExperienceFlags';

const off: NearbyState = { phase: 'off', message: '', results: [] };
const noopSubscribe = () => () => {};
const offSnapshot = () => off;

export function useNearby(port: RoomRealtimePort | null, host: boolean, roomId = '') {
  const session = useMemo(
    () => (port && roomExperienceFlags.nearby ? new NearbySession(port, host, true) : null),
    // Each host room owns a fresh consent. No nearby state survives room changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [port, host, roomId]
  );
  const state = useSyncExternalStore(session?.subscribe ?? noopSubscribe, session?.snapshot ?? offSnapshot);
  useEffect(() => {
    if (!session || !port) return;
    const stop = () => {
      if (session.snapshot().phase !== 'denied') session.stop('Nearby stopped. Start again when you are ready.', 'disconnected');
    };
    const visibility = () => {
      if (document.visibilityState !== 'visible' && session.snapshot().phase !== 'denied')
        session.stop('Nearby paused while you were away. Start again to continue.');
    };
    const pagehide = () => session.stop();
    port.on('disconnect', stop);
    port.on('room:closed', stop);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    return () => {
      session.stop();
      port.off('disconnect', stop);
      port.off('room:closed', stop);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
    };
  }, [session, port]);
  return { session, state };
}
