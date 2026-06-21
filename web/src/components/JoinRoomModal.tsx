import { Disc3, Headphones, X } from 'lucide-react';
import { Dialog } from './Dialog';
import type { SessionAction } from '../types';

type JoinRoomModalProps = {
  displayName: string;
  joinCode: string;
  sessionAction: SessionAction;
  onSetDisplayName: (name: string) => void;
  onSetJoinCode: (code: string) => void;
  onJoin: (code: string) => void;
  onClose: () => void;
};

export function JoinRoomModal({ displayName, joinCode, sessionAction, onSetDisplayName, onSetJoinCode, onJoin, onClose }: JoinRoomModalProps) {
  const isJoining = sessionAction === 'joining';

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (joinCode.trim()) onJoin(joinCode);
  }

  return (
    <Dialog className='join-room-modal' labelledBy='join-room-title' onClose={onClose}>
      <div className='modal-header'>
        <div className='modal-icon'>
          <Headphones size={20} />
        </div>
        <button className='modal-close' type='button' onClick={onClose} aria-label='Close'>
          <X size={16} />
        </button>
      </div>
      <div className='modal-copy'>
        <p className='modal-eyebrow'>Join a room</p>
        <h2 id='join-room-title'>Enter the same listening moment</h2>
        <p>Paste a room code or link. No wallet, no sign-up - just listen.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <label className='create-room-label' htmlFor='join-room-name'>Your name in the room</label>
        <input
          id='join-room-name'
          className='field'
          value={displayName}
          onChange={event => onSetDisplayName(event.target.value)}
          placeholder='How should people see you?'
          maxLength={32}
          autoComplete='nickname'
        />

        <label className='create-room-label' htmlFor='join-room-code'>Room code</label>
        <input
          id='join-room-code'
          className='field code-field'
          value={joinCode}
          onChange={event => onSetJoinCode(event.target.value.toUpperCase())}
          placeholder='ABC123'
          maxLength={12}
          autoComplete='off'
          autoFocus
        />

        <div className='create-room-actions'>
          <button className='primary-action wide' type='submit' disabled={isJoining || !joinCode.trim()}>
            {isJoining ? <Disc3 size={16} className='spin' /> : <Headphones size={16} />}
            {isJoining ? 'Joining...' : 'Join room'}
          </button>
          <button className='secondary-action' type='button' onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}
