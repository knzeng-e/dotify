import { LockKeyhole } from 'lucide-react';
import { Dialog } from './Dialog';
import type { AccessGate } from '../shared/types';
import { nativeRuntimeAmountLabel, type DotifyNativeRuntimeAsset } from '../features/payments/paymentModel';

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
  const configuredSplitBps = gate.track.royaltySplits.reduce((total, split) => total + split.bps, 0);
  const artistRemainderBps = Math.max(0, 10_000 - configuredSplitBps);
  const supportAmount = nativeRuntimeAmountLabel(gate.track.priceDot, nativePaymentAsset);

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
      {gate.track.accessMode === 'classic' && (
        <section className='access-gate-receipt' aria-label={`Support summary for ${gate.track.title}`}>
          <div className='access-gate-price' aria-label={`Support amount ${supportAmount}`}>
            <span>Total support</span>
            <strong>{supportAmount}</strong>
          </div>
          <dl>
            <div>
              <dt>You receive</dt>
              <dd>Durable listening access for this wallet</dd>
            </div>
            {gate.track.royaltySplits.map((split, index) => (
              <div key={`${split.recipient}-${index}`}>
                <dt>{split.label || `Collaborator ${index + 1}`}</dt>
                <dd>{(split.bps / 100).toFixed(split.bps % 100 === 0 ? 0 : 2)}%</dd>
              </div>
            ))}
            {artistRemainderBps > 0 && (
              <div>
                <dt>Original artist remainder</dt>
                <dd>{(artistRemainderBps / 100).toFixed(artistRemainderBps % 100 === 0 ? 0 : 2)}%</dd>
              </div>
            )}
            <div>
              <dt>Network fee</dt>
              <dd>Shown by your confirmation method</dd>
            </div>
          </dl>
          <p>The artist-owned runtime applies this split when the support is confirmed.</p>
        </section>
      )}
      <div className='access-gate-actions'>
        {gate.actionType === 'payment' && onPay && (
          <button
            className='primary-action access-gate-primary'
            type='button'
            data-testid='classic-unlock-button'
            onClick={onPay}
            aria-label={`Support the artist and open ${gate.track.title} for ${supportAmount}`}
          >
            Support and open - {supportAmount}
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
