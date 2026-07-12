import { ArrowRight, Headphones, KeyRound, Link2, Radio, RefreshCw, Users } from 'lucide-react';
import type { FormEvent } from 'react';

import { CoverImage } from '../components/CoverImage';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import { SkyOfRooms } from '../components/SkyOfRooms';
import { roomPresenceCount } from '../features/rooms/roomState';
import type { OpenRoom, SessionAction } from '../shared/types';

type RoomsViewProps = {
  openRooms: OpenRoom[];
  joinCode: string;
  sessionAction: SessionAction;
  isRefreshingRooms: boolean;
  onSetJoinCode: (code: string) => void;
  onJoinRoom: (roomId: string) => void;
  onJoinSession: (event: FormEvent<HTMLFormElement>) => void;
  onRefreshRooms: () => void;
  onStartRoom: () => void;
};

export function RoomsView({
  openRooms,
  joinCode,
  sessionAction,
  isRefreshingRooms,
  onSetJoinCode,
  onJoinRoom,
  onJoinSession,
  onRefreshRooms,
  onStartRoom
}: RoomsViewProps) {
  const totalListening = openRooms.reduce((total, room) => total + roomPresenceCount(room.listenerCount, true), 0);
  const isJoining = sessionAction === 'joining';

  return (
    <section className='rooms-landing' aria-labelledby='rooms-title'>
      <header className='rooms-intro'>
        <div>
          <p className='eyebrow'>Listening rooms</p>
          <h1 id='rooms-title'>Enter the same musical moment.</h1>
        </div>
        <div className='rooms-intro-copy'>
          <p>A room is a live stream carried by its host. The link is enough for a guest to arrive, choose a local name, and listen.</p>
          <dl className='rooms-summary'>
            <div>
              <dt>Open rooms</dt>
              <dd>{openRooms.length}</dd>
            </div>
            <div>
              <dt>Listening now</dt>
              <dd>{totalListening}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className='rooms-live-section' aria-labelledby='rooms-live-title'>
        <div className='section-heading'>
          <div>
            <span className='section-index'>01 / Live</span>
            <h2 id='rooms-live-title'>Happening now</h2>
          </div>
          <button className='text-action' type='button' onClick={onRefreshRooms} disabled={isRefreshingRooms}>
            <RefreshCw size={15} className={isRefreshingRooms ? 'spin' : undefined} />
            {isRefreshingRooms ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        {openRooms.length > 0 && <SkyOfRooms rooms={openRooms} sessionAction={sessionAction} onJoinRoom={onJoinRoom} />}

        {openRooms.length > 0 ? (
          <div className='room-card-grid'>
            {openRooms.map(room => (
              <button
                className='room-live-card'
                type='button'
                key={room.roomId}
                onClick={() => onJoinRoom(room.roomId)}
                disabled={sessionAction !== 'idle'}
                aria-label={`Enter ${room.hostName}'s room listening to ${room.track?.title ?? 'a live session'}`}
              >
                <span className='room-live-art' aria-hidden='true'>
                  {room.track?.imageRef ? <CoverImage src={room.track.imageRef} alt='' /> : <Radio size={24} />}
                </span>
                <span className='room-live-main'>
                  <span className='room-live-kicker'>
                    <span className='live-dot' />
                    {room.hostName} hosts
                  </span>
                  <strong>{room.track?.title ?? 'Audio session'}</strong>
                  <span>{room.track?.artist ?? 'Live on Dotify'}</span>
                  <span className='home-room-presence'>
                    <AvatarStack names={roomPresenceNames(room.hostName, room.listenerCount, room.roomId)} max={4} size={25} />
                    <small>{roomPresenceCount(room.listenerCount, true)} here</small>
                  </span>
                </span>
                <span className='room-live-side'>
                  <code>{room.roomId}</code>
                  <span>
                    {isJoining ? 'Joining' : 'Enter'}
                    <ArrowRight size={15} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className='rooms-empty-state'>
            <span className='rooms-empty-signal' aria-hidden='true'>
              <i />
              <i />
              <i />
            </span>
            <div>
              <strong>No room is open right now.</strong>
              <p>Start with a work and welcome the first shared moment.</p>
            </div>
            <button className='secondary-action' type='button' onClick={onStartRoom} disabled={sessionAction !== 'idle'}>
              <Radio size={17} />
              Open the first room
            </button>
          </div>
        )}
      </section>

      <section className='room-entry-section' aria-labelledby='room-entry-title'>
        <div className='section-heading'>
          <div>
            <span className='section-index'>02 / Begin</span>
            <h2 id='room-entry-title'>Bring people in, or follow a link.</h2>
          </div>
        </div>

        <div className='room-entry-grid'>
          <article className='room-entry-card room-entry-create'>
            <span className='room-entry-icon'>
              <Radio size={21} />
            </span>
            <div>
              <span className='room-entry-label'>Host a moment</span>
              <h3>Open a room around a work.</h3>
              <p>Choose music you can play, name the room presence, then share one link.</p>
            </div>
            <button className='primary-action' type='button' onClick={onStartRoom} disabled={sessionAction !== 'idle'}>
              Open a room
              <ArrowRight size={17} />
            </button>
          </article>

          <article className='room-entry-card room-entry-join'>
            <span className='room-entry-icon'>
              <Link2 size={21} />
            </span>
            <div>
              <span className='room-entry-label'>Join someone</span>
              <h3>Use the room code or link you received.</h3>
              <p>No wallet is required to listen to the host's ephemeral stream.</p>
            </div>
            <form className='session-form room-action-form' onSubmit={onJoinSession}>
              <label htmlFor='room-code-input'>Room code or link</label>
              <div className='room-action-row'>
                <input
                  id='room-code-input'
                  className='field code-field room-action-field'
                  value={joinCode}
                  onChange={event => onSetJoinCode(event.target.value)}
                  placeholder='ABC123 or a room link'
                  maxLength={140}
                  autoComplete='off'
                />
                <button className='primary-action room-action-submit' type='submit' disabled={sessionAction !== 'idle'}>
                  <Headphones size={17} />
                  {isJoining ? 'Joining…' : 'Join'}
                </button>
              </div>
            </form>
          </article>
        </div>
      </section>

      <aside className='room-doctrine' aria-label='Room access model'>
        <div>
          <Users size={20} />
          <span>
            <strong>Guests arrive as people, not accounts.</strong>A local room name is enough for presence.
          </span>
        </div>
        <div>
          <KeyRound size={20} />
          <span>
            <strong>The host carries access.</strong>
            Guests receive the room stream, never the protected source key.
          </span>
        </div>
      </aside>
    </section>
  );
}
