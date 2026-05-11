import { KeyRound, LockKeyhole, Power, Wallet, X } from 'lucide-react';
import type { WalletState } from '../hooks/useWallet';

export function WalletStatusPill({ state, onClick, onDisconnect }: { state: WalletState; onClick: () => void; onDisconnect: () => void }) {
  if (state.status === 'connected') {
    return (
      <div className='status-pill wallet-pill' data-tone='green'>
        <LockKeyhole size={14} />
        <span>{state.wallet.label}</span>
        <button type='button' onClick={onDisconnect} aria-label='Disconnect wallet' title='Disconnect'>
          ×
        </button>
      </div>
    );
  }
  return (
    <button type='button' className='status-pill wallet-pill' data-tone='muted' onClick={onClick}>
      <Power size={14} />
      <span>{state.status === 'connecting' ? 'Connecting…' : 'Connect'}</span>
    </button>
  );
}

export function WalletModal({
  state,
  hasPrfSupport,
  hasStoredPasskey,
  onPasskey,
  onExtension,
  onForgetPasskey,
  onClose
}: {
  state: WalletState;
  hasPrfSupport: boolean;
  hasStoredPasskey: boolean;
  onPasskey: () => void;
  onExtension: () => void;
  onForgetPasskey: () => void;
  onClose: () => void;
}) {
  return (
    <div className='modal-backdrop' role='presentation' onClick={onClose}>
      <div className='modal-card wallet-modal' role='dialog' aria-modal='true' aria-labelledby='wallet-modal-title' onClick={e => e.stopPropagation()}>
        <div className='modal-header'>
          <div className='modal-icon' data-tone='success'>
            <LockKeyhole size={20} />
          </div>
          <button className='modal-close' type='button' onClick={onClose} aria-label='Close'>
            <X size={16} />
          </button>
        </div>
        <div className='modal-copy'>
          <p className='modal-eyebrow'>Account</p>
          <h2 id='wallet-modal-title'>Sovereign access</h2>
          <p>Your wallet is enough. No forms, no passwords, no personal data handover.</p>
        </div>

        {state.status === 'error' && <p className='error-box'>{state.message}</p>}
        {state.status === 'connecting' && (
          <p className='info-box'>{state.via === 'passkey' ? 'Check your browser prompt to continue.' : 'Check your wallet to approve the connection.'}</p>
        )}

        <div className='wallet-options'>
          {hasPrfSupport && (
            <button className='wallet-option wallet-option-primary' type='button' onClick={onPasskey}>
              <span className='wallet-option-icon'>
                <KeyRound size={18} />
              </span>
              <span className='wallet-option-copy'>
                <strong>{hasStoredPasskey ? 'Use passkey' : 'Create passkey'}</strong>
                <small>Use this device without a seed phrase.</small>
              </span>
            </button>
          )}

          <button className='wallet-option' type='button' onClick={onExtension}>
            <span className='wallet-option-icon'>
              <Wallet size={18} />
            </span>
            <span className='wallet-option-copy'>
              <strong>Use wallet app</strong>
              <small>Bring your existing web3 identity.</small>
            </span>
          </button>

          {hasStoredPasskey && (
            <button
              className='wallet-forget'
              type='button'
              onClick={() => {
                onForgetPasskey();
                onClose();
              }}
            >
              Remove saved passkey
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
