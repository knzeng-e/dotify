import { Disc3, Headphones, Radio, Users, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { Dialog } from './Dialog';
import { CoverImage } from './CoverImage';
import { AvatarStack, roomPresenceNames } from './Presence';
import { isChosenDisplayName } from '../features/identity/walletIdentity';
import { roomPresenceCount } from '../features/rooms/roomState';
import type { OpenRoom, SessionAction } from '../shared/types';

type JoinRoomModalProps = {
  displayName: string;
  joinCode: string;
  room?: OpenRoom;
  thresholdState?: 'idle' | 'resolving' | 'ready' | 'unavailable';
  sessionAction: SessionAction;
  onSetDisplayName: (name: string) => void;
  onSetJoinCode: (code: string) => void;
  onJoin: (code: string) => void;
  onClose: () => void;
};

export function JoinRoomModal({
  displayName,
  joinCode,
  room,
  thresholdState = 'idle',
  sessionAction,
  onSetDisplayName,
  onSetJoinCode,
  onJoin,
  onClose
}: JoinRoomModalProps) {
  const isJoining = sessionAction === 'joining';
  const isResolving = thresholdState === 'resolving';
  const isUnavailable = thresholdState === 'unavailable';
  const isThreshold = Boolean(room) || isResolving || isUnavailable;
  const hasChosenName = isChosenDisplayName(displayName);
  const hasPrefilledCode = Boolean(joinCode.trim());
  const roomTrack = room?.track;
  const peopleHere = room ? roomPresenceCount(room.listenerCount, true) : 0;
  const displayedRoomCode = room?.roomId ?? joinCode.trim().toUpperCase();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isResolving && !isUnavailable && joinCode.trim() && hasChosenName) onJoin(joinCode.trim());
  }

  const eyebrow = room ? 'A live room is open' : isResolving ? 'Opening the threshold' : isUnavailable ? 'Room unavailable' : 'Join a room';
  const title = room
    ? `${room.hostName} welcomes you`
    : isResolving
      ? 'Finding this room'
      : isUnavailable
        ? 'This room is unavailable'
        : 'Enter the same listening moment';
  const description = room
    ? `${peopleHere} ${peopleHere === 1 ? 'person is' : 'people are'} here. Choose a room name, then enter with no account or wallet.`
    : isResolving
      ? 'Loading the host, work, and live presence before you enter.'
      : isUnavailable
        ? 'This listening moment may have ended, expired, or cannot be reached right now.'
        : 'Paste a room code or link. No wallet, no sign-up - just listen.';

  return (
    <Dialog className='join-room-modal' labelledBy='join-room-title' describedBy='join-room-description' onClose={onClose}>
      <div className='modal-header'>
        <div className='modal-icon'>{isThreshold ? <Radio size={20} /> : <Headphones size={20} />}</div>
        <button className='modal-close' type='button' onClick={onClose} aria-label='Close'>
          <X size={16} />
        </button>
      </div>
      <div className='modal-copy'>
        <p className='modal-eyebrow'>{eyebrow}</p>
        <h2 id='join-room-title'>{title}</h2>
        <p id='join-room-description' aria-live='polite'>
          {description}
        </p>
      </div>

      {room && (
        <section className='room-threshold-preview' aria-label={`Room hosted by ${room.hostName}`}>
          <div className='room-threshold-art' aria-hidden='true'>
            {roomTrack?.imageRef ? <CoverImage src={roomTrack.imageRef} alt='' /> : <Disc3 size={40} />}
          </div>
          <div className='room-threshold-copy'>
            <span className='room-threshold-live'>
              <i aria-hidden='true' /> Live now
            </span>
            <strong>{roomTrack?.title ?? 'A shared listening moment'}</strong>
            <span>{roomTrack?.artist ?? `${room.hostName}'s room`}</span>
            <span className='room-threshold-presence'>
              <AvatarStack names={roomPresenceNames(room.hostName, room.listenerCount, room.roomId)} max={4} size={26} />
              <span>
                <Users size={14} aria-hidden='true' /> {peopleHere} here
              </span>
            </span>
          </div>
        </section>
      )}

      <form onSubmit={handleSubmit} aria-describedby='join-room-description' aria-busy={isResolving}>
        {!isUnavailable && (
          <>
            <label className='create-room-label' htmlFor='join-room-name'>
              Your name in the room
            </label>
            <input
              id='join-room-name'
              className='field'
              value={displayName}
              onChange={event => onSetDisplayName(event.target.value)}
              placeholder='How should people see you?'
              maxLength={32}
              autoComplete='nickname'
              autoFocus={hasPrefilledCode}
            />
          </>
        )}

        {isThreshold ? (
          <div className='room-threshold-code' aria-label={`Room code ${displayedRoomCode}`}>
            <span>Room code</span>
            <code>{displayedRoomCode}</code>
          </div>
        ) : (
          <>
            <label className='create-room-label' htmlFor='join-room-code'>
              Room code
            </label>
            <input
              id='join-room-code'
              className='field code-field'
              value={joinCode}
              onChange={event => onSetJoinCode(event.target.value.toUpperCase())}
              placeholder='ABC123'
              maxLength={12}
              autoComplete='off'
              autoFocus={!hasPrefilledCode}
            />
          </>
        )}

        <div className='create-room-actions'>
          <button className='primary-action wide' type='submit' disabled={isJoining || isResolving || isUnavailable || !joinCode.trim() || !hasChosenName}>
            {isJoining || isResolving ? <Disc3 size={16} className='spin' /> : <Headphones size={16} />}
            {isJoining ? 'Entering...' : isResolving ? 'Finding room...' : isUnavailable ? 'Room unavailable' : room ? 'Enter and listen' : 'Join room'}
          </button>
          <button className='secondary-action' type='button' onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
      {room && <p className='room-threshold-footnote'>The host opens the music. Guests receive only the live room stream.</p>}
    </Dialog>
  );
}
