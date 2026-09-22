import { CircleAlert, CircleCheckBig, Copy, Disc3, X } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { Dialog } from './Dialog';
import { getTransactionProofUrl } from '../shared/utils/explorer';
import { shorten } from '../shared/utils/format';
import { useUiFeedback } from '../app/providers/UiFeedbackProvider';
import type { TransactionFeedback } from '../shared/types';

export function TransactionModal() {
  const { transactionFeedback: feedback, setTransactionFeedback } = useUiFeedback();
  const [copyStatus, setCopyStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setCopyStatus(null);
  }, [feedback]);

  if (!feedback) return null;

  const roadmapProgress = feedback.steps ? getRoadmapProgress(feedback.steps) : 0;
  const roadmapStyle = {
    '--roadmap-progress-ratio': roadmapProgress / 100
  } as CSSProperties;
  const dismissible = feedback.tone !== 'pending';
  const stepsContainTxHash = feedback.steps?.some(step => Boolean(step.txHash)) ?? false;
  const technicalProofs = feedback.technicalFacts?.length ? collectTechnicalProofs(feedback) : [];
  const proofKind = feedback.proofKind ?? 'evm-transaction';
  const onClose = () => {
    if (feedback.tone !== 'pending') setTransactionFeedback(null);
  };
  const Icon = feedback.tone === 'pending' ? Disc3 : feedback.tone === 'success' ? CircleCheckBig : CircleAlert;

  async function copyFactValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus({ tone: 'success', message: `${label} copied.` });
    } catch {
      setCopyStatus({ tone: 'error', message: 'Copy failed. The browser blocked clipboard access.' });
    }
  }

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
      {feedback.facts && feedback.facts.length > 0 && (
        <dl className='transaction-facts' aria-label='Transaction facts'>
          {feedback.facts.map(fact => (
            <div key={`${fact.label}-${fact.value}`}>
              <dt>{fact.label}</dt>
              <dd>
                <span className='transaction-fact-value'>
                  {fact.href ? (
                    <a href={fact.href} target='_blank' rel='noreferrer'>
                      {fact.value}
                    </a>
                  ) : fact.code ? (
                    <code>{fact.value}</code>
                  ) : (
                    fact.value
                  )}
                </span>
                {fact.copyValue && (
                  <button
                    className='transaction-fact-copy'
                    type='button'
                    onClick={() => void copyFactValue(fact.label, fact.copyValue!)}
                    aria-label={fact.copyLabel ?? `Copy ${fact.label}`}
                  >
                    <Copy size={13} />
                    <span>Copy</span>
                  </button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {feedback.technicalFacts && feedback.technicalFacts.length > 0 && (
        <details className='transaction-technical'>
          <summary>Technical details</summary>
          <dl className='transaction-facts' aria-label='Technical transaction details'>
            {feedback.technicalFacts.map(fact => (
              <div key={`${fact.label}-${fact.value}`}>
                <dt>{fact.label}</dt>
                <dd>
                  <span className='transaction-fact-value'>{fact.code ? <code>{fact.value}</code> : fact.value}</span>
                  {fact.copyValue && (
                    <button
                      className='transaction-fact-copy'
                      type='button'
                      onClick={() => void copyFactValue(fact.label, fact.copyValue!)}
                      aria-label={fact.copyLabel ?? `Copy ${fact.label}`}
                    >
                      <Copy size={13} />
                      <span>Copy</span>
                    </button>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {technicalProofs.length > 0 && (
            <div className='transaction-proof-list' aria-label='Technical proof references'>
              {technicalProofs.map(proof => (
                <div className='modal-hash' key={proof.txHash}>
                  <span>{proof.label}</span>
                  <code>{shorten(proof.txHash, 12)}</code>
                  <button
                    className='transaction-fact-copy'
                    type='button'
                    onClick={() => void copyFactValue(proof.label, proof.txHash)}
                    aria-label={`Copy ${proof.label}`}
                  >
                    <Copy size={13} />
                    <span>Copy</span>
                  </button>
                  <a className='modal-link' href={getTransactionProofUrl(proof.txHash, proofKind)} target='_blank' rel='noreferrer'>
                    {proofKind === 'substrate-extrinsic' ? 'View extrinsic' : 'View proof'}
                  </a>
                </div>
              ))}
            </div>
          )}
        </details>
      )}
      {copyStatus && (
        <p className='transaction-copy-status' data-tone={copyStatus.tone} role='status' aria-live='polite'>
          {copyStatus.message}
        </p>
      )}
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
                {step.txHash && !feedback.technicalFacts?.length && (
                  <a href={getTransactionProofUrl(step.txHash, proofKind)} target='_blank' rel='noreferrer'>
                    {shorten(step.txHash, 10)}
                  </a>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      {feedback.txHash && !stepsContainTxHash && !feedback.technicalFacts?.length && (
        <div className='modal-hash'>
          <span>Proof reference</span>
          <code>{shorten(feedback.txHash, 12)}</code>
          <button
            className='transaction-fact-copy'
            type='button'
            onClick={() => void copyFactValue('Proof reference', feedback.txHash!)}
            aria-label='Copy proof reference'
          >
            <Copy size={13} />
            <span>Copy</span>
          </button>
          <a className='modal-link' href={getTransactionProofUrl(feedback.txHash, proofKind)} target='_blank' rel='noreferrer'>
            {proofKind === 'substrate-extrinsic' ? 'View extrinsic' : 'View proof'}
          </a>
        </div>
      )}
      {dismissible && (
        <div className='modal-actions'>
          {feedback.recoveryAction && (
            <button className='modal-action' type='button' onClick={feedback.recoveryAction.run}>
              {feedback.recoveryAction.label}
            </button>
          )}
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

export function collectTechnicalProofs(feedback: TransactionFeedback): Array<{ label: string; txHash: `0x${string}` }> {
  const proofs: Array<{ label: string; txHash: `0x${string}` }> = [];
  const seen = new Set<string>();

  for (const step of feedback.steps ?? []) {
    if (!step.txHash || seen.has(step.txHash)) continue;
    seen.add(step.txHash);
    proofs.push({ label: step.label, txHash: step.txHash });
  }

  if (feedback.txHash && !seen.has(feedback.txHash)) {
    proofs.push({ label: 'Proof reference', txHash: feedback.txHash });
  }

  return proofs;
}
