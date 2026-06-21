import { CircleAlert, CircleCheckBig, Disc3, X } from 'lucide-react';
import { Dialog } from './Dialog';
import type { TransactionFeedback } from '../types';
import { getBlockscoutTxUrl } from '../utils/explorer';
import { shorten } from '../utils/format';

export function TransactionModal({ feedback, onClose }: { feedback: TransactionFeedback; onClose: () => void }) {
  const dismissible = feedback.tone !== 'pending';
  const Icon = feedback.tone === 'pending' ? Disc3 : feedback.tone === 'success' ? CircleCheckBig : CircleAlert;

  return (
    <Dialog labelledBy='transaction-modal-title' dismissible={dismissible} tone={feedback.tone} onClose={onClose}>
      <div className='modal-header'>
        <div className='modal-icon' data-tone={feedback.tone}>
          <Icon size={20} className={feedback.tone === 'pending' ? 'spin' : undefined} />
        </div>
        {dismissible && (
          <button className='modal-close' type='button' onClick={onClose} aria-label='Close transaction feedback'>
            <X size={16} />
          </button>
        )}
      </div>
      <div className='modal-copy'>
        <p className='modal-eyebrow'>{feedback.tone === 'pending' ? 'In progress' : feedback.tone === 'success' ? 'Confirmed' : 'Attention'}</p>
        <h2 id='transaction-modal-title'>{feedback.title}</h2>
        <p>{feedback.message}</p>
      </div>
      {feedback.txHash && (
        <div className='modal-hash'>
          <span>Transaction hash</span>
          <code>{shorten(feedback.txHash, 12)}</code>
          <a className='modal-link' href={getBlockscoutTxUrl(feedback.txHash)} target='_blank' rel='noreferrer'>
            Don't trust. Verify on Blockscout.
          </a>
        </div>
      )}
      {dismissible && (
        <div className='modal-actions'>
          <button className='modal-action' type='button' onClick={onClose}>
            Close
          </button>
        </div>
      )}
    </Dialog>
  );
}
