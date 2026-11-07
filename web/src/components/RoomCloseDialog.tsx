import { ListeningSheet } from './ListeningSheet';

export function RoomCloseDialog({
  isHost,
  listenerCount,
  onConfirm,
  onStop,
  onCancel
}: {
  isHost: boolean;
  listenerCount: number;
  onConfirm: () => void;
  onStop?: () => void;
  onCancel: () => void;
}) {
  return (
    <ListeningSheet
      initialFocus='dialog'
      className='room-close-dialog'
      labelledBy='room-close-title'
      describedBy='room-close-copy'
      onClose={onCancel}
      handleLabel='Collapse exit confirmation'
    >
      {close => (
        <>
          <div className='modal-copy'>
            <h2 id='room-close-title'>{isHost ? 'Close this room?' : 'Leave this room?'}</h2>
            <p id='room-close-copy'>
              {isHost
                ? listenerCount > 0
                  ? `${listenerCount === 1 ? '1 person is' : `${listenerCount} people are`} listening with you. Closing ends the room for everyone. Your music will continue in solo.`
                  : 'Your room will close. Your music will continue in solo.'
                : 'Your audio will stop. Everyone else can keep listening.'}
            </p>
          </div>
          <div className='modal-actions'>
            <button className='primary-action' type='button' onClick={onConfirm}>
              {isHost ? 'Close room and keep listening' : 'Leave room'}
            </button>
            {isHost && onStop && (
              <button className='secondary-action' type='button' onClick={onStop}>
                Close room and stop
              </button>
            )}
            <button className='secondary-action' type='button' onClick={close}>
              Stay in room
            </button>
          </div>
        </>
      )}
    </ListeningSheet>
  );
}
