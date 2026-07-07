// Session provider - wraps the useSession hook (WebRTC rooms + Socket.IO
// signaling) and publishes it to the tree. Sits below CatalogProvider because the
// session streams the catalog's selected audio/track. The hook keeps its
// dependency-injection signature; the wiring and the one-link-join effect move
// here from App.tsx. Fail closed: the accessor throws outside the provider.

import { createContext, useContext, useEffect, type ReactNode, type RefObject } from 'react';
import { useSession } from '../../hooks/useSession';
import { isRoomJoinE2e } from '../../e2e/roomJoinMock';
import { getInitialRoomCode } from '../../features/rooms/roomState';
import { getStoredDisplayName } from '../../features/identity/walletIdentity';
import { useWalletContext } from './WalletProvider';
import { useNavigation } from './NavigationProvider';
import { useCatalogContext } from './CatalogProvider';

const signalUrl = import.meta.env.VITE_SIGNAL_URL ?? `${window.location.protocol}//${window.location.hostname}:8788`;

type SessionValue = ReturnType<typeof useSession>;

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { listenerEvmAddress } = useWalletContext();
  const { navigateToView } = useNavigation();
  const catalog = useCatalogContext();

  const session = useSession({
    signalUrl,
    hostAddress: listenerEvmAddress,
    audioSource: catalog.audioSource,
    trackInfo: catalog.trackInfo,
    setTrackInfo: catalog.setTrackInfo,
    setPlayerState: catalog.setPlayerState,
    localAudioRef: catalog.localAudioRef as RefObject<HTMLAudioElement>,
    objectUrlsRef: catalog.objectUrlsRef,
    resolvedAudioSourcesRef: catalog.resolvedAudioSourcesRef,
    navigateToView,
    setAudioSource: catalog.setAudioSource
  });

  // One-link join: a guest landing on a #/rooms/<id> share link walks into the
  // room. No wallet, no signature, no payment: room access is host-based and
  // the guest only receives the ephemeral WebRTC stream.
  //
  // Meet-style arrival: a guest with a remembered name (wallet-scoped or the
  // per-browser guest login) joins straight away under that name; a first-time
  // guest gets the join sheet to pick one instead of being auto-labeled
  // "Listener". Deterministic e2e keeps the direct auto-join.
  //
  // Re-attempt while not yet in a room rather than latching a one-shot ref: under
  // React StrictMode the mount/unmount/remount cycle tears the first socket down
  // before it connects, and a latched ref would leave the guest permanently
  // unconnected on the surviving mount.
  useEffect(() => {
    const initialRoomCode = getInitialRoomCode();
    if (!initialRoomCode || session.roomId) return;

    if (isRoomJoinE2e) {
      session.joinRoom(initialRoomCode);
      return;
    }

    const remembered = getStoredDisplayName(listenerEvmAddress);
    if (remembered) {
      session.setDisplayName(remembered);
      session.joinRoom(initialRoomCode);
      return;
    }
    session.setPendingJoinCode(initialRoomCode);
    // Run once per mount; the share-link code is read from the URL at mount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wallet identity (off-chain): a connected wallet carries its chosen display
  // name, so the user never retypes it. On connect, pre-fill the session name
  // from the address's stored name; a guest with no wallet keeps whatever they
  // typed. See features/identity/walletIdentity.ts.
  // The name is persisted back to the wallet at the actual submit point
  // (useSession.createSession / joinRoom), not reactively here: the modals wire
  // the field's onChange straight to setDisplayName, so a reactive effect would
  // write a partial name to storage on every keystroke.
  const setDisplayName = session.setDisplayName;
  useEffect(() => {
    const stored = getStoredDisplayName(listenerEvmAddress);
    if (stored) setDisplayName(stored);
    // Re-run only when the connected address changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenerEvmAddress]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSessionContext(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSessionContext must be used within a SessionProvider.');
  return value;
}
