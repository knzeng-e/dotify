import { useState, type FormEvent } from 'react';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import type { OpenRoom, SessionAction } from '../types';

// ── Inline SVG icons ────────────────────────────────────────────────────────
function SvgBroadcast({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
      <path d='M4.9 19.1C1 15.2 1 8.8 4.9 4.9'/>
      <path d='M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5'/>
      <circle cx='12' cy='12' r='2'/>
      <path d='M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5'/>
      <path d='M19.1 4.9C23 8.8 23 15.1 19.1 19'/>
    </svg>
  );
}
function SvgHeadphones({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
      <path d='M3 18v-6a9 9 0 0 1 18 0v6'/>
      <path d='M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z'/>
      <path d='M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z'/>
    </svg>
  );
}
function SvgRefresh({ size, spinning }: { size: number; spinning?: boolean }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' className={spinning ? 'spin' : ''}>
      <polyline points='23 4 23 10 17 10'/>
      <polyline points='1 20 1 14 7 14'/>
      <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'/>
    </svg>
  );
}
function SvgSpinner({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' className='spin'>
      <path d='M21 12a9 9 0 1 1-6.219-8.56'/>
    </svg>
  );
}
function SvgKey({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
      <circle cx='7.5' cy='15.5' r='5.5'/>
      <path d='M21 2l-9.6 9.6'/>
      <path d='M15.5 7.5l3 3L22 7l-3-3'/>
    </svg>
  );
}
function SvgUsers({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
      <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/>
      <circle cx='9' cy='7' r='4'/>
      <path d='M23 21v-2a4 4 0 0 0-3-3.87'/>
      <path d='M16 3.13a4 4 0 0 1 0 7.75'/>
    </svg>
  );
}

// ── Types ───────────────────────────────────────────────────────────────────
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

export function RoomsView({ openRooms, joinCode, sessionAction, isRefreshingRooms, onSetJoinCode, onJoinRoom, onJoinSession, onRefreshRooms, onStartRoom }: RoomsViewProps) {
  const [action, setAction] = useState<'start' | 'join'>('start');
  const totalListening = openRooms.reduce((total, room) => total + room.listenerCount + 1, 0);
  const isJoining = sessionAction === 'joining';

  return (
    <section className='rooms-landing'>
      <div className='doc-panel rooms-hero-panel'>
        <div className='rooms-hero-copy'>
          <p className='eyebrow'>
            <span className='live-dot' />
            Live rooms
          </p>
          <h2>Enter the same listening moment.</h2>
          <p>Join by link or code. The host chooses the music; everyone else enters the same listening moment.</p>
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

      {openRooms.length === 0 ? (
        /* ── Empty state: centered action picker ───────────────────────── */
        <div className='rooms-empty-cta'>
          <div className='rooms-action-segs' role='group' aria-label='Room action'>
            <button
              className={'rooms-action-seg' + (action === 'start' ? ' is-on' : '')}
              type='button'
              onClick={() => setAction('start')}
              aria-pressed={action === 'start'}
            >
              <SvgBroadcast size={15} />
              Start a room
            </button>
            <button
              className={'rooms-action-seg' + (action === 'join' ? ' is-on' : '')}
              type='button'
              onClick={() => setAction('join')}
              aria-pressed={action === 'join'}
            >
              <SvgHeadphones size={15} />
              Join a room
            </button>
          </div>

          {action === 'start' ? (
            <div className='rooms-empty-panel'>
              <p>Pick a track, open the room, copy the link. Anyone can join — no wallet, no sign-up.</p>
              <button className='primary-action wide' type='button' onClick={onStartRoom} disabled={sessionAction !== 'idle'}>
                <SvgBroadcast size={16} />
                Open room
              </button>
            </div>
          ) : (
            <div className='rooms-empty-panel'>
              <p>Paste a room code or link you received.</p>
              <form className='session-form' onSubmit={onJoinSession}>
                <input
                  className='field code-field'
                  value={joinCode}
                  onChange={event => onSetJoinCode(event.target.value.toUpperCase())}
                  placeholder='ABC123'
                  maxLength={12}
                  aria-label='Room code'
                  autoFocus
                />
                <button className='primary-action wide' type='submit' disabled={sessionAction !== 'idle'}>
                  {isJoining ? <SvgSpinner size={16} /> : <SvgHeadphones size={16} />}
                  {isJoining ? 'Joining...' : 'Join room'}
                </button>
              </form>
            </div>
          )}

          <button className='rooms-empty-refresh' type='button' onClick={onRefreshRooms} disabled={isRefreshingRooms}>
            <SvgRefresh size={14} spinning={isRefreshingRooms} />
            {isRefreshingRooms ? 'Refreshing...' : 'Refresh rooms'}
          </button>
        </div>
      ) : (
        /* ── Rooms present: board layout ───────────────────────────────── */
        <div className='rooms-board'>
          <div className='doc-panel rooms-live-panel'>
            <div className='panel-title'>
              <span className='panel-title-icon'><SvgBroadcast size={15} /></span>
              <span className='panel-title-text'>Happening now</span>
              <span className='panel-title-meta'>{openRooms.length} open</span>
            </div>
            <div className='room-card-grid'>
              {openRooms.map(room => (
                <button
                  className='room-live-card'
                  type='button'
                  key={room.roomId}
                  onClick={() => onJoinRoom(room.roomId)}
                  disabled={sessionAction !== 'idle'}
                >
                  <span className='room-live-art' aria-hidden='true'>
                    {room.track?.imageRef && <img src={room.track.imageRef} alt='' crossOrigin='anonymous' />}
                  </span>
                  <span className='room-live-main'>
                    <span className='room-live-kicker'>
                      <span className='live-dot' />
                      {room.hostName} hosts
                    </span>
                    <strong>
                      {room.track?.title ?? 'Audio session'}
                      {room.playbackMode === 'preview' && <em className='room-preview-chip'> preview</em>}
                    </strong>
                    <span className='home-room-presence'>
                      <AvatarStack names={roomPresenceNames(room.hostName, room.listenerCount, room.roomId)} max={4} size={24} />
                      <small>{room.listenerCount + 1} listening</small>
                    </span>
                  </span>
                  <span className='room-live-side'>
                    <code>{room.roomId}</code>
                    <span>
                      {isJoining ? <SvgSpinner size={16} /> : <SvgHeadphones size={16} />}
                      {isJoining ? 'Joining...' : 'Join'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <aside className='doc-panel rooms-join-panel'>
            <div className='rooms-start-section'>
              <strong>Host a room</strong>
              <p>Pick a track, open the room, share the link.</p>
              <button className='primary-action' type='button' onClick={onStartRoom} disabled={sessionAction !== 'idle'}>
                <SvgBroadcast size={16} />
                Start a room
              </button>
            </div>

            <div className='rooms-section-divider' />

            <p className='rooms-join-label'>Join by code</p>
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
                {isJoining ? <SvgSpinner size={16} /> : <SvgHeadphones size={16} />}
                {isJoining ? 'Joining...' : 'Join room'}
              </button>
            </form>
            <button className='secondary-action' type='button' onClick={onRefreshRooms} disabled={isRefreshingRooms}>
              <SvgRefresh size={15} spinning={isRefreshingRooms} />
              {isRefreshingRooms ? 'Refreshing...' : 'Refresh rooms'}
            </button>
            <div className='rooms-doctrine-card'>
              <SvgKey size={16} />
              <div>
                <strong>Host-led rooms</strong>
                <span>The host opens the room and keeps the music moving for everyone inside.</span>
              </div>
            </div>
            <div className='rooms-doctrine-card'>
              <SvgUsers size={16} />
              <div>
                <strong>One shared door</strong>
                <span>A room should feel as simple as entering through a shared link.</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
