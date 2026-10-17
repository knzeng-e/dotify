import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSessionContext, useWalletContext } from '../../app/providers';
import { resolveRoomContributionSessionToken } from '../donations/roomContributionSession';
import { clearStoredSession } from '../../services/keyService';
import { artistVisitSession } from './artistVisitSession';
import { isArtistRoomActivitySnapshot, type ArtistRoomActivitySnapshot } from './artistRoomActivity';

/** Reuses sign-in silently. A missing session is established only by a user action. */
export function useArtistRoomActivity(runtime: string | null) {
  const session = useSessionContext();
  const wallet = useWalletContext();
  const account = wallet.connectedWallet?.evmAddress;
  const signer = wallet.connectedWallet?.keyRequestSigner;
  const method = wallet.connectedWallet?.method;
  const chainId = wallet.expectedChainId;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; snapshot: ArtistRoomActivitySnapshot | null; message: string; needsSession: boolean }>({
    key: '',
    snapshot: null,
    message: '',
    needsSession: false
  });
  const [connecting, setConnecting] = useState(false);
  const key = `${runtime}:${account}:${method}:${chainId}`;
  const currentKey = useRef(key);
  const generation = useRef(0);
  const latest = useRef({ session, wallet });
  useLayoutEffect(() => {
    currentKey.current = key;
    latest.current = { session, wallet };
  }, [key, session, wallet]);

  useEffect(() => {
    const attempt = ++generation.current;
    setConnecting(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let inFlight = false;
    const valid = () => !stopped && attempt === generation.current && currentKey.current === key;
    const update = (snapshot: ArtistRoomActivitySnapshot | null, message = '', needsSession = false) => {
      if (valid()) setState({ key, snapshot, message, needsSession });
    };
    const scan = () => {
      if (!valid() || !runtime || !account || inFlight) return;
      if (document.visibilityState === 'hidden') return;
      const port = latest.current.session.connectSocket();
      const token = resolveRoomContributionSessionToken({ hostAccount: account, hostSigner: signer, expectedChainId: chainId });
      if (!token) {
        update(null, 'Verify your artist account to see live room activity.', true);
        return;
      }
      if (!port.connected) {
        update(null, 'Reconnecting to live room activity…');
        timer = setTimeout(scan, 5000);
        return;
      }
      inFlight = true;
      port.request('artist:rooms', { runtime, token }, { timeoutMs: 40000, connectedOnly: true }, (error, reply) => {
        inFlight = false;
        if (!valid()) return;
        if (!error && isArtistRoomActivitySnapshot(reply, runtime)) update(reply);
        else if (reply?.ok === false && reply.code === 'SESSION_INVALID') {
          clearStoredSession(account, token);
          update(null, 'Reconnect your artist account to resume live activity.', true);
          return;
        } else update(null, 'Live room activity is temporarily unavailable. Retrying…');
        if (document.visibilityState !== 'hidden') timer = setTimeout(scan, 5000);
      });
    };
    const visibility = () => {
      clearTimeout(timer);
      if (document.visibilityState !== 'hidden') scan();
    };
    document.addEventListener('visibilitychange', visibility);
    update(null);
    scan();
    return () => {
      stopped = true;
      generation.current = attempt + 1;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [runtime, account, signer, method, chainId, key, revision, session.socketStatus]);

  async function connect() {
    if (connecting) return;
    const attempt = generation.current;
    const identity = latest.current.wallet.connectedWallet;
    setConnecting(true);
    try {
      await artistVisitSession({
        account: identity?.evmAddress,
        signer: identity?.keyRequestSigner,
        chainId,
        getWalletClient: latest.current.wallet.getActiveWalletClient
      });
      if (generation.current === attempt && currentKey.current === key) setRevision(value => value + 1);
    } catch (error) {
      if (generation.current === attempt && currentKey.current === key)
        setState({ key, snapshot: null, message: error instanceof Error ? error.message : 'Could not verify your artist account.', needsSession: true });
    } finally {
      if (generation.current === attempt) setConnecting(false);
    }
  }
  return {
    snapshot: state.key === key ? state.snapshot : null,
    message: state.key === key ? state.message : '',
    needsSession: state.key === key && state.needsSession,
    connect,
    connecting
  };
}
