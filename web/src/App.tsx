import { Disc3, Headphones, PanelLeftClose, PanelLeftOpen, Radio, UserRound, Link as LinkIcon } from 'lucide-react';

import { AuraBackground } from './components/AuraBackground';
import { PlayerDock } from './components/PlayerDock';
import { PersistentAudio } from './components/PersistentAudio';
import { CreateRoomModal } from './components/CreateRoomModal';
import { applyAura, auraForTrack, auraForName } from './utils/aura';

import { hashFileWithBytes } from './utils/hash';
import { deployments } from './config/deployments';
import { devAccounts } from './hooks/useDevAccounts';
import { getDefaultEthRpcUrl } from './config/network';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { resolveEvmChain, getWalletClient } from './config/contracts';
import { destroyBulletinClient } from './hooks/useBulletin';
import { uploadFileToPinata, uploadProtectedAudio } from './services/pinata';
import { useWallet } from './hooks/useWallet';
import { zeroAddress } from 'viem';

import { Metric } from './components/ui/Metric';
import { WalletModal, WalletStatusPill } from './components/WalletModal';
import { TransactionModal } from './components/TransactionModal';

import { useCatalog } from './hooks/useCatalog';
import { useSession, getInitialRoomCode } from './hooks/useSession';
import { useArtistConsole, getStoredArtistName } from './hooks/useArtistConsole';
import { usePlayback } from './hooks/usePlayback';

import { ListenView } from './views/ListenView';
import { PlayerView } from './views/PlayerView';
import { RoomsView } from './views/RoomsView';
import { YouView } from './views/YouView';
import { ArtistProfileView } from './views/ArtistProfileView';
import { ArtistConsole } from './views/artist/ArtistConsole';
import { ArtistOnboarding } from './views/artist/ArtistOnboarding';

import { stripExtension } from './utils/format';

import type {
  AccessMode,
  ArtistTab,
  AssetAction,
  CatalogTrack,
  PersonhoodLevel,
  ReleaseStep,
  RoomPlaybackMode,
  TrackInfo,
  TransactionFeedback,
  View
} from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const signalUrl = import.meta.env.VITE_SIGNAL_URL ?? `${window.location.protocol}//${window.location.hostname}:8788`;

const viewCopy: Record<View, { title: string; eyebrow: string }> = {
  listen: { title: 'Now', eyebrow: 'Live rooms' },
  player: { title: 'Listen', eyebrow: 'Catalog and player' },
  rooms: { title: 'Rooms', eyebrow: 'Join or create' },
  you: { title: 'Account', eyebrow: 'Wallet and artist space' }
};

const releaseStepsConfig: Array<{ id: ReleaseStep; label: string }> = [
  { id: 'assets', label: 'Assets' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'access', label: 'Access' },
  { id: 'review', label: 'Review' }
];

function isDotifyView(value: unknown): value is View {
  return value === 'listen' || value === 'player' || value === 'rooms' || value === 'you';
}

function getInitialView(): View {
  return getInitialRoomCode() ? 'rooms' : 'listen';
}

function isArtistPortalPath() {
  return window.location.pathname.replace(/\/$/, '') === '/artists';
}

function catalogTrackToTrackInfo(track: CatalogTrack): TrackInfo {
  return {
    title: track.title,
    artist: track.artist,
    hash: track.hash,
    bulletinRef: track.bulletinRef,
    duration: track.duration ?? 0,
    updatedAt: Date.now(),
    imageRef: track.imageRef,
    audioRef: track.audioRef,
    metadataRef: track.metadataRef,
    description: track.description,
    accessMode: track.accessMode,
    priceDot: track.priceDot,
    personhoodLevel: track.personhoodLevel
  };
}

function getHistoryStateObject(): Record<string, unknown> {
  const currentState = window.history.state;
  return currentState && typeof currentState === 'object' ? (currentState as Record<string, unknown>) : {};
}

function isTrackManagedByArtist(track: CatalogTrack, artistAddress: `0x${string}`, artistName: string) {
  if (track.source !== 'artist') return false;
  if (track.artistAddress) return track.artistAddress.toLowerCase() === artistAddress.toLowerCase();
  return track.artist === artistName;
}

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  // ── View routing ─────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<View>(() => getInitialView());
  const [isArtistPortal, setIsArtistPortal] = useState(() => isArtistPortalPath());
  const [publicArtistName, setPublicArtistName] = useState<string | null>(null);
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [artistTab, setArtistTab] = useState<ArtistTab>('overview');
  const [releaseStep, setReleaseStep] = useState<ReleaseStep>('assets');

  // ── Shared state (release form, identity) ────────────────────────────────────
  const [priceDot, setPriceDot] = useState('0.5');
  const [ethRpcUrl] = useState(getDefaultEthRpcUrl);
  const [expectedChainId, setExpectedChainId] = useState<number | null>(null);
  const [title, setTitle] = useState('Untitled jam');
  const [royaltyBps, setRoyaltyBps] = useState(7000);
  const [artistName, setArtistName] = useState('');
  const [bulletinAccountIndex, setBulletinAccountIndex] = useState(0);
  const [accessMode, setAccessMode] = useState<AccessMode>('human-free');
  const [assetAction, setAssetAction] = useState<AssetAction>('idle');
  const [uploadToBulletinEnabled, setUploadToBulletinEnabled] = useState(false);
  const [personhoodLevel, setPersonhoodLevel] = useState<PersonhoodLevel>('DIM1');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [description, setDescription] = useState('Describe the story, rights context, and intended audience for this track.');
  const [transactionFeedback, setTransactionFeedback] = useState<TransactionFeedback | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  // ── Wallet ───────────────────────────────────────────────────────────────────
  const {
    state: walletState,
    connectPasskey,
    connectExtension,
    switchExtensionNetwork,
    disconnect: disconnectWallet,
    hasPrfSupport,
    hasStoredPasskey,
    forgetPasskey
  } = useWallet();
  const connectedWallet = walletState.status === 'connected' ? walletState.wallet : null;

  const currentBulletinAccount = devAccounts[bulletinAccountIndex];

  const activeEvmAddress = connectedWallet?.evmAddress ?? zeroAddress;
  const listenerEvmAddress = connectedWallet?.evmAddress ?? null;
  // Bulletin signing fails closed in production builds: dev accounts (Alice,
  // Bob, ...) use a universally known mnemonic and must never become a hidden
  // fallback signer outside local development (CLAUDE.md security posture).
  const devBulletinFallback = import.meta.env.DEV ? currentBulletinAccount : null;
  const activeSubstrateAddress = connectedWallet ? (connectedWallet.substrateAddress ?? null) : (devBulletinFallback?.address ?? null);
  const activeSubstrateSigner = connectedWallet ? (connectedWallet.substrateSigner ?? null) : (devBulletinFallback?.signer ?? null);
  const activeArtistDefaultName = 'Dotify Artist';

  const factoryAddress = deployments.factory;
  const directoryAddress = deployments.directory;

  // ── Navigation ────────────────────────────────────────────────────────────────
  function navigateToView(nextView: View, options: { replace?: boolean } = {}) {
    setPublicArtistName(null);
    setActiveView(nextView);
    const nextState = { ...getHistoryStateObject(), dotifyView: nextView };
    if (options.replace || activeView === nextView) {
      window.history.replaceState(nextState, '', window.location.href);
      return;
    }
    window.history.pushState(nextState, '', window.location.href);
  }

  function handleOpenArtistStudio() {
    setPublicArtistName(null);
    setIsArtistPortal(true);
    const nextState = { ...getHistoryStateObject(), dotifyView: activeView };
    if (isArtistPortal) {
      window.history.replaceState(nextState, '', '/artists');
    } else {
      window.history.pushState(nextState, '', '/artists');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── getActiveWalletClient (defined before hooks that need it) ─────────────────
  async function getActiveWalletClient(): Promise<Awaited<ReturnType<typeof getWalletClient>>> {
    if (!connectedWallet) {
      throw new Error('Connect a wallet before signing this transaction.');
    }
    const chain = await resolveEvmChain(ethRpcUrl);
    if (connectedWallet.chainId !== undefined && connectedWallet.chainId !== chain.id) {
      throw new Error(`Switch your wallet to chain ${chain.id}. Your wallet is currently on chain ${connectedWallet.chainId}.`);
    }
    return connectedWallet.createEvmClient(chain, ethRpcUrl) as Awaited<ReturnType<typeof getWalletClient>>;
  }

  // Use a ref to break the circular dependency between catalog and artistConsole
  // (catalog needs setBulletinManifestRef, artistConsole owns bulletinManifestRef state).
  const artistConsoleBulletinRef = useRef('');

  // ── Catalog hook ─────────────────────────────────────────────────────────────
  const catalog = useCatalog({
    ethRpcUrl,
    listenerEvmAddress,
    connectedWallet,
    directoryAddress,
    setShowWalletModal,
    setTransactionFeedback,
    setTitle,
    navigateToView,
    getActiveWalletClient,
    setBulletinManifestRef: ref => {
      artistConsoleBulletinRef.current = ref;
    },
    setAccessMode,
    setPriceDot,
    setPersonhoodLevel,
    setArtistName,
    setDescription
  });

  // ── Session hook ──────────────────────────────────────────────────────────────
  const session = useSession({
    signalUrl,
    hostAddress: listenerEvmAddress,
    audioSource: catalog.audioSource,
    trackInfo: catalog.trackInfo,
    setTrackInfo: catalog.setTrackInfo,
    setPlayerState: catalog.setPlayerState,
    localAudioRef: catalog.localAudioRef as React.RefObject<HTMLAudioElement>,
    objectUrlsRef: catalog.objectUrlsRef,
    resolvedAudioSourcesRef: catalog.resolvedAudioSourcesRef,
    navigateToView,
    setAudioSource: catalog.setAudioSource
  });

  // ── Artist portal hook ────────────────────────────────────────────────────────
  const artistConsole = useArtistConsole({
    activeEvmAddress,
    connectedWallet,
    ethRpcUrl,
    factoryAddress,
    directoryAddress,
    fileHash: catalog.fileHash,
    title,
    artistName,
    description,
    accessMode,
    priceDot,
    personhoodLevel,
    royaltyBps,
    audioSource: catalog.audioSource,
    coverFile,
    audioCID: catalog.audioCID,
    coverCID: catalog.coverCID,
    coverSource: catalog.coverSource,
    activeSubstrateAddress,
    activeSubstrateSigner,
    artistTracks: [] as CatalogTrack[], // will be updated via derived below, but needed for initial call
    setTransactionFeedback,
    refreshCatalogFromRegistry: catalog.refreshCatalogFromRegistry,
    setAudioCID: catalog.setAudioCID,
    setCoverCID: catalog.setCoverCID,
    uploadToBulletinEnabled,
    audioUploadRef: catalog.audioUploadRef,
    coverUploadRef: catalog.coverUploadRef
  });

  // ── Persistent playback layer ────────────────────────────────────────────────
  // Owns the media elements + transport state so sound survives tab changes.
  // handleOpenTrack / handleEnforcePreviewCutoff are hoisted function decls.
  const playback = usePlayback({
    mode: session.mode,
    localAudioRef: catalog.localAudioRef,
    remoteAudioRef: session.remoteAudioRef,
    audioSource: catalog.audioSource,
    remoteReady: session.remoteReady,
    localStreamReady: session.localStreamReady,
    playerState: catalog.playerState,
    catalogTracks: catalog.catalogTracks,
    selectedTrackId: catalog.selectedTrackId,
    onOpenTrack: handleOpenTrack,
    onEmitPlayerState: session.emitPlayerState
  });

  // ── Derived values ────────────────────────────────────────────────────────────
  const selectedTrack = catalog.catalogTracks.find(track => track.id === catalog.selectedTrackId);
  const selectedTrackHasAccess = selectedTrack
    ? selectedTrack.source !== 'artist' || !selectedTrack.id.includes(':') || catalog.catalogAccessByTrackId[selectedTrack.id] === true
    : false;
  const artistTracks = catalog.catalogTracks.filter(track => isTrackManagedByArtist(track, activeEvmAddress, artistName));
  const streamTitle = catalog.trackInfo?.title || selectedTrack?.title || title;
  const streamArtist = catalog.trackInfo?.artist || selectedTrack?.artist || artistName;
  const activeListeners = session.listeners.filter(listener => listener.status === 'connected').length;
  const totalRoyaltyWei = artistConsole.royaltyPayments.reduce((total, payment) => total + payment.amountWei, 0n);
  const uniqueRoyaltyListeners = new Set(artistConsole.royaltyPayments.map(payment => payment.listener.toLowerCase())).size;
  const paidRoyaltyTracks = new Set(artistConsole.royaltyPayments.map(payment => payment.trackHash.toLowerCase())).size;
  const artistRegistrationAvailable = Boolean(factoryAddress && directoryAddress);
  const artistStudioLocked = artistRegistrationAvailable && !artistConsole.artistRuntimeAddress;
  const releaseStepIndex = releaseStepsConfig.findIndex(step => step.id === releaseStep);
  const canReviewRelease = Boolean(catalog.fileHash && title.trim() && catalog.audioSource);
  const artistSetupState = connectedWallet ? (artistConsole.artistRuntimeAddress ? 'Ready' : 'Registration needed') : 'Wallet needed';
  const currentPage = viewCopy[activeView];

  // ── Effects ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      session.destroySession();
      catalog.clearObjectUrls();
      destroyBulletinClient();
    };
  }, []);

  // Locked Living Light direction: aurora ambient + lights-down listening.
  useEffect(() => {
    document.body.classList.add('ambient-aurora', 'lights-down');
    return () => document.body.classList.remove('ambient-aurora', 'lights-down');
  }, []);

  // Aura engine: paint the whole field with the active track (or artist) light.
  useEffect(() => {
    if (publicArtistName) {
      applyAura(auraForName(publicArtistName));
      return;
    }
    const activeTrack = catalog.trackInfo ?? catalog.catalogTracks.find(track => track.id === catalog.selectedTrackId) ?? null;
    applyAura(auraForTrack(activeTrack));
  }, [publicArtistName, catalog.trackInfo, catalog.selectedTrackId, catalog.catalogTracks]);

  useEffect(() => {
    window.history.replaceState({ ...getHistoryStateObject(), dotifyView: getInitialView() }, '', window.location.href);
    const onPopState = (event: PopStateEvent) => {
      setIsArtistPortal(isArtistPortalPath());
      const stateView = (event.state as { dotifyView?: unknown } | null)?.dotifyView;
      setActiveView(isDotifyView(stateView) ? stateView : getInitialView());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!transactionFeedback || transactionFeedback.tone === 'pending') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTransactionFeedback(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [transactionFeedback]);

  useEffect(() => {
    if (walletState.status === 'connected') setShowWalletModal(false);
  }, [walletState.status]);

  useEffect(() => {
    let cancelled = false;
    resolveEvmChain(ethRpcUrl)
      .then(chain => {
        if (!cancelled) setExpectedChainId(chain.id);
      })
      .catch(() => {
        if (!cancelled) setExpectedChainId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ethRpcUrl]);

  useEffect(() => {
    void catalog.refreshCatalogFromRegistry();
  }, [directoryAddress, ethRpcUrl]);

  // One-link join: a guest landing on a #/rooms/<id> share link joins the
  // room immediately. No wallet, no signature, no payment: room access is
  // host-based and the guest only receives the ephemeral WebRTC stream.
  const autoJoinAttemptedRef = useRef(false);
  useEffect(() => {
    if (autoJoinAttemptedRef.current) return;
    const initialRoomCode = getInitialRoomCode();
    if (!initialRoomCode) return;
    autoJoinAttemptedRef.current = true;
    session.joinRoom(initialRoomCode);
  }, []);

  useEffect(() => {
    if (!isArtistPortal || artistTab !== 'royalties') return;
    void artistConsole.refreshArtistRoyalties();
  }, [activeView, isArtistPortal, artistTab, artistConsole.artistRuntimeAddress, ethRpcUrl, catalog.catalogTracks.length, activeEvmAddress, artistName]);

  useEffect(() => {
    let cancelled = false;
    async function refreshCatalogAccess() {
      if (catalog.catalogTracks.length === 0) {
        catalog.setCatalogAccessByTrackId({});
        catalog.setCatalogPaidAccessByTrackId({});
        return;
      }
      const [accessEntries, paidEntries] = await Promise.all([
        Promise.all(catalog.catalogTracks.map(async track => [track.id, await catalog.checkTrackAccess(track, listenerEvmAddress)] as const)),
        Promise.all(catalog.catalogTracks.map(async track => [track.id, await catalog.checkTrackPaidAccess(track, listenerEvmAddress)] as const))
      ]);
      if (!cancelled) {
        catalog.setCatalogAccessByTrackId(Object.fromEntries(accessEntries));
        catalog.setCatalogPaidAccessByTrackId(Object.fromEntries(paidEntries));
      }
    }
    void refreshCatalogAccess();
    return () => {
      cancelled = true;
    };
  }, [catalog.catalogTracks, ethRpcUrl, listenerEvmAddress]);

  useEffect(() => {
    const storedName = getStoredArtistName(activeEvmAddress);
    if (storedName) {
      setArtistName(storedName);
      return;
    }
    setArtistName(previous => (previous.trim() && previous !== 'Dotify Artist' ? previous : activeArtistDefaultName));
  }, [activeArtistDefaultName, activeEvmAddress]);

  useEffect(() => {
    if (!isArtistPortal) return;
    const storedName = getStoredArtistName(activeEvmAddress);
    if (storedName) setArtistName(storedName);
  }, [activeView, isArtistPortal, activeEvmAddress]);

  useEffect(() => {
    void artistConsole.refreshArtistRuntime();
  }, [activeEvmAddress, directoryAddress, ethRpcUrl]);

  // ── File handlers ─────────────────────────────────────────────────────────────
  async function handleAudioFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAssetAction('audio');
    artistConsole.setRightsStatus('Hashing audio');
    catalog.setAudioCID('');
    catalog.audioUploadRef.current = null;

    try {
      const result = await hashFileWithBytes(file);
      const nextTitle = title.trim() === 'Untitled jam' ? stripExtension(file.name) : title;
      const nextUrl = URL.createObjectURL(file);
      catalog.objectUrlsRef.current.add(nextUrl);

      catalog.setAudioSource(nextUrl);
      catalog.setFileHash(result.hash);
      setTitle(nextTitle);
      catalog.setSelectedTrackId('draft-upload');
      artistConsole.setRightsStatus('Audio ready - uploading to IPFS...');

      const trackInfoObj: TrackInfo = {
        title: nextTitle.trim() || 'Untitled',
        artist: artistName.trim() || 'Unknown artist',
        hash: result.hash,
        bulletinRef: '',
        duration: 0,
        updatedAt: Date.now(),
        imageRef: catalog.coverSource,
        audioRef: `dotify:local:${result.hash}`,
        description,
        accessMode,
        priceDot: accessMode === 'classic' ? priceDot : '0',
        personhoodLevel
      };
      catalog.setTrackInfo(trackInfoObj);
      session.socketEmit('room:track', trackInfoObj);

      // Production: raw audio goes to the backend, which encrypts server-side
      // with the master-secret-derived key. Demo: browser-side encryption.
      const uploadPromise = uploadProtectedAudio({ bytes: result.bytes, name: file.name, mime: file.type }, result.hash)
        .then(cid => {
          catalog.setAudioCID(cid);
          artistConsole.setRightsStatus('Audio ready - protected and uploaded to IPFS');
          return cid;
        })
        .catch(() => {
          artistConsole.setRightsStatus('Audio ready (IPFS upload failed - will retry on register)');
          return '';
        });
      catalog.audioUploadRef.current = uploadPromise;
    } catch (audioError) {
      artistConsole.setRightsStatus(audioError instanceof Error ? audioError.message : 'Audio preparation failed');
    } finally {
      setAssetAction('idle');
      event.target.value = '';
    }
  }

  function handleCoverFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAssetAction('cover');
    artistConsole.setRightsStatus('Preparing cover image');
    catalog.setCoverCID('');
    catalog.coverUploadRef.current = null;

    try {
      const nextUrl = URL.createObjectURL(file);
      catalog.objectUrlsRef.current.add(nextUrl);
      catalog.setCoverSource(nextUrl);
      setCoverFile(file);
      artistConsole.setRightsStatus('Cover ready - uploading to IPFS...');

      const uploadPromise = uploadFileToPinata(file, file.name, { app: 'dotify', type: 'cover' })
        .then(cid => {
          catalog.setCoverCID(cid);
          artistConsole.setRightsStatus('Cover ready - uploaded to IPFS');
          return cid;
        })
        .catch(() => {
          artistConsole.setRightsStatus('Cover ready (IPFS upload failed - will retry on register)');
          return '';
        });
      catalog.coverUploadRef.current = uploadPromise;
    } catch (coverError) {
      artistConsole.setRightsStatus(coverError instanceof Error ? coverError.message : 'Cover preparation failed');
    } finally {
      setAssetAction('idle');
      event.target.value = '';
    }
  }

  // ── Step navigation ───────────────────────────────────────────────────────────
  function goToPreviousReleaseStep() {
    const previousStep = releaseStepsConfig[Math.max(0, releaseStepIndex - 1)]?.id;
    if (previousStep) setReleaseStep(previousStep);
  }

  function goToNextReleaseStep() {
    const nextStep = releaseStepsConfig[Math.min(releaseStepsConfig.length - 1, releaseStepIndex + 1)]?.id;
    if (nextStep) setReleaseStep(nextStep);
  }

  // ── Helpers bridging hooks ─────────────────────────────────────────────────────
  function handlePrepareLocalStream() {
    void session.prepareLocalStream(catalog.audioSource, catalog.trackInfo);
  }

  function handleEnforcePreviewCutoff() {
    const hostingRoom = session.mode === 'host' && Boolean(session.roomId);
    catalog.enforcePreviewCutoff(catalog.catalogTracks, catalog.selectedTrackId, {
      // Room doctrine: an unauthorized host streams the 42% preview and the
      // playlist auto-advances instead of stalling the room.
      onPreviewEnded: hostingRoom
        ? (_ended, nextTrack) => {
            if (nextTrack) {
              void catalog.selectTrack(nextTrack, session.socketEmit, session.setLocalStreamReady, session.closeHostPeers);
            }
          }
        : undefined
    });
  }

  function handleOpenTrack(track: CatalogTrack) {
    setPublicArtistName(null);
    if (isArtistPortal) {
      const nextState = { ...getHistoryStateObject(), dotifyView: 'player' };
      setIsArtistPortal(false);
      setActiveView('player');
      window.history.pushState(nextState, '', '/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      void catalog.selectTrack(track, session.socketEmit, session.setLocalStreamReady, session.closeHostPeers);
      return;
    }

    void catalog.openTrack(track, session.socketEmit, session.setLocalStreamReady, session.closeHostPeers);
  }

  function getHostPlaybackModeForRoom(track: CatalogTrack | undefined): RoomPlaybackMode {
    if (!track) return catalog.previewOnlyRef.current ? 'preview' : 'full';
    if (catalog.selectedTrackId === track.id && catalog.previewOnlyRef.current) return 'preview';
    if (catalog.accessGate?.track.id === track.id) return 'preview';
    if (track.source !== 'artist' || !track.id.includes(':')) return 'full';
    return catalog.catalogAccessByTrackId[track.id] === true ? 'full' : 'preview';
  }

  function handleOpenArtistProfile(name: string) {
    setPublicArtistName(name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleOpenArtistRoom(track: CatalogTrack) {
    setPublicArtistName(null);
    void (async () => {
      const playbackMode = await catalog.openTrack(track).catch((): RoomPlaybackMode => {
        // Room creation should still fail closed to preview metadata if track
        // preparation cannot prove full host access.
        catalog.previewOnlyRef.current = true;
        return 'preview';
      });
      session.createSession(catalogTrackToTrackInfo(track), playbackMode);
    })();
  }

  async function handleSwitchNetwork() {
    if (!connectedWallet || connectedWallet.method !== 'extension') {
      setTransactionFeedback({
        tone: 'error',
        title: 'Wallet app required',
        message: 'Only browser wallet connections can switch networks from Dotify.'
      });
      return;
    }

    setIsSwitchingNetwork(true);
    try {
      const chain = await resolveEvmChain(ethRpcUrl);
      setExpectedChainId(chain.id);
      setTransactionFeedback({
        tone: 'pending',
        title: 'Switch network',
        message: `Confirm the network switch to chain ${chain.id} in your wallet.`
      });
      await switchExtensionNetwork(chain);
      setTransactionFeedback({
        tone: 'success',
        title: 'Network ready',
        message: `Your wallet is now connected to chain ${chain.id}.`
      });
    } catch (error) {
      setTransactionFeedback({
        tone: 'error',
        title: 'Network switch failed',
        message: error instanceof Error ? error.message : 'Open your wallet and switch to the expected network, then try again.'
      });
    } finally {
      setIsSwitchingNetwork(false);
    }
  }

  function handleJoinRoomFromProfile(roomId: string) {
    setPublicArtistName(null);
    session.joinRoom(roomId);
  }

  function handleCreateSession(event?: import('react').FormEvent<HTMLFormElement>) {
    let currentTrack = catalog.trackInfo;
    if (selectedTrack && !currentTrack) {
      currentTrack = catalogTrackToTrackInfo(selectedTrack);
    }
    session.createSession(currentTrack, getHostPlaybackModeForRoom(selectedTrack), event);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const paidTrackIds = Object.entries(catalog.catalogPaidAccessByTrackId)
    .filter(([, granted]) => granted)
    .map(([id]) => id);
  const paidTracks = paidTrackIds.map(id => catalog.catalogTracks.find(track => track.id === id)).filter((track): track is CatalogTrack => Boolean(track));
  const supportedArtists = Array.from(
    paidTracks
      .reduce((artistsByKey, track) => {
        const key = track.artistAddress?.toLowerCase() ?? track.artist.toLowerCase();
        const existing = artistsByKey.get(key);
        artistsByKey.set(key, {
          artist: track.artist,
          artistAddress: track.artistAddress,
          trackCount: (existing?.trackCount ?? 0) + 1
        });
        return artistsByKey;
      }, new Map<string, { artist: string; artistAddress?: `0x${string}`; trackCount: number }>())
      .values()
  );

  const walletModal = showWalletModal && (
    <WalletModal
      state={walletState}
      hasPrfSupport={hasPrfSupport}
      hasStoredPasskey={hasStoredPasskey}
      supportingCount={supportedArtists.length}
      unlockedCount={paidTracks.length}
      supportedArtists={supportedArtists}
      paidTracks={paidTracks.map(track => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        artistAddress: track.artistAddress,
        priceDot: track.priceDot,
        hash: track.hash
      }))}
      expectedChainId={expectedChainId}
      isSwitchingNetwork={isSwitchingNetwork}
      onPasskey={() => {
        void connectPasskey();
      }}
      onExtension={() => {
        void connectExtension();
      }}
      onSwitchNetwork={() => {
        void handleSwitchNetwork();
      }}
      onForgetPasskey={forgetPasskey}
      onDisconnect={disconnectWallet}
      onOpenAccountDetails={() => {
        setShowWalletModal(false);
        navigateToView('you');
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            document.getElementById('account-dashboard-title')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
          });
        });
      }}
      onClose={() => setShowWalletModal(false)}
    />
  );

  const transactionModal = transactionFeedback && (
    <TransactionModal
      feedback={transactionFeedback}
      onClose={() => {
        if (transactionFeedback.tone !== 'pending') {
          setTransactionFeedback(null);
        }
      }}
    />
  );

  // Shared navigation model: rendered as a bottom tab bar on mobile and a
  // collapsible left rail on desktop. Same handlers, one source of truth.
  const navItems: Array<{ view: View; label: string; icon: typeof Headphones; onSelect: () => void }> = [
    { view: 'listen', label: 'Now', icon: Headphones, onSelect: () => navigateToView('listen') },
    { view: 'player', label: 'Listen', icon: Disc3, onSelect: () => navigateToView('player') },
    {
      view: 'rooms',
      label: 'Rooms',
      icon: Radio,
      onSelect: () => {
        navigateToView('rooms');
        session.requestOpenRooms(true);
      }
    },
    { view: 'you', label: 'Account', icon: UserRound, onSelect: () => navigateToView('you') }
  ];

  if (isArtistPortal) {
    return (
      <>
        <AuraBackground />
        <div className='app-shell artist-portal-shell'>
          <header className='topbar artist-portal-topbar'>
            <a className='brand' href='/' aria-label='Dotify home'>
              <span className='brand-mark'>
                <Disc3 size={21} />
              </span>
              <span>Dotify</span>
            </a>
            <nav className='nav-pills' aria-label='Artist portal actions'>
              <a className='artist-entry-link' href='/'>
                Listener app
              </a>
              <WalletStatusPill state={walletState} onClick={() => setShowWalletModal(true)} onDisconnect={disconnectWallet} />
            </nav>
          </header>

          {walletModal}

          <main className='artist-portal-main'>
            {connectedWallet && artistConsole.artistRuntimeAddress ? (
              <ArtistConsole
                artistTab={artistTab}
                onSetArtistTab={setArtistTab}
                artistName={artistName}
                activeEvmAddress={activeEvmAddress}
                artistRuntimeAddress={artistConsole.artistRuntimeAddress}
                artistRegistrationStatus={artistConsole.artistRegistrationStatus}
                isRegisteringArtist={artistConsole.isRegisteringArtist}
                isRefreshingArtistRuntime={artistConsole.isRefreshingArtistRuntime}
                artistRegistrationAvailable={artistRegistrationAvailable}
                artistSetupState={artistSetupState}
                artistTracks={artistTracks}
                connectedWallet={connectedWallet}
                onUpdateArtistName={name => artistConsole.updateArtistName(name, setArtistName)}
                onRegisterArtist={artistConsole.registerArtist}
                onRefreshArtistRuntime={() => {
                  void artistConsole.refreshArtistRuntime(true);
                }}
                onShowWalletModal={() => setShowWalletModal(true)}
                releaseStep={releaseStep}
                artistStudioLocked={artistStudioLocked}
                assetAction={assetAction}
                audioSource={catalog.audioSource}
                fileHash={catalog.fileHash}
                coverSource={catalog.coverSource}
                coverCID={catalog.coverCID}
                title={title}
                description={description}
                accessMode={accessMode}
                personhoodLevel={personhoodLevel}
                priceDot={priceDot}
                royaltyBps={royaltyBps}
                uploadToBulletinEnabled={uploadToBulletinEnabled}
                rightsStatus={artistConsole.rightsStatus}
                isRegistering={artistConsole.isRegistering}
                canReviewRelease={canReviewRelease}
                activeSubstrateAddress={activeSubstrateAddress}
                bulletinAccountIndex={bulletinAccountIndex}
                onSetReleaseStep={setReleaseStep}
                onGoToPreviousStep={goToPreviousReleaseStep}
                onGoToNextStep={goToNextReleaseStep}
                onHandleAudioFile={handleAudioFile}
                onHandleCoverFile={handleCoverFile}
                onSetTitle={setTitle}
                onSetDescription={setDescription}
                onSetAccessMode={setAccessMode}
                onSetPersonhoodLevel={setPersonhoodLevel}
                onSetPriceDot={setPriceDot}
                onSetRoyaltyBps={setRoyaltyBps}
                onSetUploadToBulletinEnabled={setUploadToBulletinEnabled}
                onSetBulletinAccountIndex={setBulletinAccountIndex}
                onRegisterRights={artistConsole.registerRights}
                onOpenTrack={handleOpenTrack}
                royaltyPayments={artistConsole.royaltyPayments}
                royaltyStatus={artistConsole.royaltyStatus}
                isRefreshingRoyalties={artistConsole.isRefreshingRoyalties}
                expandedRoyaltyPaymentId={artistConsole.expandedRoyaltyPaymentId}
                totalRoyaltyWei={totalRoyaltyWei}
                uniqueRoyaltyListeners={uniqueRoyaltyListeners}
                paidRoyaltyTracks={paidRoyaltyTracks}
                onSetExpandedRoyaltyPaymentId={artistConsole.setExpandedRoyaltyPaymentId}
                onRefreshRoyalties={() => {
                  void artistConsole.refreshArtistRoyalties(true);
                }}
                factoryAddress={factoryAddress}
                directoryAddress={directoryAddress}
                audioCID={catalog.audioCID}
                bulletinManifestRef={artistConsole.bulletinManifestRef}
                trackInfo={catalog.trackInfo}
              />
            ) : (
              <ArtistOnboarding
                activeEvmAddress={activeEvmAddress}
                artistName={artistName}
                artistRegistrationStatus={artistConsole.artistRegistrationStatus}
                isRegisteringArtist={artistConsole.isRegisteringArtist}
                isRefreshingArtistRuntime={artistConsole.isRefreshingArtistRuntime}
                artistRegistrationAvailable={artistRegistrationAvailable}
                connectedWallet={connectedWallet}
                onUpdateArtistName={name => artistConsole.updateArtistName(name, setArtistName)}
                onRegisterArtist={artistConsole.registerArtist}
                onRefreshArtistRuntime={() => {
                  void artistConsole.refreshArtistRuntime(true);
                }}
                onShowWalletModal={() => setShowWalletModal(true)}
                artistTracks={connectedWallet ? artistTracks : []}
              />
            )}
          </main>

          {transactionModal}
        </div>
      </>
    );
  }

  return (
    <>
      <AuraBackground />
      <PersistentAudio
        audioSource={catalog.audioSource}
        localAudioRef={catalog.localAudioRef}
        remoteAudioRef={session.remoteAudioRef}
        playback={playback}
        onPrepareLocalStream={handlePrepareLocalStream}
        onSetupPreviewLimit={catalog.setupPreviewLimit}
        onEnforcePreviewCutoff={handleEnforcePreviewCutoff}
        onEmitPlayerState={session.emitPlayerState}
      />
      <div className='app-shell'>
        <header className='topbar'>
          <a className='brand' href='#top' aria-label='Dotify' onClick={() => setPublicArtistName(null)}>
            <span className='brand-mark'>
              <Disc3 size={21} />
            </span>
            <span>Dotify</span>
          </a>
          <nav className='nav-pills' aria-label='Navigation'>
            <WalletStatusPill state={walletState} onClick={() => setShowWalletModal(true)} onDisconnect={disconnectWallet} />
          </nav>
        </header>

        {walletModal}

        <nav className='side-rail' data-collapsed={railCollapsed} aria-label='Library navigation'>
          <button
            className='side-rail-toggle'
            type='button'
            onClick={() => setRailCollapsed(value => !value)}
            aria-label={railCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={railCollapsed ? 'Expand' : 'Collapse'}
          >
            {railCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <div className='side-rail-items'>
            {navItems.map(item => (
              <button
                key={item.view}
                className='side-rail-item'
                type='button'
                data-active={activeView === item.view}
                onClick={item.onSelect}
                title={item.label}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className='app-content' id='top'>
          <main className={`content content-${activeView}`}>
            {publicArtistName ? (
              <ArtistProfileView
                artistName={publicArtistName}
                catalogTracks={catalog.catalogTracks}
                openRooms={session.openRooms}
                catalogAccessByTrackId={catalog.catalogAccessByTrackId}
                onBack={() => setPublicArtistName(null)}
                onOpenTrack={handleOpenTrack}
                onOpenArtistRoom={handleOpenArtistRoom}
                onJoinRoom={handleJoinRoomFromProfile}
              />
            ) : (
              <>
                <section className='page-head'>
                  <div className='page-copy'>
                    <p className='eyebrow'>{currentPage.eyebrow}</p>
                    <h1>{currentPage.title}</h1>
                  </div>
                  <div className='head-metrics'>
                    <Metric label='tracks' value={catalog.catalogTracks.length.toString()} />
                    <Metric label='rooms' value={session.openRooms.length.toString()} />
                    <Metric label='listeners' value={`${activeListeners}/${session.listenerCount}`} />
                  </div>
                </section>

                {activeView === 'listen' && (
                  <ListenView
                    catalogTracks={catalog.catalogTracks}
                    catalogStatus={catalog.catalogStatus}
                    openRooms={session.openRooms}
                    selectedTrackId={catalog.selectedTrackId}
                    catalogAccessByTrackId={catalog.catalogAccessByTrackId}
                    onOpenTrack={handleOpenTrack}
                    onOpenArtist={handleOpenArtistProfile}
                    onJoinRoom={session.joinRoom}
                    onStartRoom={() => setCreateRoomOpen(true)}
                  />
                )}

                {activeView === 'player' && (
                  <PlayerView
                    trackInfo={catalog.trackInfo}
                    selectedTrack={selectedTrack}
                    coverSource={catalog.coverSource}
                    accessGate={catalog.accessGate}
                    playback={playback}
                    mode={session.mode}
                    hostName={session.hostName}
                    roomId={session.roomId}
                    sessionLink={session.sessionLink}
                    sessionAction={session.sessionAction}
                    displayName={session.displayName}
                    joinCode={session.joinCode}
                    listeners={session.listeners}
                    remoteReady={session.remoteReady}
                    localStreamReady={session.localStreamReady}
                    error={session.error}
                    streamTitle={streamTitle}
                    streamArtist={streamArtist}
                    selectedTrackHasAccess={selectedTrackHasAccess}
                    accessMode={accessMode}
                    priceDot={priceDot}
                    description={description}
                    onSetDisplayName={session.setDisplayName}
                    onSetJoinCode={session.setJoinCode}
                    onChangeMode={session.changeMode}
                    onCreateSession={handleCreateSession}
                    onJoinSession={session.joinSession}
                    onLeaveSession={session.leaveSession}
                    onCopySessionLink={session.copySessionLink}
                    onSetAccessGate={catalog.setAccessGate}
                    onPayForTrackAccess={track => {
                      void catalog.payForTrackAccess(track);
                    }}
                    onShowWalletModal={() => setShowWalletModal(true)}
                    onNavigateToListen={() => navigateToView('listen')}
                    onOpenArtist={handleOpenArtistProfile}
                  />
                )}

                {activeView === 'rooms' && (
                  <RoomsView
                    openRooms={session.openRooms}
                    joinCode={session.joinCode}
                    sessionAction={session.sessionAction}
                    isRefreshingRooms={session.isRefreshingRooms}
                    onSetJoinCode={session.setJoinCode}
                    onJoinRoom={session.joinRoom}
                    onJoinSession={session.joinSession}
                    onRefreshRooms={() => session.requestOpenRooms(true)}
                  />
                )}

                {activeView === 'you' && (
                  <YouView
                    walletState={walletState}
                    artistName={artistName || getStoredArtistName(activeEvmAddress) || activeArtistDefaultName}
                    artistRuntimeAddress={artistConsole.artistRuntimeAddress}
                    artistReleaseCount={artistTracks.length}
                    totalRoyaltyWei={totalRoyaltyWei}
                    unlockedTrackCount={paidTracks.length}
                    supportedArtistCount={supportedArtists.length}
                    supportedArtists={supportedArtists}
                    unlockedTracks={paidTracks.map(track => ({
                      id: track.id,
                      title: track.title,
                      artist: track.artist,
                      priceDot: track.priceDot,
                      hash: track.hash
                    }))}
                    onOpenArtistStudio={handleOpenArtistStudio}
                    onShowWalletModal={() => setShowWalletModal(true)}
                    onDisconnectWallet={disconnectWallet}
                  />
                )}
              </>
            )}

            {session.sessionLink && (
              <a className='floating-link' href={session.sessionLink}>
                <LinkIcon size={15} />
                {session.roomId}
              </a>
            )}

            {transactionModal}
          </main>
        </div>

        {activeView !== 'player' && !publicArtistName && (selectedTrack || catalog.trackInfo || session.roomId) && (
          <PlayerDock
            track={selectedTrack}
            trackInfo={catalog.trackInfo}
            playback={playback}
            mode={session.mode}
            roomId={session.roomId}
            locked={Boolean(selectedTrack && selectedTrack.accessMode === 'classic' && catalog.catalogAccessByTrackId[selectedTrack.id] !== true)}
            onOpenPlayer={() => navigateToView('player')}
            onOpenArtist={handleOpenArtistProfile}
            onStartRoom={() => setCreateRoomOpen(true)}
          />
        )}

        {createRoomOpen && (
          <CreateRoomModal
            tracks={catalog.catalogTracks}
            initialTrack={selectedTrack ?? catalog.catalogTracks[0]}
            onClose={() => setCreateRoomOpen(false)}
            onOpenRoom={track => {
              setCreateRoomOpen(false);
              handleOpenArtistRoom(track);
            }}
          />
        )}

        <nav className='bottom-nav' aria-label='Main navigation'>
          {navItems.map(item => (
            <button key={item.view} className='bottom-nav-item' type='button' data-active={activeView === item.view} onClick={item.onSelect}>
              <item.icon size={22} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
