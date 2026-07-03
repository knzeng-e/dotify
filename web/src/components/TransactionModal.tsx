import { CircleAlert, CircleCheckBig, Disc3, X } from 'lucide-react';
import { Dialog } from './Dialog';
import { getBlockscoutTxUrl } from '../shared/utils/explorer';
import { shorten } from '../shared/utils/format';
import { useUiFeedback } from '../app/providers/UiFeedbackProvider';

export function TransactionModal() {
  const { transactionFeedback: feedback, setTransactionFeedback } = useUiFeedback();
  if (!feedback) return null;

  const dismissible = feedback.tone !== 'pending';
  const onClose = () => {
    if (feedback.tone !== 'pending') setTransactionFeedback(null);
  };
  const Icon = feedback.tone === 'pending' ? Disc3 : feedback.tone === 'success' ? CircleCheckBig : CircleAlert;

  return (
    <Dialog
      labelledBy='transaction-modal-title'
      dataAttributes={{ testid: 'unlock-transaction-status' }}
      dismissible={dismissible}
      tone={feedback.tone}
      onClose={onClose}
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
    </Dialog>
  );
}
