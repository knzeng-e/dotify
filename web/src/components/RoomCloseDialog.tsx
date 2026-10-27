import { Dialog } from './Dialog';

export function RoomCloseDialog({
  isHost,
  listenerCount,
  onConfirm,
  onCancel
}: {
  isHost: boolean;
  listenerCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog className='room-close-dialog' size='compact' labelledBy='room-close-title' describedBy='room-close-copy' onClose={onCancel}>
      <div className='modal-copy'>
        <h2 id='room-close-title'>{isHost ? 'Close this room?' : 'Leave this room?'}</h2>
        <p id='room-close-copy'>
          {isHost
            ? listenerCount > 0
              ? `${listenerCount === 1 ? '1 person is' : `${listenerCount} people are`} listening with you. Closing ends the room for everyone.`
              : 'Closing ends your room and stops the audio.'
            : 'Your audio will stop. Everyone else can keep listening.'}
        </p>
      </div>
      <div className='modal-actions'>
        <button className='primary-action' type='button' onClick={onConfirm}>
          {isHost ? 'Close for everyone' : 'Leave room'}
        </button>
        <button className='secondary-action' type='button' onClick={onCancel}>
          Keep listening
        </button>
      </div>
    </Dialog>
  );
}
