import { useEffect } from 'react';
import { Globe2, Radio } from 'lucide-react';
import { useNearby } from '../features/rooms/useNearby';
import type { RoomRealtimePort } from '../features/rooms/roomRealtimePort';

/** Public rooms opted into worldwide discovery. This never reads location. */
export function WorldwideRooms({ port, onJoin, joining }: { port: RoomRealtimePort | null; onJoin: (id: string) => void; joining: boolean }) {
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
    <section className='worldwide-rooms' aria-labelledby='worldwide-title'>
      <header className='nearby-heading'>
        <Globe2 size={24} aria-hidden='true' />
        <div>
          <h2 id='worldwide-title'>Around the world</h2>
          <p>Open invitations. One shared moment.</p>
        </div>
      </header>
      <p role='status' className='nearby-status'>
        {state.message || 'Finding live rooms…'}
      </p>
      <ul className='nearby-results' aria-label='Worldwide rooms'>
        {state.results.map(room => (
          <li className='nearby-room' key={room.discoveryId}>
            <Radio size={23} aria-hidden='true' />
            <div className='nearby-room-copy'>
              <small>
                {room.hostName} hosts · {room.presence} here
              </small>
              <h3>{room.title}</h3>
              <p>{room.artist}</p>
            </div>
            <button type='button' className='primary-action' disabled={joining || room.isFull} onClick={() => onJoin(room.roomId)}>
              {room.isFull ? 'Full' : 'Join'}
            </button>
          </li>
        ))}
      </ul>
      {(state.phase === 'stale' || state.phase === 'disconnected') && (
        <button type='button' className='text-action' disabled={!!state.retryInSeconds} onClick={() => void session.start({ kind: 'worldwide' }, 5)}>
          {state.retryInSeconds ? `Try again in ${state.retryInSeconds}s` : 'Try again'}
        </button>
      )}
    </section>
  );
}
