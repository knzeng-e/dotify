import { Wallet } from 'lucide-react';
import { useUiFeedback } from '../app/providers/UiFeedbackProvider';
import { useWalletContext } from '../app/providers/WalletProvider';

/** Opens the same account/disconnect sheet without leaving the listening view. */
export function PlayerAccountButton() {
  const { walletState } = useWalletContext();
  const { openWalletModal } = useUiFeedback();
  const connected = walletState.status === 'connected';
  return (
    <button
      className='icon-action player-account-trigger'
      type='button'
      data-connected={connected}
      aria-label={connected ? `Account options for ${walletState.wallet.label}` : 'Connect account'}
      title={connected ? 'Account & disconnect' : 'Connect account'}
      onClick={() => openWalletModal('account')}
    >
      <Wallet size={20} aria-hidden='true' />
    </button>
  );
}
