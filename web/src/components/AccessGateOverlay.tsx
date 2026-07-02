import { LockKeyhole } from 'lucide-react';
import { Dialog } from './Dialog';
import type { AccessGate } from '../shared/types';

export function AccessGateOverlay({
  gate,
  onDismiss,
  onPay,
  onSignIn
}: {
  gate: AccessGate;
  onDismiss: () => void;
  onPay?: () => void;
  onSignIn?: () => void;
}) {
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
        <div className='access-gate-price' aria-label={`Unlock price ${gate.track.priceDot} DOT`}>
          <span>Full song</span>
          <strong>{gate.track.priceDot} DOT</strong>
        </div>
      )}
      <div className='access-gate-actions'>
        {gate.actionType === 'payment' && onPay && (
          <button
            className='primary-action access-gate-primary'
            type='button'
            data-testid='classic-unlock-button'
            onClick={onPay}
            aria-label={`Unlock ${gate.track.title} for ${gate.track.priceDot} DOT`}
          >
            Unlock listening
          </button>
        )}
        {gate.actionType === 'signin' && onSignIn && (
          <button className='primary-action access-gate-primary' type='button' onClick={onSignIn}>
            Continue
          </button>
        )}
        <button className='secondary-action' type='button' onClick={onDismiss}>
          Stay in preview
        </button>
      </div>
    </Dialog>
  );
}
