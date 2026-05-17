import { LockKeyhole } from 'lucide-react';
import type { AccessGate } from '../types';

export function AccessGateOverlay({ gate, onDismiss, onPay, onSignIn }: { gate: AccessGate; onDismiss: () => void; onPay?: () => void; onSignIn?: () => void }) {
  return (
    <div className='access-gate' data-action={gate.actionType} data-access={gate.track.accessMode}>
      <div className='access-gate-header'>
        <span>
          <LockKeyhole size={17} />
        </span>
        <strong>{gate.title}</strong>
      </div>
      <div className='access-gate-copy'>
        <p className='access-gate-message'>{gate.message}</p>
        <p className='access-gate-hint'>{gate.hint}</p>
      </div>
      {gate.track.accessMode === 'classic' && (
        <div className='access-gate-price' aria-label={`Unlock price ${gate.track.priceDot} DOT`}>
          <span>Unlock price</span>
          <strong>{gate.track.priceDot} DOT</strong>
        </div>
      )}
      <div className='access-gate-actions'>
        {gate.actionType === 'payment' && onPay && (
          <button
            className='primary-action access-gate-primary'
            type='button'
            onClick={onPay}
            aria-label={`Pay ${gate.track.priceDot} DOT to unlock ${gate.track.title}`}
          >
            Pay {gate.track.priceDot} DOT to unlock
          </button>
        )}
        {gate.actionType === 'signin' && onSignIn && (
          <button className='primary-action access-gate-primary' type='button' onClick={onSignIn}>
            Use wallet to unlock
          </button>
        )}
        <button className='secondary-action' type='button' onClick={onDismiss}>
          Keep preview
        </button>
      </div>
    </div>
  );
}
