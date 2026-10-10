import { Copy, QrCode, Share2, X } from 'lucide-react';
import { Dialog } from './Dialog';
import { RoomQrCode } from './RoomQrCode';

export function RoomShareDialog({
  roomId,
  link,
  status,
  onCopy,
  onShare,
  onProject,
  onClose
}: {
  roomId: string;
  link: string;
  status: string;
  onCopy: () => void;
  onShare: () => void;
  onProject?: () => void;
  onClose: () => void;
}) {
  const feedback = ['Link copied', 'Copy unavailable', 'Invite shared'].includes(status) ? status : '';
  return (
    <Dialog historyDismiss className='room-share-dialog' labelledBy='room-share-title' size='compact' onClose={onClose}>
      <div className='modal-header'>
        <h2 id='room-share-title'>Listen together</h2>
        <button className='modal-close' type='button' onClick={onClose} aria-label='Close room sharing'>
          <X size={18} />
        </button>
      </div>
      <RoomQrCode value={link} label={`QR code for room ${roomId}`} asLink={false} />
      <dl className='transaction-facts'>
        <div>
          <dt>Room code</dt>
          <dd data-testid='shared-room-code'>{roomId}</dd>
        </div>
      </dl>
      <a className='room-share-link' href={link}>
        {link}
      </a>
      <div className='modal-actions'>
        <button className='primary-action' type='button' onClick={onCopy}>
          <Copy size={18} /> Copy link
        </button>
        {typeof navigator.share === 'function' && (
          <button className='secondary-action' type='button' onClick={onShare}>
            <Share2 size={18} /> Share
          </button>
        )}
        {onProject && (
          <button className='secondary-action' type='button' onClick={onProject}>
            <QrCode size={18} /> Enlarge QR
          </button>
        )}
      </div>
      {feedback && <p role='status'>{feedback === 'Copy unavailable' ? 'Copy unavailable. Select the link above to share it.' : feedback}</p>}
    </Dialog>
  );
}
