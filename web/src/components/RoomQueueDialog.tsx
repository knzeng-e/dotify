import { X } from 'lucide-react';
import { ListeningSheet } from './ListeningSheet';
import { HostLineup } from './HostLineup';
import { RoomRequests } from './RoomRequests';

// Kept mounted for the room lifetime: dismissing never discards a suggestion draft.
export function RoomQueueDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ListeningSheet open={open} onClose={onClose} labelledBy='room-queue-title' className='room-queue-sheet' handleLabel='Collapse room queue'>
      {close => (
        <>
          <div className='modal-header'>
            <div>
              <span className='modal-eyebrow'>Listening together</span>
              <h2 id='room-queue-title'>Room queue</h2>
            </div>
            <button className='modal-close' type='button' onClick={close} aria-label='Close room queue'>
              <X size={18} />
            </button>
          </div>
          <p className='room-queue-intro'>The host shapes what plays next. Everyone can help discover it.</p>
          <HostLineup onPlayNext={onClose} />
          <RoomRequests />
        </>
      )}
    </ListeningSheet>
  );
}
