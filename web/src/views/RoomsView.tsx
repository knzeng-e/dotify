import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import { SkyOfRooms } from '../components/SkyOfRooms';
import { roomPresenceCount } from '../features/rooms/roomState';
import type { OpenRoom, SessionAction } from '../shared/types';

// ── Inline SVG icons ────────────────────────────────────────────────────────
function SvgBroadcast({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M4.9 19.1C1 15.2 1 8.8 4.9 4.9' />
      <path d='M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5' />
      <circle cx='12' cy='12' r='2' />
      <path d='M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5' />
      <path d='M19.1 4.9C23 8.8 23 15.1 19.1 19' />
    </svg>
  );
}
function SvgHeadphones({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M3 18v-6a9 9 0 0 1 18 0v6' />
      <path d='M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z' />
      <path d='M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z' />
    </svg>
  );
}
function SvgRefresh({ size, spinning }: { size: number; spinning?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      className={spinning ? 'spin' : ''}
    >
      <polyline points='23 4 23 10 17 10' />
      <polyline points='1 20 1 14 7 14' />
      <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' />
    </svg>
  );
}
function SvgSpinner({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      className='spin'
    >
      <path d='M21 12a9 9 0 1 1-6.219-8.56' />
    </svg>
  );
}
function SvgKey({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <circle cx='7.5' cy='15.5' r='5.5' />
      <path d='M21 2l-9.6 9.6' />
      <path d='M15.5 7.5l3 3L22 7l-3-3' />
    </svg>
  );
}
function SvgUsers({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
      <circle cx='9' cy='7' r='4' />
      <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
      <path d='M16 3.13a4 4 0 0 1 0 7.75' />
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

type RoomAction = 'start' | 'join';

const ROOM_ACTIONS: Array<{ value: RoomAction; label: string }> = [
  { value: 'start', label: 'Start a room' },
  { value: 'join', label: 'Join an existing room' }
];

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
  const [action, setAction] = useState<RoomAction>('start');
  const [isActionPickerOpen, setIsActionPickerOpen] = useState(false);
  const actionPickerRef = useRef<HTMLDivElement | null>(null);
  const totalListening = openRooms.reduce((total, room) => total + roomPresenceCount(room.listenerCount, true), 0);
  const isJoining = sessionAction === 'joining';
  const selectedAction = ROOM_ACTIONS.find(item => item.value === action) ?? ROOM_ACTIONS[0];

  useEffect(() => {
    if (!isActionPickerOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (!actionPickerRef.current?.contains(event.target as Node)) {
        setIsActionPickerOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsActionPickerOpen(false);
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isActionPickerOpen]);

  const renderActionPicker = (id: string) => (
    <div className='rooms-action-picker' ref={actionPickerRef}>
      <span id={`${id}-label`}>What do you want to do?</span>
      <button
        id={`${id}-button`}
        className='rooms-action-select'
        type='button'
        aria-haspopup='listbox'
        aria-expanded={isActionPickerOpen}
        aria-controls={`${id}-menu`}
        aria-labelledby={`${id}-label ${id}-button`}
        onClick={() => setIsActionPickerOpen(open => !open)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setIsActionPickerOpen(true);
          }
        }}
      >
        <span>{selectedAction.label}</span>
        <i aria-hidden='true' />
      </button>
      {isActionPickerOpen && (
        <div className='rooms-action-menu' id={`${id}-menu`} role='listbox' aria-labelledby={`${id}-label`}>
          {ROOM_ACTIONS.map(item => (
            <div
              key={item.value}
              role='option'
              tabIndex={0}
              aria-selected={item.value === action}
              onClick={() => {
                setAction(item.value);
                setIsActionPickerOpen(false);
              }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setAction(item.value);
                  setIsActionPickerOpen(false);
                }
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderActionPanel = (variant: 'empty' | 'side') => (
    <div className={variant === 'empty' ? 'rooms-empty-panel' : 'rooms-inline-panel'}>
      {action === 'start' ? (
        <>
          <p>Pick a track, open the room, and share the link.</p>
          <div className='room-action-body room-action-body-start'>
            <button className='primary-action wide room-action-submit' type='button' onClick={onStartRoom} disabled={sessionAction !== 'idle'}>
              <SvgBroadcast size={16} />
              Open room
            </button>
          </div>
        </>
      ) : (
        <>
          <p>Paste the room code or link you received.</p>
          <form className='session-form room-action-form room-action-body' onSubmit={onJoinSession}>
            <input
              className='field code-field room-action-field'
              value={joinCode}
              onChange={event => onSetJoinCode(event.target.value)}
              placeholder='ABC123 or room link'
              maxLength={140}
              aria-label='Room code or room link'
              autoFocus={variant === 'empty'}
            />
            <button className='primary-action wide room-action-submit' type='submit' disabled={sessionAction !== 'idle'}>
              {isJoining ? <SvgSpinner size={16} /> : <SvgHeadphones size={16} />}
              {isJoining ? 'Joining...' : 'Join room'}
            </button>
          </form>
        </>
      )}
    </div>
  );

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
          <div className='rooms-action-stack'>
            {renderActionPicker('rooms-empty-action')}
            {renderActionPanel('empty')}
          </div>

          <button className='rooms-empty-refresh' type='button' onClick={onRefreshRooms} disabled={isRefreshingRooms}>
            <SvgRefresh size={14} spinning={isRefreshingRooms} />
            {isRefreshingRooms ? 'Refreshing...' : 'Refresh rooms'}
          </button>
        </div>
      ) : (
        /* ── Rooms present: the Sky (Constellation phase B hero) above the
              board. On mobile and reduced motion the sky is hidden by CSS and
              the card grid below remains the full experience. ───────────── */
        <>
          <SkyOfRooms rooms={openRooms} sessionAction={sessionAction} onJoinRoom={onJoinRoom} />
          <div className='rooms-board'>
            <div className='doc-panel rooms-live-panel'>
              <div className='panel-title'>
                <span className='panel-title-icon'>
                  <SvgBroadcast size={15} />
                </span>
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
                        <small>{roomPresenceCount(room.listenerCount, true)} listening</small>
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
              <div className='rooms-action-stack'>
                {renderActionPicker('rooms-side-action')}
                {renderActionPanel('side')}
              </div>
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
        </>
      )}
    </section>
  );
}
