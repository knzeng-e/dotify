import { Disc3, Headphones, KeyRound, Radio, RefreshCw, Users } from 'lucide-react';
import { PanelTitle } from '../components/ui/PanelTitle';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import type { OpenRoom, SessionAction } from '../types';
import type { FormEvent } from 'react';

type RoomsViewProps = {
  openRooms: OpenRoom[];
  joinCode: string;
  sessionAction: SessionAction;
  isRefreshingRooms: boolean;
  onSetJoinCode: (code: string) => void;
  onJoinRoom: (roomId: string) => void;
  onJoinSession: (event: FormEvent<HTMLFormElement>) => void;
  onRefreshRooms: () => void;
};

export function RoomsView({ openRooms, joinCode, sessionAction, isRefreshingRooms, onSetJoinCode, onJoinRoom, onJoinSession, onRefreshRooms }: RoomsViewProps) {
  const totalListening = openRooms.reduce((total, room) => total + room.listenerCount + 1, 0);

  return (
    <section className='rooms-landing'>
      <div className='doc-panel rooms-hero-panel'>
        <div className='rooms-hero-copy'>
          <p className='eyebrow'><span className='live-dot' />Live rooms</p>
          <h2>Enter the same listening moment.</h2>
          <p>Join by link or code. Guests hear the host stream without receiving content keys or protected source files.</p>
        </div>
        <div className='rooms-hero-stats'>
          <div>
            <strong className='tnum'>{openRooms.length}</strong>
            <span>open rooms</span>
          </div>
          <div>
            <strong className='tnum'>{totalListening}</strong>
            <span>listening</span>
          </div>
        </div>
      </div>

      <div className='rooms-board'>
        <div className='doc-panel rooms-live-panel'>
          <PanelTitle icon={Radio} title='Happening now' meta={`${openRooms.length} open`} />
          {openRooms.length > 0 ? (
            <div className='room-card-grid'>
              {openRooms.map(room => (
                <button className='room-live-card' type='button' key={room.roomId} onClick={() => onJoinRoom(room.roomId)} disabled={sessionAction !== 'idle'}>
                  <span className='room-live-art' aria-hidden='true'>
                    {room.track?.imageRef && <img src={room.track.imageRef} alt='' crossOrigin='anonymous' />}
                  </span>
                  <span className='room-live-main'>
                    <span className='room-live-kicker'>
                      <span className='live-dot' />
                      {room.hostName} hosts
                    </span>
                    <strong>{room.track?.title ?? 'Audio session'}</strong>
                    <span className='home-room-presence'>
                      <AvatarStack names={roomPresenceNames(room.hostName, room.listenerCount, room.roomId)} max={4} size={24} />
                      <small>{room.listenerCount + 1} listening</small>
                    </span>
                  </span>
                  <span className='room-live-side'>
                    <code>{room.roomId}</code>
                    <span>
                      {sessionAction === 'joining' ? <Disc3 size={16} className='spin' /> : <Headphones size={16} />}
                      {sessionAction === 'joining' ? 'Joining...' : 'Join'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className='empty-state'>No open rooms yet. Start one from the catalog and share the link.</div>
          )}
        </div>

        <aside className='doc-panel rooms-join-panel'>
          <PanelTitle icon={Headphones} title='Join by code' meta='manual' />
          <form className='session-form' onSubmit={onJoinSession}>
            <input
              className='field code-field'
              value={joinCode}
              onChange={event => onSetJoinCode(event.target.value.toUpperCase())}
              placeholder='ABC123'
              maxLength={12}
              aria-label='Room code'
            />
            <button className='primary-action' type='submit' disabled={sessionAction !== 'idle'}>
              {sessionAction === 'joining' ? <Disc3 size={16} className='spin' /> : <Headphones size={16} />}
              {sessionAction === 'joining' ? 'Joining...' : 'Join room'}
            </button>
          </form>
          <button className='secondary-action' type='button' onClick={onRefreshRooms} disabled={isRefreshingRooms}>
            {isRefreshingRooms ? <Disc3 size={16} className='spin' /> : <RefreshCw size={16} />}
            {isRefreshingRooms ? 'Refreshing...' : 'Refresh rooms'}
          </button>
          <div className='rooms-doctrine-card'>
            <KeyRound size={16} />
            <div>
              <strong>Host-based access</strong>
              <span>The host must be allowed to play protected tracks. Guests receive only the live stream.</span>
            </div>
          </div>
          <div className='rooms-doctrine-card'>
            <Users size={16} />
            <div>
              <strong>No guest wallet checkpoint</strong>
              <span>A room should feel as simple as entering through a shared link.</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
