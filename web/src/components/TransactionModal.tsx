import { CircleAlert, CircleCheckBig, Disc3, X } from 'lucide-react';
import type { TransactionFeedback } from '../types';
import { shorten } from '../utils/format';

const blockscoutBaseUrl = 'https://blockscout-testnet.polkadot.io';

function getBlockscoutTxUrl(txHash: `0x${string}`) {
  return `${blockscoutBaseUrl}/tx/${txHash}`;
}

export function TransactionModal({ feedback, onClose }: { feedback: TransactionFeedback; onClose: () => void }) {
  const dismissible = feedback.tone !== 'pending';
  const Icon = feedback.tone === 'pending' ? Disc3 : feedback.tone === 'success' ? CircleCheckBig : CircleAlert;

  return (
    <div className='modal-backdrop' role='presentation' onClick={dismissible ? onClose : undefined}>
      <div
        className='modal-card'
        data-tone={feedback.tone}
        role='dialog'
        aria-modal='true'
        aria-labelledby='transaction-modal-title'
        onClick={event => event.stopPropagation()}
      >
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
      </div>
    </div>
  );
}
