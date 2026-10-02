import { KeyRound } from 'lucide-react';
import { Dialog } from './Dialog';
import type { AccessGate } from '../shared/types';
import { buildClassicAccessReceipt } from '../features/access/accessPromise';
import type { DotifyNativeRuntimeAsset } from '../features/payments/paymentModel';

export function AccessGateOverlay({
  gate,
  nativePaymentAsset,
  onDismiss,
  onPay,
  onSignIn
}: {
  gate: AccessGate;
  nativePaymentAsset: Pick<DotifyNativeRuntimeAsset, 'symbol'>;
  onDismiss: () => void;
  onPay?: () => void;
  onSignIn?: () => void;
}) {
  const classicReceipt =
    gate.track.accessMode === 'classic' && (gate.actionType === 'payment' || gate.actionType === 'signin')
      ? buildClassicAccessReceipt(gate.track, nativePaymentAsset)
      : null;

  return (
    <Dialog
      className='access-gate'
      size='compact'
      dataAttributes={{ action: gate.actionType, access: gate.track.accessMode, testid: 'access-warning' }}
      initialFocus='dialog'
      labelledBy='access-gate-title'
      describedBy='access-gate-message'
      onClose={onDismiss}
    >
      <div className='access-gate-header'>
        <span>
          <KeyRound size={17} aria-hidden='true' />
        </span>
        <strong id='access-gate-title'>{gate.title}</strong>
      </div>
      <div className='access-gate-copy'>
        <p className='access-gate-message' id='access-gate-message'>
          {gate.message}
        </p>
        <p className='access-gate-hint'>{gate.hint}</p>
      </div>
      {classicReceipt && (
        <section className='access-gate-receipt' aria-label={`Access payment for ${gate.track.title}`}>
          <div className='access-gate-price' aria-label={`Access price ${classicReceipt.supportAmount}`}>
            <span>Listening access</span>
            <strong>{classicReceipt.supportAmount}</strong>
          </div>
          <dl>
            {classicReceipt.recipients.map(recipient => (
              <div key={`${recipient.label}-${recipient.value}`}>
                <dt>{recipient.label}</dt>
                <dd>{recipient.value}</dd>
              </div>
            ))}
            <div>
              <dt>Confirmation fee</dt>
              <dd>Shown before you approve</dd>
            </div>
          </dl>
          <details className='access-gate-details'>
            <summary>How access works</summary>
            <dl>
              {classicReceipt.terms.map(term => (
                <div key={term.label}>
                  <dt>{term.label}</dt>
                  <dd>{term.value}</dd>
                </div>
              ))}
            </dl>
            <p>{classicReceipt.settlementNote}</p>
          </details>
        </section>
      )}
      <div className='access-gate-actions'>
        {gate.actionType === 'payment' && onPay && classicReceipt && (
          <button
            className='primary-action access-gate-primary'
            type='button'
            data-testid='classic-unlock-button'
            onClick={onPay}
            aria-label={`Pay ${classicReceipt.supportAmount} to unlock ${gate.track.title}`}
          >
            <KeyRound size={16} aria-hidden='true' />
            Pay {classicReceipt.supportAmount} to unlock
          </button>
        )}
        {gate.actionType === 'signin' && onSignIn && (
          <button className='primary-action access-gate-primary' type='button' onClick={onSignIn}>
            Choose account
          </button>
        )}
        <button className='secondary-action' type='button' onClick={onDismiss}>
          Not now
        </button>
      </div>
    </Dialog>
  );
}
