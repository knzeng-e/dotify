import { X } from 'lucide-react';
import { CoverImage } from './CoverImage';
import { Dialog } from './Dialog';
import { catalogAccessLabel } from '../shared/utils/format';
import type { CatalogTrack } from '../shared/types';

export function RoomReleaseDialog({
  track,
  hostName,
  nativePaymentSymbol,
  onClose,
  onLeaveAndOpen
}: {
  track: CatalogTrack;
  hostName: string;
  nativePaymentSymbol: string;
  onClose: () => void;
  onLeaveAndOpen: () => void;
}) {
  return (
    <Dialog labelledBy='room-release-title' describedBy='room-release-context' onClose={onClose}>
      <div className='modal-header'>
        <span className='modal-eyebrow'>Release details</span>
        <button className='modal-close' type='button' onClick={onClose} aria-label='Close release details'>
          <X size={18} />
        </button>
      </div>
      <div className='room-release-preview'>
        <CoverImage src={track.imageRef} alt='' fallbackLabel={track.title} />
        <div>
          <h2 id='room-release-title'>{track.title}</h2>
          <p>{track.artist}</p>
          <p className='room-release-terms'>{catalogAccessLabel(track, nativePaymentSymbol)}</p>
        </div>
      </div>
      {track.description && <p className='room-release-description'>{track.description}</p>}
      <p id='room-release-context' className='room-release-description'>
        You’re listening with {hostName || 'the host'}. Leave the room to open this release on your own.
      </p>
      <div className='modal-actions'>
        <button className='secondary-action' type='button' onClick={onClose}>
          Stay in room
        </button>
        <button className='primary-action' type='button' onClick={onLeaveAndOpen}>
          Leave and open release
        </button>
      </div>
    </Dialog>
  );
}
