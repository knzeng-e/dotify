import { ArrowRight, Headphones, KeyRound, Link2, Radio, RefreshCw, Users, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { CoverImage } from '../components/CoverImage';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import { RoomDiscoveryRenderer } from '../components/RoomDiscoveryRenderer';
import { roomPresenceCount } from '../features/rooms/roomState';
import type { OpenRoom, SessionAction, SocketStatus } from '../shared/types';

type RoomsViewProps = {
  openRooms: OpenRoom[];
  joinCode: string;
  sessionAction: SessionAction;
  socketStatus: SocketStatus;
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
  socketStatus,
  isRefreshingRooms,
  onSetJoinCode,
  onJoinRoom,
  onJoinSession,
  onRefreshRooms,
  onStartRoom
}: RoomsViewProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const totalListening = openRooms.reduce((total, room) => total + roomPresenceCount(room.listenerCount, true), 0);
  const selectedRoom = selectedRoomId ? (openRooms.find(room => room.roomId === selectedRoomId) ?? null) : null;
  const isJoining = sessionAction === 'joining';
  const roomListStatus = getRoomListStatus(socketStatus, isRefreshingRooms);
  const roomSignalUnavailable = socketStatus === 'error' || socketStatus === 'offline';

  return (
    <section className='rooms-landing' aria-labelledby='rooms-title'>
      <header className='rooms-intro'>
        <div>
          <p className='eyebrow'>Listening rooms</p>
          <h1 id='rooms-title'>Live listening rooms.</h1>
        </div>
        <div className='rooms-intro-copy'>
          <p>Open a room from a track, or join with a code.</p>
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
            <span className='section-index'>Live</span>
            <h2 id='rooms-live-title'>Happening now</h2>
          </div>
          <button className='text-action' type='button' onClick={onRefreshRooms} disabled={isRefreshingRooms}>
            <RefreshCw size={15} className={isRefreshingRooms ? 'spin' : undefined} />
            {isRefreshingRooms ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        <p className='room-list-status' data-status={roomListStatus.tone}>
          {roomListStatus.label}
        </p>

        {openRooms.length > 0 ? (
          <div className='rooms-discovery-layout' data-has-selection={Boolean(selectedRoom)}>
            <div className='rooms-discovery-main'>
              <RoomDiscoveryRenderer
                rooms={openRooms}
                selectedRoomId={selectedRoom?.roomId}
                sessionAction={sessionAction}
                onSelectRoom={setSelectedRoomId}
                onJoinRoom={onJoinRoom}
              />

              <div className='room-card-grid'>
                {openRooms.map(room => {
                  const presence = roomPresenceCount(room.listenerCount, true);
                  const isSelected = selectedRoom?.roomId === room.roomId;
                  return (
                    <button
                      className='room-live-card'
                      type='button'
                      key={room.roomId}
                      data-selected={isSelected}
                      data-full={room.isFull === true}
                      onClick={() => setSelectedRoomId(room.roomId)}
                      aria-pressed={isSelected}
                      aria-label={`Inspect ${room.track?.title ?? 'live audio session'} hosted by ${room.hostName}`}
                    >
                      <span className='room-live-art' aria-hidden='true'>
                        {room.track?.imageRef ? <CoverImage src={room.track.imageRef} alt='' fallbackLabel={room.track.title} /> : <Radio size={24} />}
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
                          <small>{presence} here</small>
                        </span>
                      </span>
                      <span className='room-live-side'>
                        <code>{room.roomId}</code>
                        <span>
                          {isSelected ? 'Selected' : room.isFull ? 'Full' : 'Inspect'}
                          <ArrowRight size={15} />
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <RoomDetailsPanel
              room={selectedRoom}
              sessionAction={sessionAction}
              isRefreshingRooms={isRefreshingRooms}
              socketStatus={socketStatus}
              variant='panel'
              onJoinRoom={onJoinRoom}
            />

            {selectedRoom && (
              <RoomDetailsPanel
                room={selectedRoom}
                sessionAction={sessionAction}
                isRefreshingRooms={isRefreshingRooms}
                socketStatus={socketStatus}
                variant='sheet'
                onClose={() => setSelectedRoomId(null)}
                onJoinRoom={onJoinRoom}
              />
            )}
          </div>
        ) : (
          <div className='rooms-empty-state'>
            <span className='rooms-empty-signal' aria-hidden='true'>
              <i />
              <i />
              <i />
            </span>
            <div>
              <strong>{roomSignalUnavailable ? 'Room list is unavailable.' : 'No room is open right now.'}</strong>
              <p>{roomSignalUnavailable ? 'Refresh when the room signal is back.' : 'Choose a track and open a room.'}</p>
            </div>
            <button
              className='secondary-action'
              type='button'
              onClick={roomSignalUnavailable ? onRefreshRooms : onStartRoom}
              disabled={roomSignalUnavailable ? isRefreshingRooms : sessionAction !== 'idle'}
            >
              {roomSignalUnavailable ? <RefreshCw size={17} className={isRefreshingRooms ? 'spin' : undefined} /> : <Radio size={17} />}
              {roomSignalUnavailable ? 'Refresh rooms' : 'Open the first room'}
            </button>
          </div>
        )}
      </section>

      <section className='room-entry-section' aria-labelledby='room-entry-title'>
        <div className='section-heading'>
          <div>
            <span className='section-index'>Rooms</span>
            <h2 id='room-entry-title'>Start or join.</h2>
          </div>
        </div>

        <div className='room-entry-grid'>
          <article className='room-entry-card room-entry-create'>
            <span className='room-entry-icon'>
              <Radio size={21} />
            </span>
            <div>
              <span className='room-entry-label'>Host a listening room</span>
              <h3>Open a new room.</h3>
              <p>Choose music, name the room, share the link.</p>
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
              <span className='room-entry-label'>Join a room</span>
              <h3>Use the room code or link you received.</h3>
              <p>Enter with a room code or link.</p>
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

type RoomDetailsPanelProps = {
  room: OpenRoom | null;
  sessionAction: SessionAction;
  socketStatus: SocketStatus;
  isRefreshingRooms: boolean;
  variant: 'panel' | 'sheet';
  onClose?: () => void;
  onJoinRoom: (roomId: string) => void;
};

function RoomDetailsPanel({ room, sessionAction, socketStatus, isRefreshingRooms, variant, onClose, onJoinRoom }: RoomDetailsPanelProps) {
  const status = getRoomListStatus(socketStatus, isRefreshingRooms);
  const className = variant === 'sheet' ? 'room-detail room-detail-sheet' : 'room-detail room-detail-panel';

  if (!room) {
    return (
      <aside className={className} aria-label='Room details' data-testid='room-detail-panel'>
        <div className='room-detail-empty'>
          <span className='room-detail-icon' aria-hidden='true'>
            <Radio size={20} />
          </span>
          <p className='room-detail-kicker'>Select a room</p>
          <strong>Inspect the room before joining.</strong>
          <span>{status.label}</span>
        </div>
      </aside>
    );
  }

  const presence = roomPresenceCount(room.listenerCount, true);
  const joinDisabled = sessionAction !== 'idle' || room.isFull === true;
  const playbackLabel = room.playbackMode === 'preview' ? 'Preview stream' : 'Full stream';
  const joinLabel = room.isFull ? 'Room full' : sessionAction === 'joining' ? 'Joining' : 'Join room';

  return (
    <aside className={className} aria-label='Room details' data-testid={variant === 'sheet' ? 'room-detail-sheet' : 'room-detail-panel'}>
      {onClose && (
        <button className='room-detail-close' type='button' onClick={onClose} aria-label='Close room details'>
          <X size={18} />
        </button>
      )}

      <div className='room-detail-art' aria-hidden='true'>
        {room.track?.imageRef ? <CoverImage src={room.track.imageRef} alt='' fallbackLabel={room.track.title} /> : <Radio size={28} />}
      </div>

      <div className='room-detail-copy'>
        <p className='room-detail-kicker'>
          <span className='live-dot' />
          {room.hostName} hosts
        </p>
        <h3>{room.track?.title ?? 'Audio session'}</h3>
        <p>{room.track?.artist ?? 'Live on Dotify'}</p>
      </div>

      <dl className='room-detail-facts'>
        <div>
          <dt>Room</dt>
          <dd>{room.roomId}</dd>
        </div>
        <div>
          <dt>Presence</dt>
          <dd>{presence} here</dd>
        </div>
        <div>
          <dt>Stream</dt>
          <dd>{playbackLabel}</dd>
        </div>
      </dl>

      <div className='room-detail-state' data-status={room.isFull ? 'warning' : status.tone}>
        <span>{room.isFull ? 'Full' : status.label}</span>
      </div>

      <button className='primary-action room-detail-join' type='button' onClick={() => onJoinRoom(room.roomId)} disabled={joinDisabled}>
        <Headphones size={17} />
        {joinLabel}
      </button>
    </aside>
  );
}

function getRoomListStatus(socketStatus: SocketStatus, isRefreshingRooms: boolean) {
  if (isRefreshingRooms) return { label: 'Refreshing room list', tone: 'loading' as const };
  if (socketStatus === 'connecting') return { label: 'Reconnecting to rooms', tone: 'loading' as const };
  if (socketStatus === 'error') return { label: 'Room signal unavailable', tone: 'warning' as const };
  if (socketStatus === 'online') return { label: 'Room signal online', tone: 'ready' as const };
  return { label: 'Room signal offline', tone: 'warning' as const };
}
