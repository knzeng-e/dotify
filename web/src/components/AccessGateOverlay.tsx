import { LockKeyhole } from 'lucide-react';
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
    gate.track.accessMode === 'classic' && gate.actionType === 'payment' ? buildClassicAccessReceipt(gate.track, nativePaymentAsset) : null;

  return (
    <Dialog
      className='access-gate'
      size='compact'
      dataAttributes={{ action: gate.actionType, access: gate.track.accessMode, testid: 'access-warning' }}
      labelledBy='access-gate-title'
      describedBy='access-gate-message'
      onClose={onDismiss}
    >
      <div className='access-gate-header'>
        <span>
          <LockKeyhole size={17} />
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
        <section className='access-gate-receipt' aria-label={`Support summary for ${gate.track.title}`}>
          <div className='access-gate-price' aria-label={`Support amount ${classicReceipt.supportAmount}`}>
            <span>Total support</span>
            <strong>{classicReceipt.supportAmount}</strong>
          </div>
          <dl>
            {classicReceipt.terms.map(term => (
              <div key={term.label}>
                <dt>{term.label}</dt>
                <dd>{term.value}</dd>
              </div>
            ))}
            {classicReceipt.recipients.map(recipient => (
              <div key={`${recipient.label}-${recipient.value}`}>
                <dt>{recipient.label}</dt>
                <dd>{recipient.value}</dd>
              </div>
            ))}
            <div>
              <dt>Network fee</dt>
              <dd>Shown by your confirmation method</dd>
            </div>
          </dl>
          <p>{classicReceipt.settlementNote}</p>
        </section>
      )}
      <div className='access-gate-actions'>
        {gate.actionType === 'payment' && onPay && classicReceipt && (
          <button
            className='primary-action access-gate-primary'
            type='button'
            data-testid='classic-unlock-button'
            onClick={onPay}
            aria-label={`Support the artist and open ${gate.track.title} for ${classicReceipt.supportAmount}`}
          >
            Support and open - {classicReceipt.supportAmount}
          </button>
        )}
        {gate.actionType === 'signin' && onSignIn && (
          <button className='primary-action access-gate-primary' type='button' onClick={onSignIn}>
            Continue
          </button>
        )}
        <button className='secondary-action' type='button' onClick={onDismiss}>
          Not now
        </button>
      </div>
    </Dialog>
  );
}
