import { ArrowRight, Radio } from 'lucide-react';
import type { FormEvent } from 'react';
import { roomExperienceFlags } from '../features/rooms/roomExperienceFlags';
import { WorldwideRooms } from '../components/WorldwideRooms';
import { NearbyControls } from '../components/NearbyControls';
import { useNearby } from '../features/rooms/useNearby';
import type { RoomRealtimePort } from '../features/rooms/roomRealtimePort';
import type { SessionAction } from '../shared/types';

type RoomsViewProps = {
  nearbyPort?: RoomRealtimePort | null;
  joinCode: string;
  sessionAction: SessionAction;
  onSetJoinCode: (code: string) => void;
  onJoinRoom: (roomId: string) => void;
  onJoinSession: (event: FormEvent<HTMLFormElement>) => void;
  onStartRoom: () => void;
};

export function RoomsView({ nearbyPort = null, joinCode, sessionAction, onSetJoinCode, onJoinRoom, onJoinSession, onStartRoom }: RoomsViewProps) {
  const nearby = useNearby(nearbyPort, false);
  const isJoining = sessionAction === 'joining';
  return (
    <section className='rooms-landing rooms-landing-focused' aria-labelledby='rooms-title'>
      <header className='rooms-intro'>
        <div>
          <h1 id='rooms-title'>Listening rooms.</h1>
          <p className='rooms-intro-copy'>A link brings you together. Nearby helps you find each other.</p>
        </div>
      </header>
      <section className='room-arrival' aria-label='Join or host a room'>
        <form className='session-form room-action-form' onSubmit={onJoinSession}>
          <label htmlFor='room-code-input'>Room code or link</label>
          <div className='room-action-row'>
            <input
              id='room-code-input'
              name='room-code'
              className='field code-field room-action-field'
              value={joinCode}
              onChange={event => onSetJoinCode(event.target.value)}
              placeholder='ABC123 or a room link'
              maxLength={140}
              autoComplete='off'
              spellCheck={false}
            />
            <button className='primary-action room-action-submit' type='submit' disabled={sessionAction !== 'idle'}>
              <ArrowRight size={17} aria-hidden='true' />
              {isJoining ? 'Joining…' : 'Join'}
            </button>
          </div>
        </form>
        <button className='secondary-action' type='button' onClick={onStartRoom} disabled={sessionAction !== 'idle'}>
          <Radio size={18} aria-hidden='true' /> Open a room
        </button>
      </section>
      {roomExperienceFlags.nearby && <WorldwideRooms port={nearbyPort} onJoin={onJoinRoom} joining={isJoining} />}
      {roomExperienceFlags.nearby && <NearbyControls nearby={nearby} onJoin={onJoinRoom} joining={isJoining} onOpenRoom={onStartRoom} />}
    </section>
  );
}
