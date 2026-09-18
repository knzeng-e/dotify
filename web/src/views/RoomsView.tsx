import { roomExperienceFlags } from '../features/rooms/roomExperienceFlags';
import { ArrowRight, Box, Headphones, List, Radio, RefreshCw, Users, X } from 'lucide-react';
import type { FormEvent, Ref } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CoverImage } from '../components/CoverImage';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import { RoomDiscoveryRenderer, type RoomDiscoveryRendererKind } from '../components/RoomDiscoveryRenderer';
import { roomHostDisplayName, roomPresenceCount } from '../features/rooms/roomState';
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

const MOBILE_ROOM_DETAILS_QUERY = '(max-width: 48rem)';

function isMobileRoomDetailsLayout() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_ROOM_DETAILS_QUERY).matches;
}

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
  const [discoveryRenderer, setDiscoveryRenderer] = useState<RoomDiscoveryRendererKind>('sky-2d');
  const roomCardRefs = useRef(new Map<string, HTMLButtonElement>());
  const roomDetailsSheetRef = useRef<HTMLElement | null>(null);
  const selectedRoom = selectedRoomId ? (openRooms.find(room => room.roomId === selectedRoomId) ?? null) : null;
  const isJoining = sessionAction === 'joining';
  const roomListStatus = getRoomListStatus(socketStatus, isRefreshingRooms);
  const roomSignalUnavailable = socketStatus === 'error' || socketStatus === 'offline';
  const setRoomCardRef = useCallback((roomId: string, element: HTMLButtonElement | null) => {
    if (element) {
      roomCardRefs.current.set(roomId, element);
      return;
    }
    roomCardRefs.current.delete(roomId);
  }, []);
  const selectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
  }, []);
  const closeSelectedRoom = useCallback(() => {
    const restoreTarget = selectedRoomId ? roomCardRefs.current.get(selectedRoomId) : null;
    setSelectedRoomId(null);
    if (!restoreTarget || !isMobileRoomDetailsLayout()) return;
    window.requestAnimationFrame(() => {
      if (restoreTarget.isConnected) restoreTarget.focus({ preventScroll: true });
    });
  }, [selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId || !isMobileRoomDetailsLayout()) return;
    const sheet = roomDetailsSheetRef.current;
    if (!sheet) return;

    const frame = window.requestAnimationFrame(() => {
      if (!sheet.isConnected || !isMobileRoomDetailsLayout()) return;
      if (document.activeElement instanceof HTMLElement && sheet.contains(document.activeElement)) return;
      const focusTarget = sheet.querySelector<HTMLElement>('.room-detail-close:not([disabled]), .room-detail-join:not([disabled])') ?? sheet;
      focusTarget.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedRoomId]);

  return (
    <section className='rooms-landing rooms-landing-focused' aria-labelledby='rooms-title'>
      <header className='rooms-intro'>
        <div>
          <p className='eyebrow'>Listening rooms</p>
          <h1 id='rooms-title'>Live listening rooms.</h1>
          <p className='rooms-intro-copy'>Open a room from a track, or join with a code.</p>
        </div>
      </header>

      <section className='room-arrival' aria-label='Join or host a room'>
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
        <button className='secondary-action' type='button' onClick={onStartRoom} disabled={sessionAction !== 'idle'}>
          <Radio size={18} /> Open a room
        </button>
      </section>

      <section className='rooms-live-section' aria-labelledby='rooms-live-title'>
        <div className='section-heading'>
          <div>
            <h2 id='rooms-live-title'>Happening now</h2>
          </div>
          <div className='room-section-actions'>
            {roomExperienceFlags.galaxy && openRooms.length > 0 && (
              <div className='room-renderer-switch' role='group' aria-label='Room discovery view'>
                <button
                  type='button'
                  data-active={discoveryRenderer === 'galaxy-3d'}
                  aria-pressed={discoveryRenderer === 'galaxy-3d'}
                  onClick={() => setDiscoveryRenderer('galaxy-3d')}
                >
                  <Box size={15} />
                  3D
                </button>
                <button
                  type='button'
                  data-active={discoveryRenderer === 'sky-2d'}
                  aria-pressed={discoveryRenderer === 'sky-2d'}
                  onClick={() => setDiscoveryRenderer('sky-2d')}
                >
                  <List size={15} />
                  2D
                </button>
              </div>
            )}
            {roomSignalUnavailable && (
              <button className='text-action' type='button' onClick={onRefreshRooms} disabled={isRefreshingRooms}>
                <RefreshCw size={15} className={isRefreshingRooms ? 'spin' : undefined} />
                {isRefreshingRooms ? 'Reconnecting' : 'Try again'}
              </button>
            )}
          </div>
        </div>

        {roomListStatus.tone !== 'ready' && (
          <p className='room-list-status' role='status' data-status={roomListStatus.tone}>
            {roomListStatus.label}
          </p>
        )}

        {openRooms.length > 0 ? (
          <div className='rooms-discovery-layout' data-has-selection={Boolean(selectedRoom)}>
            <div className='rooms-discovery-main'>
              <RoomDiscoveryRenderer
                renderer={discoveryRenderer}
                rooms={openRooms}
                selectedRoomId={selectedRoom?.roomId}
                sessionAction={sessionAction}
                onSelectRoom={selectRoom}
                onJoinRoom={onJoinRoom}
              />

              <div className='room-card-grid'>
                {openRooms.map(room => {
                  const presence = roomPresenceCount(room.listenerCount, true);
                  const hostDisplayName = roomHostDisplayName(room.hostName);
                  const isSelected = selectedRoom?.roomId === room.roomId;
                  return (
                    <button
                      className='room-live-card'
                      type='button'
                      key={room.roomId}
                      ref={element => setRoomCardRef(room.roomId, element)}
                      data-selected={isSelected}
                      data-full={room.isFull === true}
                      onClick={() => selectRoom(room.roomId)}
                      aria-pressed={isSelected}
                      aria-label={
                        hostDisplayName
                          ? `Inspect ${room.track?.title ?? 'live audio session'} hosted by ${hostDisplayName}`
                          : `Inspect ${room.track?.title ?? 'live audio session'}`
                      }
                    >
                      <span className='room-live-art' aria-hidden='true'>
                        {room.track?.imageRef ? <CoverImage src={room.track.imageRef} alt='' fallbackLabel={room.track.title} /> : <Radio size={24} />}
                      </span>
                      <span className='room-live-main'>
                        <span className='room-live-kicker'>
                          <span className='live-dot' data-online={socketStatus === 'online'} aria-hidden='true' />
                          {hostDisplayName ? `${hostDisplayName} hosts` : 'Live listening room'}
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
                panelRef={roomDetailsSheetRef}
                onClose={closeSelectedRoom}
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
              <strong>
                {roomSignalUnavailable ? 'Room list is unavailable.' : roomListStatus.tone === 'loading' ? 'Finding rooms…' : 'No room is open right now.'}
              </strong>
              <p>
                {roomSignalUnavailable
                  ? 'Refresh when the room signal is back.'
                  : roomListStatus.tone === 'loading'
                    ? 'Looking for people to listen with.'
                    : 'Open a room above, choose music, and share the link.'}
              </p>
            </div>
            {roomSignalUnavailable && (
              <button
                className='secondary-action'
                type='button'
                onClick={roomSignalUnavailable ? onRefreshRooms : onStartRoom}
                disabled={roomSignalUnavailable ? isRefreshingRooms : sessionAction !== 'idle'}
              >
                {roomSignalUnavailable ? <RefreshCw size={17} className={isRefreshingRooms ? 'spin' : undefined} /> : <Radio size={17} />}
                {roomSignalUnavailable ? 'Refresh rooms' : 'Open the first room'}
              </button>
            )}
          </div>
        )}
      </section>
    </section>
  );
}

type RoomDetailsPanelProps = {
  room: OpenRoom | null;
  sessionAction: SessionAction;
  socketStatus: SocketStatus;
  isRefreshingRooms: boolean;
  variant: 'panel' | 'sheet';
  panelRef?: Ref<HTMLElement>;
  onClose?: () => void;
  onJoinRoom: (roomId: string) => void;
};

function RoomDetailsPanel({ room, sessionAction, socketStatus, isRefreshingRooms, variant, panelRef, onClose, onJoinRoom }: RoomDetailsPanelProps) {
  const status = getRoomListStatus(socketStatus, isRefreshingRooms);
  const className = variant === 'sheet' ? 'room-detail room-detail-sheet' : 'room-detail room-detail-panel';

  if (!room) {
    return (
      <aside ref={panelRef} className={className} aria-label='Room details' data-testid='room-detail-panel' tabIndex={variant === 'sheet' ? -1 : undefined}>
        <div className='room-detail-empty'>
          <span className='room-detail-icon' aria-hidden='true'>
            <Radio size={20} />
          </span>
          <p className='room-detail-kicker'>Select a room</p>
          <strong>Inspect the room before joining.</strong>
          {status.tone !== 'ready' && <span role='status'>{status.label}</span>}
        </div>
      </aside>
    );
  }

  const presence = roomPresenceCount(room.listenerCount, true);
  const hostDisplayName = roomHostDisplayName(room.hostName);
  const joinDisabled = sessionAction !== 'idle' || room.isFull === true;
  const joinLabel = room.isFull ? 'Room full' : sessionAction === 'joining' ? 'Joining' : 'Join room';

  return (
    <aside
      ref={panelRef}
      className={className}
      aria-label='Room details'
      data-testid={variant === 'sheet' ? 'room-detail-sheet' : 'room-detail-panel'}
      tabIndex={variant === 'sheet' ? -1 : undefined}
    >
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
          <span className='live-dot' data-online={socketStatus === 'online'} aria-hidden='true' />
          {hostDisplayName ? `${hostDisplayName} hosts` : 'Live listening room'}
        </p>
        <h3>{room.track?.title ?? 'Audio session'}</h3>
        <p>{room.track?.artist ?? 'Live on Dotify'}</p>
      </div>

      <p className='room-detail-presence'>
        <Users size={18} aria-hidden='true' /> {presence} listening
        {room.playbackMode === 'preview' && <span> · Preview</span>}
      </p>
      {status.tone !== 'ready' && (
        <p className='room-detail-state' role='status' data-status={status.tone}>
          {status.label}
        </p>
      )}

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
  if (socketStatus === 'error') return { label: 'Cannot load rooms. Try refreshing.', tone: 'warning' as const };
  if (socketStatus === 'online') return { label: 'Rooms available', tone: 'ready' as const };
  return { label: 'Connection lost. Trying to reconnect…', tone: 'warning' as const };
}
