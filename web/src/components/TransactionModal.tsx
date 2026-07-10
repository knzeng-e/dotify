import { CircleAlert, CircleCheckBig, Disc3, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Dialog } from './Dialog';
import { getBlockscoutTxUrl } from '../shared/utils/explorer';
import { shorten } from '../shared/utils/format';
import { useUiFeedback } from '../app/providers/UiFeedbackProvider';
import type { TransactionFeedback } from '../shared/types';

export function TransactionModal() {
  const { transactionFeedback: feedback, setTransactionFeedback } = useUiFeedback();
  if (!feedback) return null;

  const roadmapProgress = feedback.steps ? getRoadmapProgress(feedback.steps) : 0;
  const roadmapStyle = {
    '--roadmap-progress-ratio': roadmapProgress / 100
  } as CSSProperties;
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
      {feedback.steps && feedback.steps.length > 0 && (
        <ol className='transaction-roadmap' style={roadmapStyle} aria-label='Transaction approval roadmap'>
          {feedback.steps.map((step, index) => (
            <li key={`${step.label}-${index}`} data-status={step.status}>
              <span className='transaction-roadmap-marker' aria-hidden='true'>
                {step.status === 'complete' ? (
                  <CircleCheckBig size={14} />
                ) : step.status === 'active' || step.status === 'submitted' ? (
                  <Disc3 size={14} className='spin' />
                ) : (
                  index + 1
                )}
              </span>
              <span className='transaction-roadmap-copy'>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
                {step.txHash && (
                  <a href={getBlockscoutTxUrl(step.txHash)} target='_blank' rel='noreferrer'>
                    {shorten(step.txHash, 10)}
                  </a>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      {feedback.txHash && (!feedback.steps || feedback.steps.length === 0) && (
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

function getRoadmapProgress(steps: TransactionFeedback['steps']) {
  if (!steps || steps.length <= 1) return 0;
  const lastCompleteIndex = steps.reduce((lastIndex, step, index) => (step.status === 'complete' ? index : lastIndex), -1);
  if (lastCompleteIndex <= 0) return 0;
  return (lastCompleteIndex / (steps.length - 1)) * 100;
}
