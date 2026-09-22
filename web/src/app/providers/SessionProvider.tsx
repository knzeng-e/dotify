// Session provider - wraps the useSession hook (WebRTC rooms + Socket.IO
// signaling) and publishes it to the tree. Sits below CatalogProvider because the
// session streams the catalog's selected audio/track. The hook keeps its
// dependency-injection signature; the wiring and the one-link-join effect move
// here from App.tsx. Fail closed: the accessor throws outside the provider.

import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useSession } from '../../hooks/useSession';
import { getInitialRoomCode } from '../../features/rooms/roomState';
import { DEFAULT_DISPLAY_NAME, getStoredDisplayName, isChosenDisplayName } from '../../features/identity/walletIdentity';
import { requiresExplicitProductRoomEntry } from '../../features/productHost/productHost';
import { useWalletContext } from './WalletProvider';
import { useNavigation } from './NavigationProvider';
import { useCatalogContext } from './CatalogProvider';

const signalUrl = import.meta.env.VITE_SIGNAL_URL ?? `${window.location.protocol}//${window.location.hostname}:8788`;
const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim() || null;

type SessionValue = ReturnType<typeof useSession>;

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { activeIdentityAddress, connectedWallet } = useWalletContext();
  const { navigateToView } = useNavigation();
  const catalog = useCatalogContext();

  const session = useSession({
    signalUrl,
    publicAppUrl,
    identityAddress: activeIdentityAddress,
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

  // One-link join: a guest landing on a #/rooms/<id> share link joins
  // immediately only when a wallet-scoped or guest name is already remembered.
  // First-time link guests are prompted by ListenerShell to pick their room
  // name before joining, so the host does not see the untouched "Listener"
  // default as a real participant identity.
  //
  // Re-attempt while not yet in a room rather than latching a one-shot ref: under
  // React StrictMode the mount/unmount/remount cycle tears the first socket down
  // before it connects, and a latched ref would leave the guest permanently
  // unconnected on the surviving mount.
  useEffect(() => {
    const initialRoomCode = getInitialRoomCode();
    if (!initialRoomCode || session.roomId) return;
    const remembered = getStoredDisplayName(activeIdentityAddress);
    if (!remembered) return;
    // Product permission prompts need an explicit user gesture. The listener
    // shell still discovers the room and opens the threshold with this name
    // prefilled; ordinary browsers retain frictionless remembered-name join.
    if (requiresExplicitProductRoomEntry()) return;
    session.setDisplayName(remembered);
    session.joinRoom(initialRoomCode, { displayName: remembered });
    // Run once per mount; the share-link code is read from the URL at mount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A chosen room alias wins over the optional host username. Only seed fields:
  // sharing a profile must never silently rename someone in a live room or
  // replace a name they are currently typing. Persistence remains at submit.
  const hostDisplayName = connectedWallet?.displayName;
  const nameSeedRef = useRef({ address: activeIdentityAddress, name: DEFAULT_DISPLAY_NAME });
  const setDisplayName = session.setDisplayName;
  useEffect(() => {
    if (session.roomId) return;
    const previous = nameSeedRef.current;
    const name = getStoredDisplayName(activeIdentityAddress) ?? hostDisplayName ?? DEFAULT_DISPLAY_NAME;
    nameSeedRef.current = { address: activeIdentityAddress, name };
    setDisplayName(current => {
      if (previous.address !== activeIdentityAddress) return name;
      if (name === previous.name) return current;
      return current === previous.name || !isChosenDisplayName(current) ? name : current;
    });
  }, [activeIdentityAddress, hostDisplayName, session.roomId, setDisplayName]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSessionContext(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSessionContext must be used within a SessionProvider.');
  return value;
}
