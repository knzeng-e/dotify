import { CircleCheck, RefreshCw } from 'lucide-react';
import { useWalletContext, useSessionContext, useUiFeedback } from '../app/providers';

export function HostContributions() {
  const wallet = useWalletContext();
  const session = useSessionContext();
  const { openWalletModal } = useUiFeedback();
  if (session.mode !== 'host' || !session.roomId) return null;
  const { status, message, retry } = session.hostTipBinding;
  return (
    <div className='host-contributions' role='status'>
      {status === 'ready' ? (
        <p>
          <CircleCheck size={16} aria-hidden='true' /> Host tips connected. {message}
        </p>
      ) : (
        <>
          <p>{message || 'Connecting your host account…'}</p>
          {status !== 'connecting' && (
            <button type='button' className='quiet-action compact-action' onClick={() => (wallet.connectedWallet ? retry() : openWalletModal('support'))}>
              <RefreshCw size={16} aria-hidden='true' /> {wallet.connectedWallet ? 'Retry connection' : 'Connect for host tips'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
