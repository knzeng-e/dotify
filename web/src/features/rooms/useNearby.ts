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
    const disconnect = () => {
      if (host) session.suspend('Reconnecting visibility. Your choice is saved.', 'disconnected');
      else if (session.snapshot().phase !== 'denied') session.stop('Nearby stopped. Start again when you are ready.', 'disconnected');
    };
    const close = () => session.stop();
    const resume = () => {
      if (host) void session.resume();
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') resume();
      else if (host) session.suspend('Visibility paused while you were away. Your choice is saved.');
      else if (session.snapshot().phase !== 'denied') session.stop('Nearby paused while you were away. Start again to continue.');
    };
    const pagehide = () => (host ? session.suspend('Visibility paused. Your choice is saved.') : session.stop());
    port.on('disconnect', disconnect);
    port.on('connect', resume);
    port.on('room:closed', close);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    window.addEventListener('pageshow', resume);
    return () => {
      session.stop();
      port.off('disconnect', disconnect);
      port.off('connect', resume);
      port.off('room:closed', close);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('pageshow', resume);
    };
  }, [session, port, host]);
  return { session, state };
}
