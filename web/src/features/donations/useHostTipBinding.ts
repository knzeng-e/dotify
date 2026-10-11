import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ConnectedWallet } from '../../hooks/useWallet';
import type { RoomRealtimePort } from '../rooms/roomRealtimePort';
import { ensureDotifySession, ensureDotifySessionForSigner } from '../../services/keyService';
import type { WalletClient } from 'viem';

export function useHostTipBinding(input: {
  mode: string;
  roomId: string | null;
  socketStatus: string;
  socket: RoomRealtimePort | null;
  wallet: ConnectedWallet | null;
  chainId: number | null;
  getWallet: () => Promise<WalletClient>;
}) {
  const { mode, roomId, socketStatus, socket, wallet, chainId } = input;
  const latest = useRef(input);
  useLayoutEffect(() => {
    latest.current = input;
  });
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ scope: string; status: 'connecting' | 'ready' | 'unavailable'; message: string }>({
    scope: '',
    status: 'unavailable',
    message: ''
  });
  const account = wallet?.evmAddress;
  const signer = wallet?.keyRequestSigner;
  const scope = `${roomId}:${socket?.id}:${account}:${chainId}`;
  useEffect(() => {
    if (mode !== 'host' || !roomId || socketStatus !== 'online' || !socket?.connected) return;
    let cancelled = false;
    socket.request('room:tip-bind', { token: '' }, { timeoutMs: 15000 }, () => {});
    if (!account || !chainId) {
      setState({ scope, status: 'unavailable', message: 'Connect your account to receive an eligible host share.' });
      return;
    }
    setState({ scope, status: 'connecting', message: 'Connecting your account for room tips…' });
    void (async () => {
      try {
        const token = signer ? await ensureDotifySessionForSigner(signer, chainId) : await ensureDotifySession(await latest.current.getWallet(), chainId);
        if (cancelled) return;
        if (!token) throw new Error('Sign in to Dotify to receive your host share.');
        await new Promise<void>((resolve, reject) =>
          socket.request('room:tip-bind', { token }, { timeoutMs: 15000 }, (error, reply) =>
            error ? reject(error) : reply?.ok ? resolve() : reject(new Error(reply?.error || 'Your host account could not be verified.'))
          )
        );
        if (!cancelled) setState({ scope, status: 'ready', message: 'You receive the host share when the artist enables it.' });
      } catch (error) {
        if (!cancelled) setState({ scope, status: 'unavailable', message: error instanceof Error ? error.message : 'Room tips could not connect.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, roomId, socketStatus, socket, account, signer, chainId, scope, retry]);
  return {
    status: socketStatus === 'online' && socket?.connected && state.scope === scope ? state.status : 'unavailable',
    message: socketStatus !== 'online' ? 'Reconnecting to the room…' : state.scope === scope ? state.message : '',
    retry: () => setRetry(value => value + 1)
  };
}
