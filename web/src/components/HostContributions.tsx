import { useState } from 'react';
import { Coins } from 'lucide-react';
import { useWalletContext, useSessionContext, useUiFeedback } from '../app/providers';
import { ensureDotifySession, ensureDotifySessionForSigner } from '../services/keyService';

export function HostContributions() {
  const wallet = useWalletContext();
  const session = useSessionContext();
  const { openWalletModal } = useUiFeedback();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [bound, setBound] = useState('');
  if (session.mode !== 'host' || !session.roomId) return null;
  const scope = `${session.roomId}:${session.socketRef.current?.id}:${wallet.listenerEvmAddress}`;
  async function connect() {
    if (!wallet.connectedWallet || !wallet.expectedChainId) {
      openWalletModal('support');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const signer = wallet.connectedWallet.keyRequestSigner;
      const token = signer
        ? await ensureDotifySessionForSigner(signer, wallet.expectedChainId)
        : await ensureDotifySession(await wallet.getActiveWalletClient(), wallet.expectedChainId);
      if (!token) throw new Error('Sign in to Dotify to receive room tips.');
      const socket = session.socketRef.current;
      if (!socket?.connected) throw new Error('Reconnect to this room.');
      await new Promise<void>((resolve, reject) =>
        socket.request('room:tip-bind', { token }, { timeoutMs: 15000 }, (error, response) =>
          error ? reject(error) : response?.ok ? resolve() : reject(new Error(response?.error || 'Could not connect host contributions.'))
        )
      );
      setBound(scope);
      setStatus('Host account connected for room tips.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Room contributions unavailable.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className='host-contributions'>
      <button className='secondary-action compact-action' disabled={busy || bound === scope} onClick={() => void connect()}>
        <Coins size={16} aria-hidden='true' />
        {bound === scope ? 'Room tips connected' : busy ? 'Connecting…' : 'Receive room tips'}
      </button>
      {status && <p role='status'>{status}</p>}
    </div>
  );
}
