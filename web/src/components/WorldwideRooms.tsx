import { useEffect, useId } from 'react';
import { Globe2 } from 'lucide-react';
import { useNearby } from '../features/rooms/useNearby';
import type { NearbyState } from '../features/rooms/nearbySession';
import { DiscoveryRoomList } from './DiscoveryRoomList';
import type { RoomRealtimePort } from '../features/rooms/roomRealtimePort';

// The shared session reports lifecycle in Nearby terms; this list resumes on
// its own, so it describes that state in worldwide terms instead.
function worldwideMessage(state: NearbyState): string {
  if (state.phase === 'disconnected') return 'Reconnecting to live rooms…';
  if (state.phase === 'stale') return 'Live rooms could not refresh. Try again in a moment.';
  if (state.phase === 'active' || state.phase === 'empty') return state.message;
  return 'Finding live rooms…';
}

/** Public rooms opted into worldwide discovery. This never reads location. */
export function WorldwideRooms({ port, onJoin, joining }: { port: RoomRealtimePort | null; onJoin: (id: string) => void; joining: boolean }) {
  const titleId = useId();
  const { session, state } = useNearby(port, false, 'worldwide');
  useEffect(() => {
    if (!session || !port) return;
    const start = () => {
      if (document.visibilityState === 'visible') void session.start({ kind: 'worldwide' }, 5);
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') start();
    };
    const timer = setTimeout(start, 0);
    port.on('connect', start);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearTimeout(timer);
      port.off('connect', start);
      document.removeEventListener('visibilitychange', visibility);
      session.stop();
    };
  }, [session, port]);
  useEffect(() => {
    // A quick reconnect can finish before the scan cooldown. Once it expires,
    // resume public reads from the disconnected phase too, but never offline.
    if (
      !session ||
      !port?.connected ||
      (state.phase !== 'off' && state.phase !== 'disconnected') ||
      state.retryInSeconds ||
      document.visibilityState !== 'visible'
    )
      return;
    const timer = setTimeout(() => void session.start({ kind: 'worldwide' }, 5), 0);
    return () => clearTimeout(timer);
  }, [session, port, state.phase, state.retryInSeconds]);
  if (!session) return null;
  return (
    <section className='worldwide-rooms' aria-labelledby={titleId}>
      <header className='nearby-heading'>
        <Globe2 size={24} aria-hidden='true' />
        <div>
          <h2 id={titleId}>Around the world</h2>
          <p>Open invitations. One shared moment.</p>
        </div>
      </header>
      <p role='status' className='nearby-status'>
        {worldwideMessage(state)}
      </p>
      <DiscoveryRoomList session={session} results={state.results} label='Worldwide rooms' joining={joining} onJoin={room => onJoin(room.roomId)} />
      {(state.phase === 'stale' || state.phase === 'disconnected') && (
        <button type='button' className='text-action' disabled={!!state.retryInSeconds} onClick={() => void session.start({ kind: 'worldwide' }, 5)}>
          {state.retryInSeconds ? `Try again in ${state.retryInSeconds}s` : 'Try again'}
        </button>
      )}
    </section>
  );
}
