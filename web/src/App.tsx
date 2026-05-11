import {
  Copy,
  Play,
  Wifi,
  Disc3,
  Pause,
  Power,
  Radio,
  Upload,
  Wallet,
  Library,
  WifiOff,
  KeyRound,
  FileAudio,
  RefreshCw,
  BadgeCheck,
  ChevronDown,
  Headphones,
  CircleAlert,
  LockKeyhole,
  CircleCheckBig,
  type LucideIcon,
  X,
  Link as LinkIcon
} from 'lucide-react';

import { hashFileWithBytes } from './utils/hash';
import { io, type Socket } from 'socket.io-client';
import { formatEther, parseAbiItem } from 'viem';
import { deployments } from './config/deployments';
import { devAccounts } from './hooks/useDevAccounts';
import { getDefaultEthRpcUrl } from './config/network';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  ensureContract,
  evmDevAccounts,
  getPublicClient,
  getWalletClient,
  resolveEvmChain,
  artistRuntimeFactoryAbi,
  artistDirectoryAbi,
  musicRegistryAbi,
  musicAccessAbi,
  musicRoyaltiesAbi
} from './config/contracts';
import { checkBulletinAuthorization, destroyBulletinClient, encodeBulletinJson, uploadToBulletin } from './hooks/useBulletin';
import { fetchIpfsCid, getGatewayUrl, uploadFileToPinata, uploadJsonToPinata, type DotifyTrackManifest } from './services/pinata';
import { encryptTrackAudio, decryptTrackAudio, makeEncryptedAudioRef, isEncryptedAudioRef, encryptedRefToCID } from './utils/protectedAudio';
import { useWallet, type WalletState } from './hooks/useWallet';

type Mode = 'host' | 'listener';
type PersonhoodLevel = 'DIM1' | 'DIM2';
type View = 'listen' | 'player' | 'rooms' | 'artist';
type AccessMode = 'human-free' | 'classic';
type SocketStatus = 'offline' | 'connecting' | 'online' | 'error';
type PeerStatus = 'waiting' | 'connecting' | 'connected' | 'disconnected';
type SessionAction = 'idle' | 'creating' | 'joining';
type AssetAction = 'idle' | 'audio' | 'cover';
type ArtistTab = 'overview' | 'new' | 'releases' | 'royalties' | 'advanced';
type ReleaseStep = 'assets' | 'metadata' | 'access' | 'review';
type TransactionFeedbackTone = 'pending' | 'success' | 'error';
type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type RoyaltySplit = {
  label: string;
  recipient: `0x${string}`;
  bps: number;
};

type TrackInfo = {
  title: string;
  artist: string;
  duration: number;
  updatedAt: number;
  imageRef?: string;
  audioRef?: string;
  priceDot?: string;
  bulletinRef: string;
  metadataRef?: string;
  description?: string;
  accessMode?: AccessMode;
  hash: `0x${string}` | '';
  personhoodLevel?: PersonhoodLevel;
};

type PlayerState = {
  playing: boolean;
  duration: number;
  updatedAt: number;
  currentTime: number;
};

type ListenerRecord = {
  id: string;
  status: PeerStatus;
  displayName: string;
};

type CatalogTrack = {
  id: string;
  zone: string;
  title: string;
  artist: string;
  artistAddress?: `0x${string}`;
  audioRef: string;
  imageRef: string;
  priceDot: string;
  localUrl?: string;
  duration?: number;
  hash: `0x${string}`;
  description: string;
  bulletinRef: string;
  metadataRef: string;
  royaltyBps: number;
  txHash?: `0x${string}`;
  durationLabel: string;
  accessMode: AccessMode;
  source: 'seed' | 'artist';
  royaltySplits: RoyaltySplit[];
  personhoodLevel: PersonhoodLevel;
  encrypted: boolean;
};

type OnchainTrackRecord = {
  artist: `0x${string}`;
  tokenId: bigint;
  title: string;
  artistName: string;
  description: string;
  imageRef: string;
  audioRef: string;
  metadataRef: string;
  artistContractRef: string;
  royaltyBps: number;
  accessMode: number;
  pricePlanck: bigint;
  requiredPersonhood: number;
  registeredAtBlock: bigint;
  active: boolean;
};

type RegistryCatalogTrack = CatalogTrack & {
  artistAddress: `0x${string}`;
  registeredAtBlock: number;
};

type OpenRoom = {
  roomId: string;
  hostName: string;
  createdAt: number;
  listenerCount: number;
  track: TrackInfo | null;
  playerState: PlayerState | null;
};

type CreateRoomResponse = { ok: true; roomId: string; hostName: string } | { ok: false; error: string };

type JoinRoomResponse =
  | {
      ok: true;
      roomId: string;
      hostId: string;
      hostName: string;
      listenerCount: number;
      track: TrackInfo | null;
      playerState: PlayerState | null;
    }
  | { ok: false; error: string };

type CapturableMediaElement = HTMLMediaElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

type TransactionFeedback = {
  tone: TransactionFeedbackTone;
  title: string;
  message: string;
  txHash?: `0x${string}`;
};

type AccessGate = {
  track: CatalogTrack;
  title: string;
  message: string;
  hint: string;
  actionType: 'personhood' | 'payment' | 'signin';
};

type RoyaltyPayment = {
  id: string;
  trackHash: `0x${string}`;
  trackTitle: string;
  listener: `0x${string}`;
  amountWei: bigint;
  amountDot: string;
  paidAtMs: number | null;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
  logIndex: number;
};

// TODO: Update this when switching to statement store signaling
const signalUrl = import.meta.env.VITE_SIGNAL_URL ?? `${window.location.protocol}//${window.location.hostname}:8788`;
const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
const blockscoutBaseUrl = 'https://blockscout-testnet.polkadot.io';
const zeroAddress = '0x0000000000000000000000000000000000000000' as const;
const PREVIEW_RATIO = 0.42;
const musicRoyAccessPaidEvent = parseAbiItem('event MusicRoyAccessPaid(bytes32 indexed contentHash, address indexed listener, uint256 amount)');

function coverImage(primary: string, secondary: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><rect width="640" height="640" fill="${primary}"/><circle cx="490" cy="120" r="210" fill="${secondary}" opacity=".72"/><circle cx="160" cy="520" r="190" fill="#c8ff4d" opacity=".78"/><text x="48" y="108" fill="#fff" font-family="Manrope,Arial,sans-serif" font-size="42" font-weight="800">${label}</text><path d="M230 242c0-25 20-45 45-45h98v62h-70v132c0 34-28 62-62 62s-62-28-62-62 28-62 62-62c13 0 25 4 35 11v-98h-46Z" fill="#fff" opacity=".92"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const viewCopy: Record<View, { title: string; eyebrow: string }> = {
  listen: { title: 'Let the Music connect the dots', eyebrow: 'by Polkadot' },
  player: { title: 'Let the Music connect the dots', eyebrow: 'by Polkadot' },
  rooms: { title: 'Live rooms', eyebrow: 'Shared listening for people in the same moment.' },
  artist: { title: 'Artist Console', eyebrow: 'Own your catalog, set your rules, keep your audience direct.' }
};

function isDotifyView(value: unknown): value is View {
  return value === 'listen' || value === 'player' || value === 'rooms' || value === 'artist';
}

function getInitialView(): View {
  return getInitialRoomCode() ? 'rooms' : 'listen';
}

function getHistoryStateObject(): Record<string, unknown> {
  const currentState = window.history.state;
  return currentState && typeof currentState === 'object' ? (currentState as Record<string, unknown>) : {};
}

const artistTabs: Array<{ id: ArtistTab; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'Identity and next step' },
  { id: 'new', label: 'New Release', description: 'Publish under your own terms' },
  { id: 'releases', label: 'Releases', description: 'Catalog you control' },
  { id: 'royalties', label: 'Royalties', description: 'Payments received' },
  { id: 'advanced', label: 'Advanced', description: 'Proofs, contracts, and archives' }
];

const releaseSteps: Array<{ id: ReleaseStep; label: string }> = [
  { id: 'assets', label: 'Assets' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'access', label: 'Access' },
  { id: 'review', label: 'Review' }
];

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [hostName, setHostName] = useState('');
  const [listenerCount, setListenerCount] = useState(0);
  const [remoteReady, setRemoteReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('Listener');
  const [openRooms, setOpenRooms] = useState<OpenRoom[]>([]);
  const [sessionStatus, setSessionStatus] = useState('Ready');
  const [sessionAction, setSessionAction] = useState<SessionAction>('idle');
  const [localStreamReady, setLocalStreamReady] = useState(false);
  const [listeners, setListeners] = useState<ListenerRecord[]>([]);
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);
  const [audioSource, setAudioSource] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState(() => getInitialRoomCode());
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('offline');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [catalogTracks, setCatalogTracks] = useState<CatalogTrack[]>([]);
  const [catalogAccessByTrackId, setCatalogAccessByTrackId] = useState<Record<string, boolean>>({});
  const [catalogStatus, setCatalogStatus] = useState('Loading registry catalog');
  const [royaltyPayments, setRoyaltyPayments] = useState<RoyaltyPayment[]>([]);
  const [royaltyStatus, setRoyaltyStatus] = useState('No artist profile selected');
  const [isRefreshingRoyalties, setIsRefreshingRoyalties] = useState(false);
  const [expandedRoyaltyPaymentId, setExpandedRoyaltyPaymentId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(() => (getInitialRoomCode() ? 'listener' : 'host'));
  const [activeView, setActiveView] = useState<View>(() => getInitialView());
  const [artistTab, setArtistTab] = useState<ArtistTab>('overview');
  const [releaseStep, setReleaseStep] = useState<ReleaseStep>('assets');

  const [priceDot, setPriceDot] = useState('0.5');
  const [ethRpcUrl] = useState(getDefaultEthRpcUrl);
  const [title, setTitle] = useState('Untitled jam');
  const [royaltyBps, setRoyaltyBps] = useState(7000);
  const [artistAccountIndex, setArtistAccountIndex] = useState(0);
  const [artistName, setArtistName] = useState(() => getStoredArtistName(evmDevAccounts[0].account.address) || 'Dotify Artist');
  const [fileHash, setFileHash] = useState<`0x${string}` | ''>('');
  const [bulletinManifestRef, setBulletinManifestRef] = useState('');
  const [bulletinAccountIndex, setBulletinAccountIndex] = useState(0);
  const [accessMode, setAccessMode] = useState<AccessMode>('human-free');
  const [rightsStatus, setRightsStatus] = useState('No audio file selected');
  const [assetAction, setAssetAction] = useState<AssetAction>('idle');
  const [uploadToBulletinEnabled, setUploadToBulletinEnabled] = useState(false);
  const [isRefreshingRooms, setIsRefreshingRooms] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [personhoodLevel, setPersonhoodLevel] = useState<PersonhoodLevel>('DIM1');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [coverSource, setCoverSource] = useState(coverImage('#06152d', '#2bb3ff', 'Dotify'));
  const [description, setDescription] = useState('Describe the story, rights context, and intended audience for this track.');
  const [transactionFeedback, setTransactionFeedback] = useState<TransactionFeedback | null>(null);
  const [audioCID, setAudioCID] = useState('');
  const [coverCID, setCoverCID] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [artistRuntimeAddress, setArtistRuntimeAddress] = useState<`0x${string}` | null>(null);
  const [artistRegistrationStatus, setArtistRegistrationStatus] = useState('Checking artist registration');
  const [isRefreshingArtistRuntime, setIsRefreshingArtistRuntime] = useState(false);
  const [isRegisteringArtist, setIsRegisteringArtist] = useState(false);
  const [accessGate, setAccessGate] = useState<AccessGate | null>(null);

  const roomIdRef = useRef('');
  const previewOnlyRef = useRef(false);
  const previewLimitRef = useRef<number | null>(null);
  const hostIdRef = useRef('');
  const modeRef = useRef<Mode>(mode);
  const lastPlayerStateEmitRef = useRef(0);
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<ListenerRecord[]>([]);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioUploadRef = useRef<Promise<string> | null>(null);
  const coverUploadRef = useRef<Promise<string> | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const listenerPeerRef = useRef<RTCPeerConnection | null>(null);
  const hostPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const resolvedAudioSourcesRef = useRef<Map<string, string>>(new Map());

  const currentPage = viewCopy[activeView];
  const sessionLink = getSessionLink(roomId);
  const factoryAddress = deployments.factory;
  const directoryAddress = deployments.directory;
  const { state: walletState, connectPasskey, connectExtension, disconnect: disconnectWallet, hasPrfSupport, hasStoredPasskey, forgetPasskey } = useWallet();
  const connectedWallet = walletState.status === 'connected' ? walletState.wallet : null;

  const currentArtistAccount = evmDevAccounts[artistAccountIndex];
  const currentArtistAddress = currentArtistAccount.account.address;
  const currentBulletinAccount = devAccounts[bulletinAccountIndex];

  // When a wallet is connected it takes precedence over the dev account selectors.
  const activeEvmAddress = connectedWallet?.evmAddress ?? currentArtistAddress;
  const listenerEvmAddress = connectedWallet?.evmAddress ?? null;
  const activeSubstrateAddress = connectedWallet ? connectedWallet.substrateAddress : currentBulletinAccount.address;
  const activeSubstrateSigner = connectedWallet ? connectedWallet.substrateSigner : currentBulletinAccount.signer;
  const activeArtistDefaultName = connectedWallet ? 'Dotify Artist' : `${currentArtistAccount.name} Studio`;

  const selectedTrack = catalogTracks.find(track => track.id === selectedTrackId);

  const streamTitle = trackInfo?.title || selectedTrack?.title || title;
  const artistTracks = catalogTracks.filter(track => isTrackManagedByArtist(track, activeEvmAddress, artistName));
  const streamArtist = trackInfo?.artist || selectedTrack?.artist || artistName;
  const activeListeners = listeners.filter(listener => listener.status === 'connected').length;
  const totalRoyaltyWei = royaltyPayments.reduce((total, payment) => total + payment.amountWei, 0n);
  const uniqueRoyaltyListeners = new Set(royaltyPayments.map(payment => payment.listener.toLowerCase())).size;
  const paidRoyaltyTracks = new Set(royaltyPayments.map(payment => payment.trackHash.toLowerCase())).size;
  const artistRegistrationAvailable = Boolean(factoryAddress && directoryAddress);
  const artistStudioLocked = artistRegistrationAvailable && !artistRuntimeAddress;
  const releaseStepIndex = releaseSteps.findIndex(step => step.id === releaseStep);
  const canReviewRelease = Boolean(fileHash && title.trim() && audioSource);
  const artistSetupState = connectedWallet ? (artistRuntimeAddress ? 'Ready' : 'Registration needed') : 'Wallet needed';

  function navigateToView(nextView: View, options: { replace?: boolean } = {}) {
    setActiveView(nextView);
    const nextState = { ...getHistoryStateObject(), dotifyView: nextView };
    if (options.replace || activeView === nextView) {
      window.history.replaceState(nextState, '', window.location.href);
      return;
    }
    window.history.pushState(nextState, '', window.location.href);
  }

  useEffect(() => {
    const hostPeers = hostPeersRef.current;
    const objectUrls = objectUrlsRef.current;

    return () => {
      socketRef.current?.emit('room:leave');
      socketRef.current?.disconnect();
      for (const peer of hostPeers.values()) {
        peer.close();
      }
      listenerPeerRef.current?.close();
      localStreamRef.current = null;
      for (const url of objectUrls.values()) {
        URL.revokeObjectURL(url);
      }
      resolvedAudioSourcesRef.current.clear();
      destroyBulletinClient();
    };
  }, []);

  useEffect(() => {
    window.history.replaceState({ ...getHistoryStateObject(), dotifyView: getInitialView() }, '', window.location.href);

    const onPopState = (event: PopStateEvent) => {
      const stateView = (event.state as { dotifyView?: unknown } | null)?.dotifyView;
      setActiveView(isDotifyView(stateView) ? stateView : getInitialView());
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!transactionFeedback || transactionFeedback.tone === 'pending') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTransactionFeedback(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [transactionFeedback]);

  useEffect(() => {
    if (walletState.status === 'connected') {
      setShowWalletModal(false);
    }
  }, [walletState.status]);

  useEffect(() => {
    void refreshCatalogFromRegistry();
  }, [directoryAddress, ethRpcUrl]);

  useEffect(() => {
    if (activeView !== 'artist' || artistTab !== 'royalties') return;
    void refreshArtistRoyalties();
  }, [activeView, artistTab, artistRuntimeAddress, ethRpcUrl, catalogTracks.length, activeEvmAddress, artistName]);

  useEffect(() => {
    let cancelled = false;

    async function refreshCatalogAccess() {
      if (catalogTracks.length === 0) {
        setCatalogAccessByTrackId({});
        return;
      }

      const accessEntries = await Promise.all(catalogTracks.map(async track => [track.id, await checkTrackAccess(track, listenerEvmAddress)] as const));

      if (!cancelled) {
        setCatalogAccessByTrackId(Object.fromEntries(accessEntries));
      }
    }

    void refreshCatalogAccess();

    return () => {
      cancelled = true;
    };
  }, [catalogTracks, ethRpcUrl, listenerEvmAddress]);

  useEffect(() => {
    const storedName = getStoredArtistName(activeEvmAddress);
    if (storedName) {
      setArtistName(storedName);
      return;
    }

    setArtistName(previous => (previous.trim() && previous !== 'Dotify Artist' ? previous : activeArtistDefaultName));
  }, [activeArtistDefaultName, activeEvmAddress]);

  useEffect(() => {
    if (activeView !== 'artist') return;
    const storedName = getStoredArtistName(activeEvmAddress);
    if (storedName) {
      setArtistName(storedName);
    }
  }, [activeView, activeEvmAddress]);

  useEffect(() => {
    void refreshArtistRuntime();
  }, [activeEvmAddress, directoryAddress, ethRpcUrl]);

  function getSocket() {
    if (socketRef.current) return socketRef.current;

    const socket = io(signalUrl, {
      autoConnect: false,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      setSocketStatus('online');
      setError(null);
      socket.emit('rooms:list', (rooms: OpenRoom[]) => setOpenRooms(normalizeRooms(rooms)));
    });
    socket.on('connect_error', () => {
      setSocketStatus('error');
      setSessionAction('idle');
      setIsRefreshingRooms(false);
      setError(`Signal server unavailable: ${signalUrl}`);
    });
    socket.on('disconnect', () => setSocketStatus('offline'));
    socket.on('rooms:updated', (rooms: OpenRoom[]) => setOpenRooms(normalizeRooms(rooms)));
    socket.on('listener:joined', (payload: { listenerId: string; displayName: string; listenerCount: number }) => {
      upsertListener({
        id: payload.listenerId,
        displayName: payload.displayName,
        status: localStreamRef.current ? 'connecting' : 'waiting'
      });
      setListenerCount(payload.listenerCount);
      setSessionStatus(localStreamRef.current ? 'Pairing listener' : 'Room open');
      if (localStreamRef.current) {
        void createOfferForListener(payload.listenerId);
      }
    });
    socket.on('listener:left', (payload: { listenerId: string; listenerCount: number }) => {
      hostPeersRef.current.get(payload.listenerId)?.close();
      hostPeersRef.current.delete(payload.listenerId);
      removeListener(payload.listenerId);
      setListenerCount(payload.listenerCount);
    });
    socket.on('room:listener-count', (payload: { listenerCount: number }) => {
      setListenerCount(payload.listenerCount);
    });
    socket.on('room:track', (track: TrackInfo | null) => setTrackInfo(track));
    socket.on('player:state', (state: PlayerState | null) => setPlayerState(state));
    socket.on('room:closed', (payload: { reason?: string }) => {
      closeListenerPeer();
      setRemoteReady(false);
      setSessionAction('idle');
      setSessionStatus(payload.reason ?? 'Room closed');
      setError(payload.reason ?? 'Room closed');
    });
    socket.on('webrtc:offer', (payload: { from: string; offer: RTCSessionDescriptionInit }) => {
      void acceptOffer(payload.from, payload.offer);
    });
    socket.on('webrtc:answer', (payload: { from: string; answer: RTCSessionDescriptionInit }) => {
      void acceptAnswer(payload.from, payload.answer);
    });
    socket.on('webrtc:ice-candidate', (payload: { from: string; candidate: RTCIceCandidateInit }) => {
      void addRemoteCandidate(payload.from, payload.candidate);
    });
    socket.on('peer:connected', (payload: { from: string }) => {
      upsertListenerStatus(payload.from, 'connected');
    });

    socketRef.current = socket;
    return socket;
  }

  function connectSocket() {
    const socket = getSocket();
    if (!socket.connected) {
      setSocketStatus('connecting');
      socket.connect();
    }
    return socket;
  }

  function requestOpenRooms(showBusy = false) {
    if (showBusy) {
      setIsRefreshingRooms(true);
    }

    connectSocket().emit('rooms:list', (rooms: OpenRoom[]) => {
      setOpenRooms(normalizeRooms(rooms));
      if (showBusy) {
        setIsRefreshingRooms(false);
      }
    });
  }

  function changeMode(nextMode: Mode) {
    modeRef.current = nextMode;
    setMode(nextMode);
  }

  async function selectTrack(track: CatalogTrack) {
    setSelectedTrackId(track.id);
    setTitle(track.title);
    setArtistName(track.artist);
    setDescription(track.description);
    setCoverSource(track.imageRef);
    setBulletinManifestRef(track.metadataRef);
    setFileHash(track.hash);
    setAccessMode(track.accessMode);
    setPriceDot(track.priceDot);
    setPersonhoodLevel(track.personhoodLevel);
    setTrackInfo(createTrackInfoFromCatalog(track));
    setPlayerState(null);
    setAccessGate(null);
    previewOnlyRef.current = false;
    previewLimitRef.current = null;

    let audioUrl: string | null = null;

    if (track.localUrl) {
      const hasAccess = await checkTrackAccess(track, listenerEvmAddress);
      setCatalogAccessByTrackId(previous => ({ ...previous, [track.id]: hasAccess }));
      const previewOnly = !hasAccess;
      previewOnlyRef.current = previewOnly;

      audioUrl = track.encrypted
        ? await fetchAndDecryptAudio(track.audioRef, track.localUrl, track.hash, { previewOnly }).catch(() => null)
        : await resolvePlayableAudioSource(track.localUrl, track.audioRef, { previewOnly }).catch(() => null);

      if (previewOnly) {
        setAccessGate(buildAccessGateInfo(track));
      }
    }

    setAudioSource(audioUrl);

    if (!audioUrl) {
      localStreamRef.current = null;
      setLocalStreamReady(false);
      closeHostPeers();
      setSessionStatus(track.encrypted && track.localUrl ? 'Decryption failed' : 'Source required');
    }

    socketRef.current?.emit('room:track', createTrackInfoFromCatalog(track));
  }

  async function openTrack(track: CatalogTrack) {
    navigateToView('player');
    await selectTrack(track);
  }

  // Returns true only when the connected listener has on-chain access to the track.
  // Fails closed for registered tracks so unauthenticated users never receive full playback.
  async function checkTrackAccess(track: CatalogTrack, listenerAddress: `0x${string}` | null): Promise<boolean> {
    if (track.source !== 'artist' || !track.id.includes(':')) return true;
    if (!listenerAddress) return false;
    const runtimeAddress = track.id.split(':')[0] as `0x${string}`;
    try {
      return (await getPublicClient(ethRpcUrl).readContract({
        address: runtimeAddress,
        abi: musicAccessAbi,
        functionName: 'musicAccCanAccess',
        args: [track.hash, listenerAddress]
      })) as boolean;
    } catch {
      return false;
    }
  }

  function buildAccessGateInfo(track: CatalogTrack): AccessGate {
    if (!connectedWallet) {
      if (track.accessMode === 'classic') {
        return {
          track,
          title: 'Payment unlock',
          message: `"${track.title}" costs ${track.priceDot} DOT for full access. Connect a wallet first, then pay the artist directly.`,
          hint: 'No account required. Your wallet handles the payment and access proof.',
          actionType: 'signin'
        };
      }

      return {
        track,
        title: 'Proof needed',
        message: `"${track.title}" is protected by the artist. You can preview 42% now; connect a wallet to prove access without creating an account.`,
        hint: 'Your wallet is your key. Dotify does not need your private information.',
        actionType: 'signin'
      };
    }

    if (track.accessMode === 'human-free') {
      return {
        track,
        title: 'Proof Of Personhood required',
        message: `"${track.title}" is reserved for listeners with ${track.personhoodLevel} personhood proof. You can preview 42% now.`,
        hint: 'Personhood proves you are a real human.',
        actionType: 'personhood'
      };
    }
    return {
      track,
      title: 'Payment unlock',
      message: `"${track.title}" unlocks after a ${track.priceDot} DOT payment. You can preview 42% now.`,
      hint: 'Your payment goes Directly to the artist, not an opaque intermediary account.',
      actionType: 'payment'
    };
  }

  // Called from onLoadedMetadata. Sets the preview cutoff when access is restricted.
  function setupPreviewLimit() {
    const audio = localAudioRef.current;
    if (!audio || !previewOnlyRef.current || !Number.isFinite(audio.duration)) return;
    previewLimitRef.current = audio.duration * PREVIEW_RATIO;
  }

  // Called from onTimeUpdate and onPlay. Pauses and shows gate when limit is reached.
  function enforcePreviewCutoff() {
    const audio = localAudioRef.current;
    const limit = previewLimitRef.current;
    if (!audio || limit === null || audio.paused) return;
    if (audio.currentTime >= limit) {
      audio.pause();
      const track = catalogTracks.find(t => t.id === selectedTrackId) ?? null;
      if (track) setAccessGate(buildAccessGateInfo(track));
    }
  }

  // Submits the on-chain royalty payment for a paid track, then replays with full access.
  async function payForTrackAccess(track: CatalogTrack) {
    if (!connectedWallet) {
      setAccessGate(buildAccessGateInfo(track));
      setShowWalletModal(true);
      return;
    }

    const runtimeAddress = track.id.split(':')[0] as `0x${string}`;
    // Convert Substrate planck (10 decimals) → EVM wei (18 decimals)
    const priceWei = dotToPlanck(track.priceDot) * 100_000_000n;

    setAccessGate(null);
    setTransactionFeedback({
      tone: 'pending',
      title: 'Processing payment',
      message: `Paying ${track.priceDot} DOT to unlock "${track.title}".`
    });

    try {
      const walletClient = await getActiveWalletClient();
      const txHash = await walletClient.writeContract({
        address: runtimeAddress,
        abi: musicRoyaltiesAbi,
        functionName: 'musicRoyPayAccess',
        args: [track.hash],
        value: priceWei
      });
      setTransactionFeedback({ tone: 'pending', title: 'Awaiting confirmation', message: 'Payment submitted.', txHash });
      await getPublicClient(ethRpcUrl).waitForTransactionReceipt({ hash: txHash });

      previewOnlyRef.current = false;
      previewLimitRef.current = null;
      setCatalogAccessByTrackId(previous => ({ ...previous, [track.id]: true }));
      setTransactionFeedback({ tone: 'success', title: 'Access unlocked', message: `Full playback of "${track.title}" is now available.`, txHash });
      await selectTrack(track);
    } catch (payError) {
      const message = payError instanceof Error ? payError.message : 'Payment failed';
      setTransactionFeedback({ tone: 'error', title: 'Payment failed', message });
    }
  }

  async function resolvePlayableAudioSource(source: string, cacheKey: string, options: { previewOnly: boolean }): Promise<string> {
    if (!options.previewOnly) return source;

    const previewCacheKey = `${cacheKey}:preview`;
    const cached = resolvedAudioSourcesRef.current.get(previewCacheKey);
    if (cached) return cached;

    const response = await fetch(source);
    if (!response.ok) throw new Error(`Unable to fetch preview audio (${response.status})`);

    const sourceBytes = new Uint8Array(await response.arrayBuffer());
    return createPreviewAudioObjectUrl(sourceBytes, previewCacheKey);
  }

  async function fetchAndDecryptAudio(audioRef: string, gatewayUrl: string, contentHash: `0x${string}`, options: { previewOnly: boolean }): Promise<string> {
    const cacheKey = options.previewOnly ? `${audioRef}:preview` : audioRef;
    const cached = resolvedAudioSourcesRef.current.get(cacheKey);
    if (cached) return cached;

    const response = isEncryptedAudioRef(audioRef) ? await fetchIpfsCid(encryptedRefToCID(audioRef)) : await fetch(gatewayUrl);
    if (!response.ok) throw new Error(`Unable to fetch encrypted audio (${response.status})`);

    const encryptedBytes = new Uint8Array(await response.arrayBuffer());
    const clearBytes = await decryptTrackAudio(encryptedBytes, contentHash);
    if (options.previewOnly) {
      return createPreviewAudioObjectUrl(clearBytes, cacheKey);
    }

    const blob = new Blob([clearBytes]);
    const objectUrl = URL.createObjectURL(blob);
    objectUrlsRef.current.add(objectUrl);
    resolvedAudioSourcesRef.current.set(cacheKey, objectUrl);
    return objectUrl;
  }

  async function createPreviewAudioObjectUrl(audioBytes: Uint8Array, cacheKey: string): Promise<string> {
    const AudioContextCtor = window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
    if (!AudioContextCtor) throw new Error('Audio previews are not supported in this browser.');

    const audioContext = new AudioContextCtor();
    try {
      const audioData = audioBytes.buffer.slice(audioBytes.byteOffset, audioBytes.byteOffset + audioBytes.byteLength);
      const audioBuffer = await audioContext.decodeAudioData(audioData);
      const previewFrameCount = Math.max(1, Math.floor(audioBuffer.length * PREVIEW_RATIO));
      const previewBytes = encodeAudioBufferPreviewAsWav(audioBuffer, previewFrameCount);
      const objectUrl = URL.createObjectURL(new Blob([previewBytes], { type: 'audio/wav' }));
      objectUrlsRef.current.add(objectUrl);
      resolvedAudioSourcesRef.current.set(cacheKey, objectUrl);
      return objectUrl;
    } finally {
      await audioContext.close();
    }
  }

  async function refreshArtistRuntime(showBusy = false) {
    if (!artistRegistrationAvailable) {
      setArtistRuntimeAddress(null);
      setArtistRegistrationStatus('Artist runtime contracts are not deployed yet.');
      return null;
    }

    if (showBusy) {
      setIsRefreshingArtistRuntime(true);
    }

    setArtistRegistrationStatus('Checking artist runtime');

    try {
      const directoryExists = await ensureContract(directoryAddress, ethRpcUrl);
      if (!directoryExists) {
        setArtistRuntimeAddress(null);
        setArtistRegistrationStatus('Artist directory unavailable');
        return null;
      }

      const runtimeAddress = (await getPublicClient(ethRpcUrl).readContract({
        address: directoryAddress,
        abi: artistDirectoryAbi,
        functionName: 'runtimeOf',
        args: [activeEvmAddress]
      })) as `0x${string}`;

      if (runtimeAddress === zeroAddress) {
        setArtistRuntimeAddress(null);
        setArtistRegistrationStatus('Artist not registered yet');
        return null;
      }

      setArtistRuntimeAddress(runtimeAddress);
      setArtistRegistrationStatus('Artist registered');
      return runtimeAddress;
    } catch (runtimeError) {
      const message = runtimeError instanceof Error ? runtimeError.message : 'Unable to resolve artist runtime';
      setArtistRuntimeAddress(null);
      setArtistRegistrationStatus(message);
      return null;
    } finally {
      if (showBusy) {
        setIsRefreshingArtistRuntime(false);
      }
    }
  }

  async function refreshCatalogFromRegistry(preferredTrackHash?: `0x${string}`) {
    if (!directoryAddress) {
      setCatalogTracks([]);
      setSelectedTrackId('');
      setCatalogStatus('Registry directory not configured');
      return [];
    }

    setCatalogStatus('Loading registry catalog');

    try {
      const directoryExists = await ensureContract(directoryAddress, ethRpcUrl);
      if (!directoryExists) {
        setCatalogTracks([]);
        setSelectedTrackId('');
        setCatalogStatus('Registry directory unavailable');
        return [];
      }

      const client = getPublicClient(ethRpcUrl);
      const artistCount = (await client.readContract({
        address: directoryAddress,
        abi: artistDirectoryAbi,
        functionName: 'artistCount'
      })) as bigint;

      if (artistCount === 0n) {
        setCatalogTracks([]);
        setSelectedTrackId('');
        setCatalogStatus('No tracks registered on this directory yet');
        return [];
      }

      const entries = await fetchDirectoryEntries(client, directoryAddress, artistCount);
      const runtimeCatalogs = await Promise.all(
        entries.map(async entry => {
          try {
            return await fetchRuntimeCatalog(client, entry.artist, entry.runtime);
          } catch (runtimeError) {
            console.warn(`Failed to load runtime catalog for ${entry.runtime}`, runtimeError);
            return [];
          }
        })
      );
      const nextCatalog = runtimeCatalogs
        .flat()
        .sort((left, right) => {
          if (left.registeredAtBlock !== right.registeredAtBlock) {
            return right.registeredAtBlock - left.registeredAtBlock;
          }
          return left.title.localeCompare(right.title);
        })
        .map(({ registeredAtBlock: _registeredAtBlock, ...track }): CatalogTrack => track);

      setCatalogTracks(nextCatalog);
      setSelectedTrackId(previous => {
        const preferredTrack = preferredTrackHash ? nextCatalog.find(track => track.hash.toLowerCase() === preferredTrackHash.toLowerCase()) : null;
        if (preferredTrack) return preferredTrack.id;
        return nextCatalog.some(track => track.id === previous) ? previous : (nextCatalog[0]?.id ?? '');
      });
      setCatalogStatus(
        nextCatalog.length > 0
          ? `Loaded ${nextCatalog.length} registered track${nextCatalog.length > 1 ? 's' : ''}`
          : 'No tracks registered on this directory yet'
      );
      return nextCatalog;
    } catch (catalogError) {
      const message = catalogError instanceof Error ? catalogError.message : 'Unable to load registry catalog';
      console.warn('Failed to load registry catalog', catalogError);
      setCatalogTracks([]);
      setSelectedTrackId('');
      setCatalogStatus(message);
      return [];
    }
  }

  async function refreshArtistRoyalties(showBusy = false) {
    if (!artistRuntimeAddress) {
      setRoyaltyPayments([]);
      setRoyaltyStatus('Create an artist profile to track payments');
      return;
    }

    if (showBusy) {
      setIsRefreshingRoyalties(true);
    }

    setRoyaltyStatus('Reading artist runtime payments');

    try {
      const client = getPublicClient(ethRpcUrl);
      const trackByHash = new Map(artistTracks.map(track => [track.hash.toLowerCase(), track]));
      const logs = await client.getLogs({
        address: artistRuntimeAddress,
        event: musicRoyAccessPaidEvent,
        fromBlock: 0n,
        toBlock: 'latest'
      });
      const blockTimestampsByNumber = new Map<string, bigint>();
      await Promise.all(
        Array.from(new Set(logs.map(log => log.blockNumber.toString()))).map(async blockNumber => {
          const block = await client.getBlock({ blockNumber: BigInt(blockNumber) });
          blockTimestampsByNumber.set(blockNumber, block.timestamp);
        })
      );

      const payments = logs
        .map(log => {
          const trackHash = log.args.contentHash;
          const listener = log.args.listener;
          const amountWei = log.args.amount;

          if (!trackHash || !listener || amountWei === undefined) {
            return null;
          }

          const track = trackByHash.get(trackHash.toLowerCase());

          return {
            id: `${log.transactionHash}-${log.logIndex}`,
            trackHash,
            trackTitle: track?.title ?? shorten(trackHash, 14),
            listener,
            amountWei,
            amountDot: formatWeiAsDot(amountWei),
            paidAtMs: formatBlockTimestampMs(blockTimestampsByNumber.get(log.blockNumber.toString())),
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex
          } satisfies RoyaltyPayment;
        })
        .filter((payment): payment is RoyaltyPayment => Boolean(payment))
        .sort((left, right) => {
          if (left.blockNumber !== right.blockNumber) {
            return left.blockNumber > right.blockNumber ? -1 : 1;
          }

          return right.logIndex - left.logIndex;
        });

      setRoyaltyPayments(payments);
      setRoyaltyStatus(payments.length > 0 ? 'Payments indexed from your runtime' : 'No access payments received yet');
    } catch (royaltyError) {
      const message = royaltyError instanceof Error ? royaltyError.message : 'Unable to load royalty payments';
      setRoyaltyPayments([]);
      setRoyaltyStatus(message);
    } finally {
      if (showBusy) {
        setIsRefreshingRoyalties(false);
      }
    }
  }

  /** Returns the right viem WalletClient: connected wallet first, dev account fallback. */
  async function getActiveWalletClient(): Promise<Awaited<ReturnType<typeof getWalletClient>>> {
    if (connectedWallet) {
      const chain = await resolveEvmChain(ethRpcUrl);
      return connectedWallet.createEvmClient(chain, ethRpcUrl) as Awaited<ReturnType<typeof getWalletClient>>;
    }
    return getWalletClient(artistAccountIndex, ethRpcUrl);
  }

  function updateArtistName(nextName: string) {
    setArtistName(nextName);
    storeArtistName(activeEvmAddress, nextName);
  }

  async function fetchDirectoryEntries(client: ReturnType<typeof getPublicClient>, registryAddress: `0x${string}`, artistCount: bigint) {
    const pageSize = 50n;
    const entries: Array<{ artist: `0x${string}`; runtime: `0x${string}` }> = [];

    for (let offset = 0n; offset < artistCount; offset += pageSize) {
      const limit = artistCount - offset > pageSize ? pageSize : artistCount - offset;
      const [artists, runtimes] = (await client.readContract({
        address: registryAddress,
        abi: artistDirectoryAbi,
        functionName: 'artistsPage',
        args: [offset, limit]
      })) as [`0x${string}`[], `0x${string}`[]];

      for (let index = 0; index < artists.length; index += 1) {
        const artist = artists[index];
        const runtime = runtimes[index];
        if (!artist || !runtime || runtime === zeroAddress) continue;
        entries.push({ artist, runtime });
      }
    }

    return entries;
  }

  async function fetchRuntimeCatalog(
    client: ReturnType<typeof getPublicClient>,
    artistAddress: `0x${string}`,
    runtimeAddress: `0x${string}`
  ): Promise<RegistryCatalogTrack[]> {
    const trackCount = (await client.readContract({
      address: runtimeAddress,
      abi: musicRegistryAbi,
      functionName: 'musicRegTrackCount'
    })) as bigint;

    const tracks: Array<RegistryCatalogTrack | null> = await Promise.all(
      Array.from({ length: Number(trackCount) }, async (_, index) => {
        const hash = (await client.readContract({
          address: runtimeAddress,
          abi: musicRegistryAbi,
          functionName: 'musicRegTrackHashAtIndex',
          args: [BigInt(index)]
        })) as `0x${string}`;

        const [track] = (await client.readContract({
          address: runtimeAddress,
          abi: musicRegistryAbi,
          functionName: 'musicRegGetTrack',
          args: [hash]
        })) as [OnchainTrackRecord, `0x${string}`];

        if (!track.active) {
          return null;
        }

        const imageRef = resolveVisualAssetRef(track.imageRef, track.title);
        const encrypted = isEncryptedAudioRef(track.audioRef);
        const localUrl = resolveAudioAssetRef(track.audioRef);

        return {
          id: `${runtimeAddress}:${hash}`,
          hash,
          title: track.title,
          artist: track.artistName,
          artistAddress: track.artist || artistAddress,
          audioRef: track.audioRef,
          imageRef,
          priceDot: formatPlanckAsDot(track.pricePlanck),
          localUrl,
          description: track.description,
          bulletinRef: track.metadataRef.startsWith('paseo-bulletin:') ? track.metadataRef : '',
          metadataRef: track.metadataRef,
          royaltyBps: Number(track.royaltyBps),
          txHash: undefined,
          durationLabel: 'ready',
          accessMode: (track.accessMode === 1 ? 'classic' : 'human-free') as AccessMode,
          source: 'artist' as const,
          royaltySplits: [],
          personhoodLevel: track.requiredPersonhood === 2 ? 'DIM2' : 'DIM1',
          zone: 'Registry',
          encrypted,
          registeredAtBlock: Number(track.registeredAtBlock)
        };
      })
    );

    return tracks.flatMap(track => (track ? [track] : []));
  }

  async function registerArtist() {
    if (!artistRegistrationAvailable) {
      setTransactionFeedback({
        tone: 'error',
        title: 'Artist registry unavailable',
        message: 'Deploy the ArtistRuntimeFactory and ArtistDirectory before registering an artist.'
      });
      return;
    }

    setIsRegisteringArtist(true);

    try {
      const existingRuntime = await refreshArtistRuntime();
      if (existingRuntime) {
        setTransactionFeedback({
          tone: 'success',
          title: 'Artist already registered',
          message: 'This signer already owns a SmartRuntime and can manage releases.'
        });
        return;
      }

      const factoryExists = await ensureContract(factoryAddress, ethRpcUrl);
      if (!factoryExists) {
        setTransactionFeedback({
          tone: 'error',
          title: 'Factory unavailable',
          message: 'ArtistRuntimeFactory not found at the configured address.'
        });
        return;
      }

      const walletClient = await getActiveWalletClient();
      const publicClient = getPublicClient(ethRpcUrl);

      setArtistRegistrationStatus('Creating artist runtime');
      const txHash = await walletClient.writeContract({
        address: factoryAddress,
        abi: artistRuntimeFactoryAbi,
        functionName: 'createRuntime'
      });

      setTransactionFeedback({
        tone: 'pending',
        title: 'Registering artist',
        message: 'Creating the personal SmartRuntime for this artist signer.',
        txHash
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });
      const runtimeAddress = await refreshArtistRuntime();

      if (!runtimeAddress) {
        throw new Error('Artist runtime was not indexed after confirmation');
      }

      setRightsStatus('Artist registered. Add audio and publish the first release.');
      setTransactionFeedback({
        tone: 'success',
        title: 'Artist registered',
        message: 'The artist signer now owns a personal SmartRuntime and can manage releases.',
        txHash
      });
    } catch (registrationError) {
      const message = describeArtistRegistrationError(registrationError);
      setArtistRegistrationStatus(message);
      setTransactionFeedback({
        tone: 'error',
        title: 'Artist registration failed',
        message
      });
    } finally {
      setIsRegisteringArtist(false);
    }
  }

  function createSession(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setSessionAction('creating');
    changeMode('host');
    navigateToView('player');
    setError(null);
    setSessionStatus('Opening room');
    closeListenerPeer();

    const socket = connectSocket();
    socket.emit('room:create', { displayName, track: getCurrentTrack() }, (response: CreateRoomResponse) => {
      setSessionAction('idle');
      if (!response.ok) {
        setError(response.error);
        setSessionStatus('Error');
        return;
      }

      roomIdRef.current = response.roomId;
      setRoomId(response.roomId);
      setHostName(response.hostName);
      setListeners([]);
      listenersRef.current = [];
      setListenerCount(0);
      setSessionStatus(localStreamRef.current ? 'Live' : 'Room open');
      requestOpenRooms();
    });
  }

  function joinSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    joinRoom(joinCode);
  }

  function joinRoom(roomCode: string) {
    const normalizedRoomId = normalizeRoomCode(roomCode);
    if (!normalizedRoomId) {
      setError('Room code required');
      return;
    }

    changeMode('listener');
    setSessionAction('joining');
    navigateToView('player');
    setError(null);
    setSessionStatus('Joining room');
    closeHostPeers();

    const socket = connectSocket();
    socket.emit('room:join', { roomId: normalizedRoomId, displayName }, (response: JoinRoomResponse) => {
      setSessionAction('idle');
      if (!response.ok) {
        setError(response.error);
        setSessionStatus('Error');
        return;
      }

      roomIdRef.current = response.roomId;
      hostIdRef.current = response.hostId;
      setRoomId(response.roomId);
      setJoinCode(response.roomId);
      setHostName(response.hostName);
      setTrackInfo(response.track);
      setPlayerState(response.playerState);
      setListenerCount(response.listenerCount);
      setSessionStatus(response.track ? 'Waiting stream' : 'Connected');
      requestOpenRooms();
    });
  }

  function leaveSession() {
    socketRef.current?.emit('room:leave');
    closeAllPeers();
    roomIdRef.current = '';
    hostIdRef.current = '';
    setRoomId('');
    setHostName('');
    setListeners([]);
    listenersRef.current = [];
    setListenerCount(0);
    setRemoteReady(false);
    setSessionStatus('Ready');
    setError(null);
    requestOpenRooms();
  }

  async function handleAudioFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAssetAction('audio');
    setRightsStatus('Hashing audio');
    setAudioCID('');
    audioUploadRef.current = null;

    try {
      const result = await hashFileWithBytes(file);
      const nextTitle = title.trim() === 'Untitled jam' ? stripExtension(file.name) : title;
      const nextUrl = URL.createObjectURL(file);
      objectUrlsRef.current.add(nextUrl);

      setAudioSource(nextUrl);
      setFileHash(result.hash);
      setTitle(nextTitle);
      setSelectedTrackId('draft-upload');
      setRightsStatus('Audio ready — uploading to IPFS…');

      const track = createTrackInfo(nextTitle, artistName, result.hash, '', 0, {
        imageRef: coverSource,
        audioRef: `dotify:local:${result.hash}`,
        description,
        accessMode,
        priceDot: accessMode === 'classic' ? priceDot : '0',
        personhoodLevel
      });
      setTrackInfo(track);
      socketRef.current?.emit('room:track', track);

      const uploadPromise = (async () => {
        const encryptedBytes = await encryptTrackAudio(result.bytes, result.hash);
        const encBlob = new Blob([encryptedBytes], { type: 'application/octet-stream' });
        const encFile = new File([encBlob], `${file.name}.enc`, { type: 'application/octet-stream' });
        return uploadFileToPinata(encFile, `${file.name}.enc`, { app: 'dotify', type: 'audio', encrypted: 'true' });
      })()
        .then(cid => {
          setAudioCID(cid);
          setRightsStatus('Audio ready — encrypted and uploaded to IPFS');
          return cid;
        })
        .catch(() => {
          setRightsStatus('Audio ready (IPFS upload failed — will retry on register)');
          return '';
        });
      audioUploadRef.current = uploadPromise;
    } catch (audioError) {
      setRightsStatus(audioError instanceof Error ? audioError.message : 'Audio preparation failed');
    } finally {
      setAssetAction('idle');
      event.target.value = '';
    }
  }

  function handleCoverFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAssetAction('cover');
    setRightsStatus('Preparing cover image');
    setCoverCID('');
    coverUploadRef.current = null;

    try {
      const nextUrl = URL.createObjectURL(file);
      objectUrlsRef.current.add(nextUrl);
      setCoverSource(nextUrl);
      setCoverFile(file);
      setRightsStatus('Cover ready — uploading to IPFS…');

      const uploadPromise = uploadFileToPinata(file, file.name, { app: 'dotify', type: 'cover' })
        .then(cid => {
          setCoverCID(cid);
          setRightsStatus('Cover ready — uploaded to IPFS');
          return cid;
        })
        .catch(() => {
          setRightsStatus('Cover ready (IPFS upload failed — will retry on register)');
          return '';
        });
      coverUploadRef.current = uploadPromise;
    } catch (coverError) {
      setRightsStatus(coverError instanceof Error ? coverError.message : 'Cover preparation failed');
    } finally {
      setAssetAction('idle');
      event.target.value = '';
    }
  }

  async function prepareLocalStream() {
    const audio = localAudioRef.current;
    if (!audio || !audioSource) return;

    try {
      const capturableSource = await ensureCapturableAudioSource(audioSource);
      if (capturableSource !== audioSource) {
        setSessionStatus('Preparing source');
        setAudioSource(capturableSource);
        return;
      }

      const stream = captureAudioStream(audio);
      const track = {
        ...getCurrentTrack(),
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        updatedAt: getTimestamp()
      };

      localStreamRef.current = stream;
      setLocalStreamReady(true);
      setTrackInfo(track);
      setSessionStatus(roomIdRef.current ? 'Live' : 'Audio ready');
      socketRef.current?.emit('room:track', track);

      await Promise.all(listenersRef.current.map(listener => createOfferForListener(listener.id)));
    } catch (streamError) {
      setError(streamError instanceof Error ? streamError.message : 'Audio capture unavailable in this browser');
      setSessionStatus('Capture unavailable');
    }
  }

  function emitPlayerState(force = false) {
    const audio = localAudioRef.current;
    if (!audio) return;

    const timestamp = getTimestamp();
    if (!force && timestamp - lastPlayerStateEmitRef.current < 900) return;

    lastPlayerStateEmitRef.current = timestamp;
    const state: PlayerState = {
      playing: !audio.paused,
      currentTime: audio.currentTime,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      updatedAt: timestamp
    };

    setPlayerState(state);
    socketRef.current?.emit('player:state', state);
  }

  function getCurrentTrack(): TrackInfo {
    if (selectedTrack) {
      return createTrackInfoFromCatalog(selectedTrack);
    }

    return createTrackInfo(title, artistName, fileHash, trackInfo?.bulletinRef ?? '', 0, {
      imageRef: coverSource,
      audioRef: fileHash ? `dotify:local:${fileHash}` : undefined,
      metadataRef: bulletinManifestRef || trackInfo?.metadataRef,
      description,
      accessMode,
      priceDot: accessMode === 'classic' ? priceDot : '0',
      personhoodLevel
    });
  }

  function captureAudioStream(audio: HTMLMediaElement) {
    const capturable = audio as CapturableMediaElement;
    const stream = capturable.captureStream?.() ?? capturable.mozCaptureStream?.();
    if (!stream) throw new Error('captureStream() is not supported by this browser.');
    if (stream.getAudioTracks().length === 0) throw new Error('No audio track detected.');
    return stream;
  }

  async function ensureCapturableAudioSource(source: string) {
    if (!shouldMaterializeRemoteSource(source)) {
      return source;
    }

    const cachedSource = resolvedAudioSourcesRef.current.get(source);
    if (cachedSource) {
      return cachedSource;
    }

    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Unable to load audio source (${response.status})`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    objectUrlsRef.current.add(objectUrl);
    resolvedAudioSourcesRef.current.set(source, objectUrl);
    return objectUrl;
  }

  function createHostPeer(listenerId: string) {
    hostPeersRef.current.get(listenerId)?.close();
    const peer = new RTCPeerConnection({ iceServers });
    const stream = localStreamRef.current;

    if (stream) {
      for (const track of stream.getAudioTracks()) {
        peer.addTrack(track, stream);
      }
    }

    peer.onicecandidate = event => {
      if (event.candidate) {
        socketRef.current?.emit('webrtc:ice-candidate', {
          targetId: listenerId,
          candidate: event.candidate.toJSON()
        });
      }
    };
    peer.onconnectionstatechange = () => {
      upsertListenerStatus(listenerId, getPeerStatus(peer.connectionState));
    };

    hostPeersRef.current.set(listenerId, peer);
    return peer;
  }

  async function createOfferForListener(listenerId: string) {
    if (!localStreamRef.current) {
      upsertListenerStatus(listenerId, 'waiting');
      return;
    }

    const peer = createHostPeer(listenerId);
    upsertListenerStatus(listenerId, 'connecting');

    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socketRef.current?.emit('webrtc:offer', {
        targetId: listenerId,
        offer: peer.localDescription
      });
    } catch (offerError) {
      upsertListenerStatus(listenerId, 'disconnected');
      setError(offerError instanceof Error ? offerError.message : 'Unable to create WebRTC offer');
    }
  }

  async function acceptOffer(from: string, offer: RTCSessionDescriptionInit) {
    closeListenerPeer();
    const peer = new RTCPeerConnection({ iceServers });
    listenerPeerRef.current = peer;

    peer.ontrack = event => {
      const [stream] = event.streams;
      if (remoteAudioRef.current && stream) {
        remoteAudioRef.current.srcObject = stream;
        setRemoteReady(true);
        setSessionStatus('Live');
        void remoteAudioRef.current.play().catch(() => setSessionStatus('Manual playback required'));
      }
    };
    peer.onicecandidate = event => {
      if (event.candidate) {
        socketRef.current?.emit('webrtc:ice-candidate', {
          targetId: from,
          candidate: event.candidate.toJSON()
        });
      }
    };
    peer.onconnectionstatechange = () => {
      const status = getPeerStatus(peer.connectionState);
      setSessionStatus(status === 'connected' ? 'Live' : peerStatusLabel(status));
      if (status === 'connected') {
        socketRef.current?.emit('peer:connected', { targetId: from });
      }
    };

    try {
      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socketRef.current?.emit('webrtc:answer', {
        targetId: from,
        answer: peer.localDescription
      });
    } catch (answerError) {
      setError(answerError instanceof Error ? answerError.message : 'Unable to create WebRTC answer');
      setSessionStatus('WebRTC error');
    }
  }

  async function acceptAnswer(from: string, answer: RTCSessionDescriptionInit) {
    const peer = hostPeersRef.current.get(from);
    if (!peer) return;

    try {
      await peer.setRemoteDescription(answer);
    } catch (answerError) {
      upsertListenerStatus(from, 'disconnected');
      setError(answerError instanceof Error ? answerError.message : 'Invalid WebRTC answer');
    }
  }

  async function addRemoteCandidate(from: string, candidate: RTCIceCandidateInit) {
    const peer = modeRef.current === 'host' ? hostPeersRef.current.get(from) : listenerPeerRef.current;
    if (!peer || !candidate) return;

    try {
      await peer.addIceCandidate(candidate);
    } catch (candidateError) {
      console.warn('ICE candidate rejected', candidateError);
    }
  }

  function createRightsManifest(
    contentHash: `0x${string}`,
    royaltyRecipients: `0x${string}`[],
    royaltyShares: number[],
    resolvedAudioCID: string,
    resolvedCoverCID: string
  ): DotifyTrackManifest {
    return {
      schema: 'dotify.track.v1',
      createdAt: new Date().toISOString(),
      assets: {
        audioCID: resolvedAudioCID,
        coverCID: resolvedCoverCID,
        encrypted: true
      },
      track: {
        contentHash,
        title: title.trim() || 'Untitled',
        artistName: artistName.trim() || 'Unknown artist',
        description: description.trim(),
        accessMode,
        priceDot: accessMode === 'classic' ? priceDot : '0',
        requiredPersonhood: accessMode === 'human-free' ? personhoodLevel : 'None',
        zone: 'Studio'
      },
      royalties: royaltyRecipients.map((recipient, index) => ({
        recipient,
        bps: royaltyShares[index] ?? 0
      })),
      settlement: {
        target: 'evm',
        royaltyBps,
        pricePlanck: dotToPlanck(accessMode === 'classic' ? priceDot : '0').toString()
      }
    };
  }

  async function registerRights() {
    if (!fileHash) {
      setRightsStatus('Select an audio file');
      return;
    }

    setIsRegistering(true);
    setTransactionFeedback({
      tone: 'pending',
      title: 'Preparing registration',
      message: 'Building the rights manifest and validating the selected services.'
    });

    let bulletinRef = trackInfo?.bulletinRef ?? '';
    let runtimeAddress = artistRuntimeAddress;
    try {
      if (artistRegistrationAvailable) {
        setRightsStatus('Checking artist registration');
        const resolvedRuntime = await refreshArtistRuntime();
        if (!resolvedRuntime) {
          setTransactionFeedback({
            tone: 'error',
            title: 'Artist registration required',
            message: 'Register the artist first, then come back to publish tracks.'
          });
          setRightsStatus('Register artist before managing releases');
          return;
        }
        runtimeAddress = resolvedRuntime;
      }

      // Ensure audio and cover are uploaded to IPFS before proceeding
      setRightsStatus('Awaiting IPFS uploads…');
      const [resolvedAudioCID, resolvedCoverCID] = await Promise.all([
        audioUploadRef.current ??
          (audioSource
            ? fetch(audioSource)
                .then(r => r.arrayBuffer())
                .then(async buf => {
                  const bytes = new Uint8Array(buf);
                  const enc = await encryptTrackAudio(bytes, fileHash);
                  const encFile = new File([enc], `${title || 'audio'}.enc`, { type: 'application/octet-stream' });
                  return uploadFileToPinata(encFile, encFile.name, { app: 'dotify', type: 'audio', encrypted: 'true' });
                })
            : Promise.resolve('')),
        coverUploadRef.current ?? (coverFile ? uploadFileToPinata(coverFile, coverFile.name, { app: 'dotify', type: 'cover' }) : Promise.resolve(''))
      ]);

      if (resolvedAudioCID) setAudioCID(resolvedAudioCID);
      if (resolvedCoverCID) setCoverCID(resolvedCoverCID);

      const royaltyRecipients = [activeEvmAddress];
      const royaltyShares = [royaltyBps];
      const manifest = createRightsManifest(fileHash, royaltyRecipients, royaltyShares, resolvedAudioCID, resolvedCoverCID);

      // IPFS is the canonical metadata path. Bulletin is optional archival.
      setRightsStatus('Publishing manifest to IPFS…');
      setTransactionFeedback({
        tone: 'pending',
        title: 'Uploading to IPFS',
        message: 'Pinning the track manifest to IPFS via Pinata.'
      });
      const metadataCID = await uploadJsonToPinata(manifest, `${manifest.track.title}.json`, { app: 'dotify', type: 'track-metadata' });
      const ipfsMetadataRef = `ipfs://${metadataCID}`;

      if (uploadToBulletinEnabled) {
        if (!activeSubstrateAddress || !activeSubstrateSigner) {
          const message = 'Bulletin archival requires a Substrate signer. Use a passkey wallet or disable the Bulletin archival option.';
          setRightsStatus(message);
          setTransactionFeedback({
            tone: 'error',
            title: 'Bulletin signer missing',
            message
          });
          return;
        }

        const manifestPayload = encodeBulletinJson(manifest);
        setRightsStatus('Checking Bulletin authorization for metadata JSON');
        setTransactionFeedback({
          tone: 'pending',
          title: 'Authorizing Bulletin upload',
          message: 'Checking whether the selected Bulletin account can publish this manifest.'
        });
        const authorized = await checkBulletinAuthorization(activeSubstrateAddress, manifestPayload.bytes.length);
        if (!authorized) {
          const message = 'Bulletin account is not authorized';
          setRightsStatus(message);
          setTransactionFeedback({
            tone: 'error',
            title: 'Bulletin upload blocked',
            message
          });
          return;
        }

        setRightsStatus('Publishing metadata JSON to Bulletin Chain');
        setTransactionFeedback({
          tone: 'pending',
          title: 'Publishing manifest',
          message: 'Writing the compact rights manifest to Bulletin Chain.'
        });
        const bulletinUpload = await uploadToBulletin(manifestPayload.bytes, activeSubstrateSigner);
        bulletinRef = createBulletinManifestRef(bulletinUpload.contentHash);
        setBulletinManifestRef(bulletinRef);
      }

      if (!factoryAddress || !directoryAddress) {
        setRightsStatus('Rights staged');
        setTransactionFeedback({
          tone: 'success',
          title: 'Rights prepared',
          message: 'The release is ready in the studio. Deploy the factory contract to complete the onchain step.'
        });
        return;
      }

      setRightsStatus('Checking contracts');
      setTransactionFeedback({
        tone: 'pending',
        title: 'Checking factory',
        message: 'Verifying that the ArtistRuntimeFactory is reachable before submission.'
      });
      const factoryExists = await ensureContract(factoryAddress, ethRpcUrl);
      if (!factoryExists) {
        setRightsStatus('Factory not found');
        setTransactionFeedback({ tone: 'error', title: 'Factory unavailable', message: 'ArtistRuntimeFactory not found at the configured address.' });
        return;
      }

      if (!runtimeAddress) {
        setRightsStatus('Artist runtime missing');
        setTransactionFeedback({
          tone: 'error',
          title: 'Artist runtime missing',
          message: 'Register the artist first before submitting a track to the onchain registry.'
        });
        return;
      }

      const walletClient = await getActiveWalletClient();

      const ipfsAudioRef = resolvedAudioCID ? makeEncryptedAudioRef(resolvedAudioCID) : `dotify:local:${fileHash}`;
      const ipfsCoverRef = resolvedCoverCID ? `ipfs://${resolvedCoverCID}` : `dotify:cover:${fileHash}`;

      setRightsStatus('Submitting rights transaction');
      setTransactionFeedback({
        tone: 'pending',
        title: 'Registering track',
        message: 'Sending the registration to your SmartRuntime.'
      });

      const txHash = await walletClient.writeContract({
        address: runtimeAddress,
        abi: musicRegistryAbi,
        functionName: 'musicRegRegister',
        args: [
          {
            contentHash: fileHash,
            title,
            artistName,
            description,
            imageRef: ipfsCoverRef,
            audioRef: ipfsAudioRef,
            metadataRef: ipfsMetadataRef,
            artistContractRef: `dotify:self-certified:${fileHash}`,
            accessMode: accessMode === 'human-free' ? 0 : 1,
            pricePlanck: dotToPlanck(accessMode === 'classic' ? priceDot : '0'),
            requiredPersonhood: accessMode === 'human-free' ? (personhoodLevel === 'DIM2' ? 2 : 1) : 0
          },
          royaltyRecipients,
          royaltyShares
        ]
      });

      setRightsStatus('Waiting for transaction confirmation');
      setTransactionFeedback({
        tone: 'pending',
        title: 'Waiting for confirmation',
        message: 'Transaction submitted. Waiting for the final receipt on the EVM network.',
        txHash
      });
      await getPublicClient(ethRpcUrl).waitForTransactionReceipt({ hash: txHash });
      setRightsStatus('Rights registered');
      setTransactionFeedback({
        tone: 'success',
        title: 'Track registered',
        message: 'The transaction was confirmed and the release was added to the registry.',
        txHash
      });
      await refreshCatalogFromRegistry(fileHash);
    } catch (registrationError) {
      const message = registrationError instanceof Error ? registrationError.message : 'Registration failed';
      setRightsStatus(message);
      setTransactionFeedback({
        tone: 'error',
        title: 'Registration failed',
        message
      });
    } finally {
      setIsRegistering(false);
    }
  }

  function upsertListener(listener: ListenerRecord) {
    setListeners(previous => {
      const next = previous.some(item => item.id === listener.id)
        ? previous.map(item => (item.id === listener.id ? { ...item, ...listener } : item))
        : [...previous, listener];
      listenersRef.current = next;
      return next;
    });
  }

  function upsertListenerStatus(listenerId: string, status: PeerStatus) {
    setListeners(previous => {
      const next = previous.map(listener => (listener.id === listenerId ? { ...listener, status } : listener));
      listenersRef.current = next;
      return next;
    });
  }

  function removeListener(listenerId: string) {
    setListeners(previous => {
      const next = previous.filter(listener => listener.id !== listenerId);
      listenersRef.current = next;
      return next;
    });
  }

  function closeAllPeers() {
    closeHostPeers();
    closeListenerPeer();
    localStreamRef.current = null;
    setLocalStreamReady(false);
  }

  function closeHostPeers() {
    for (const peer of hostPeersRef.current.values()) {
      peer.close();
    }
    hostPeersRef.current.clear();
  }

  function closeListenerPeer() {
    listenerPeerRef.current?.close();
    listenerPeerRef.current = null;
  }

  async function copySessionLink() {
    if (!sessionLink) return;
    try {
      await navigator.clipboard.writeText(sessionLink);
      setSessionStatus('Link copied');
    } catch {
      setSessionStatus('Copy unavailable');
    }
  }

  function goToPreviousReleaseStep() {
    const previousStep = releaseSteps[Math.max(0, releaseStepIndex - 1)]?.id;
    if (previousStep) setReleaseStep(previousStep);
  }

  function goToNextReleaseStep() {
    const nextStep = releaseSteps[Math.min(releaseSteps.length - 1, releaseStepIndex + 1)]?.id;
    if (nextStep) setReleaseStep(nextStep);
  }

  return (
    <div className='app-shell'>
      <header className='topbar'>
        <a className='brand' href='#top' aria-label='Dotify'>
          <span className='brand-mark'>
            <Disc3 size={21} />
          </span>
          <span>Dotify</span>
        </a>
        <nav className='nav-pills' aria-label='Status'>
          <StatusPill
            icon={socketStatus === 'online' ? Wifi : WifiOff}
            label={socketStatus === 'online' ? 'Signal online' : 'Signal offline'}
            tone={socketStatus === 'online' ? 'green' : 'muted'}
          />
          <StatusPill icon={Radio} label={sessionStatus} tone='pink' />
          <StatusPill icon={LockKeyhole} label='dotify.dot.li' tone='muted' />
          <WalletStatusPill state={walletState} onClick={() => setShowWalletModal(true)} onDisconnect={disconnectWallet} />
        </nav>
      </header>

      {showWalletModal && (
        <WalletModal
          state={walletState}
          hasPrfSupport={hasPrfSupport}
          hasStoredPasskey={hasStoredPasskey}
          onPasskey={() => {
            void connectPasskey();
          }}
          onExtension={() => {
            void connectExtension();
          }}
          onForgetPasskey={forgetPasskey}
          onClose={() => setShowWalletModal(false)}
        />
      )}

      <div className='docs-layout' id='top'>
        <aside className='sidebar' aria-label='Dotify navigation'>
          <div className='sidebar-heading'>Listen</div>
          <button
            className='sidebar-link'
            data-active={activeView === 'listen' || activeView === 'player'}
            type='button'
            onClick={() => navigateToView('listen')}
          >
            <Headphones size={16} />
            Discover
          </button>
          <button
            className='sidebar-link'
            data-active={activeView === 'rooms'}
            type='button'
            onClick={() => {
              navigateToView('rooms');
              requestOpenRooms(true);
            }}
          >
            <Radio size={16} />
            Rooms
          </button>
          <div className='sidebar-heading sidebar-heading-spaced'>Create</div>
          <button className='sidebar-link' data-active={activeView === 'artist'} type='button' onClick={() => navigateToView('artist')}>
            <FileAudio size={16} />
            Artist Console
          </button>

          <div className='sidebar-card'>
            <span>Active room</span>
            <strong>{roomId || 'None'}</strong>
          </div>
        </aside>

        <main className='content'>
          <section className='page-head'>
            <div className='page-copy'>
              <p className='eyebrow'>{currentPage.eyebrow}</p>
              <h1>{currentPage.title}</h1>
            </div>
            <div className='head-metrics'>
              <Metric label='tracks' value={catalogTracks.length.toString()} />
              <Metric label='rooms' value={openRooms.length.toString()} />
              <Metric label='listeners' value={`${activeListeners}/${listenerCount}`} />
            </div>
          </section>

          {activeView === 'listen' && (
            <section className='content-grid catalog-home-grid'>
              <div className='doc-panel catalogue-panel catalogue-home-panel'>
                <PanelTitle icon={Library} title='Browse catalog' meta={`${catalogTracks.length} tracks`} />
                <p className='catalogue-intro'>Choose a cover to open the player, preview the track, and unlock full access with payment or proof.</p>
                <div className='catalogue-grid'>
                  {catalogTracks.length > 0 ? (
                    catalogTracks.map(track => {
                      const hasCatalogAccess = catalogAccessByTrackId[track.id] === true;

                      return (
                        <button
                          className='catalogue-card'
                          data-selected={selectedTrackId === track.id}
                          key={track.id}
                          type='button'
                          aria-label={`Open ${track.title} by ${track.artist}`}
                          onClick={() => {
                            void openTrack(track);
                          }}
                        >
                          <span className='catalogue-cover-frame'>
                            <img className='catalogue-cover' src={track.imageRef} alt='' crossOrigin='anonymous' />
                          </span>
                          <span className='catalogue-card-copy'>
                            <strong>{track.title}</strong>
                            <small>{track.artist}</small>
                            <span className='catalogue-card-description'>{track.description || 'Artist-owned release on Dotify.'}</span>
                          </span>
                          <span
                            className='catalogue-access-line'
                            data-access={hasCatalogAccess ? 'granted' : 'locked'}
                            aria-label={catalogAccessAriaLabel(track, hasCatalogAccess)}
                          >
                            {hasCatalogAccess ? <CircleCheckBig size={15} /> : <Wallet size={15} />}
                            <span>{catalogAccessLabel(track)}</span>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className='empty-state'>{catalogStatus}</div>
                  )}
                </div>
              </div>

              <div className='doc-panel home-principles-panel'>
                <PanelTitle icon={BadgeCheck} title='Access culture' meta='proof, not profiles' />
                <div className='principle-list'>
                  <div>
                    <strong>Preview first</strong>
                    <span>Every listener can discover before deciding how to unlock.</span>
                  </div>
                  <div>
                    <strong>Pay artists directly</strong>
                    <span>Classic access shows the DOT price before payment.</span>
                  </div>
                  <div>
                    <strong>Human free</strong>
                    <span>Personhood can unlock culture without turning people into ad profiles.</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeView === 'player' && (
            <section className='content-grid player-view-grid'>
              <div className='doc-panel player-panel integrated-player-panel'>
                <div className='now-playing'>
                  <div className='cover' data-live={localStreamReady || remoteReady}>
                    <img src={trackInfo?.imageRef ?? selectedTrack?.imageRef ?? coverSource} alt='' crossOrigin='anonymous' />
                  </div>
                  <div className='track-copy'>
                    <span>{mode === 'host' ? 'Source' : hostName || 'Room'}</span>
                    <h2>{streamTitle}</h2>
                    <p>{streamArtist}</p>
                    <div className='access-badges'>
                      <span>{accessModeLabelFromState(trackInfo?.accessMode ?? selectedTrack?.accessMode ?? accessMode)}</span>
                      <span>
                        {(trackInfo?.accessMode ?? selectedTrack?.accessMode ?? accessMode) === 'classic'
                          ? `${trackInfo?.priceDot ?? selectedTrack?.priceDot ?? priceDot} DOT`
                          : `PoP ${trackInfo?.personhoodLevel ?? selectedTrack?.personhoodLevel ?? personhoodLevel}`}
                      </span>
                    </div>
                    <p className='track-description'>{trackInfo?.description ?? selectedTrack?.description ?? description}</p>
                  </div>
                </div>

                {mode === 'host' ? (
                  <div className='audio-stack'>
                    <audio
                      ref={localAudioRef}
                      src={audioSource ?? undefined}
                      crossOrigin='anonymous'
                      controls
                      onLoadedMetadata={() => {
                        void prepareLocalStream();
                        setupPreviewLimit();
                      }}
                      onPlay={() => {
                        emitPlayerState(true);
                        enforcePreviewCutoff();
                      }}
                      onPause={() => emitPlayerState(true)}
                      onSeeked={() => emitPlayerState(true)}
                      onTimeUpdate={() => {
                        emitPlayerState(false);
                        enforcePreviewCutoff();
                      }}
                    />
                    <div className='remote-state' data-active={localStreamReady}>
                      {localStreamReady ? <Play size={16} /> : <Pause size={16} />}
                      <span>{localStreamReady ? 'Stream ready' : 'Source missing'}</span>
                    </div>
                  </div>
                ) : (
                  <div className='audio-stack'>
                    <audio ref={remoteAudioRef} controls autoPlay playsInline />
                    <div className='remote-state' data-active={remoteReady}>
                      {remoteReady ? <Play size={16} /> : playerState?.playing ? <Pause size={16} /> : <Headphones size={16} />}
                      <span>{remoteReady ? 'Stream received' : 'Waiting'}</span>
                    </div>
                  </div>
                )}

                <div className='progress-line'>
                  <span>{formatTime(playerState?.currentTime ?? 0)}</span>
                  <div>
                    <i style={{ width: `${progressPercent(playerState)}%` }} />
                  </div>
                  <span>{formatTime(playerState?.duration ?? trackInfo?.duration ?? 0)}</span>
                </div>

                {accessGate && (
                  <AccessGateOverlay
                    gate={accessGate}
                    onDismiss={() => setAccessGate(null)}
                    onPay={
                      accessGate.actionType === 'payment'
                        ? () => {
                            void payForTrackAccess(accessGate.track);
                          }
                        : undefined
                    }
                    onSignIn={accessGate.actionType === 'signin' ? () => setShowWalletModal(true) : undefined}
                  />
                )}
              </div>

              <div className='studio-column player-side-column'>
                <div className='doc-panel session-panel'>
                  <PanelTitle icon={Radio} title='Listening room' meta={roomId || 'offline'} />
                  <div className='segmented' role='tablist' aria-label='Mode'>
                    <button type='button' className={mode === 'host' ? 'active' : ''} onClick={() => changeMode('host')}>
                      <Radio size={16} />
                      Host
                    </button>
                    <button type='button' className={mode === 'listener' ? 'active' : ''} onClick={() => changeMode('listener')}>
                      <Headphones size={16} />
                      Join
                    </button>
                  </div>

                  <label className='field-label'>Name</label>
                  <input className='field' value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={32} />

                  {mode === 'host' ? (
                    <form className='session-form' onSubmit={createSession}>
                      <button className='primary-action' type='submit' disabled={sessionAction !== 'idle'}>
                        {sessionAction === 'creating' ? <Disc3 size={16} className='spin' /> : <Radio size={16} />}
                        {sessionAction === 'creating' ? 'Opening room…' : 'Start a room'}
                      </button>
                      <div className='room-code'>
                        <span>Code</span>
                        <strong>{roomId || '------'}</strong>
                        <button type='button' onClick={copySessionLink} disabled={!roomId} title='Copy link' aria-label='Copy link'>
                          <Copy size={16} />
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form className='session-form' onSubmit={joinSession}>
                      <label className='field-label'>Code</label>
                      <input
                        className='field code-field'
                        value={joinCode}
                        onChange={event => setJoinCode(event.target.value.toUpperCase())}
                        placeholder='ABC123'
                        maxLength={12}
                      />
                      <button className='primary-action' type='submit' disabled={sessionAction !== 'idle'}>
                        {sessionAction === 'joining' ? <Disc3 size={16} className='spin' /> : <Headphones size={16} />}
                        {sessionAction === 'joining' ? 'Joining…' : 'Join'}
                      </button>
                    </form>
                  )}

                  {roomId && (
                    <button className='secondary-action' type='button' onClick={leaveSession}>
                      Leave
                    </button>
                  )}

                  <div className='listener-list'>
                    {mode === 'host' && listeners.length > 0 ? (
                      listeners.map(listener => (
                        <div className='list-row' key={listener.id}>
                          <div>
                            <strong>{listener.displayName}</strong>
                            <span>{peerStatusLabel(listener.status)}</span>
                          </div>
                          <i data-status={listener.status} />
                        </div>
                      ))
                    ) : (
                      <div className='list-row muted-row'>
                        <div>
                          <strong>{mode === 'host' ? 'No listeners yet' : hostName || 'Host'}</strong>
                          <span>{mode === 'host' ? 'Waiting' : roomId || 'Not connected'}</span>
                        </div>
                        <i data-status={remoteReady ? 'connected' : 'waiting'} />
                      </div>
                    )}
                  </div>

                  {error && <p className='error-box'>{error}</p>}
                </div>

                <div className='doc-panel player-context-panel'>
                  <PanelTitle
                    icon={Library}
                    title='Track access'
                    meta={selectedTrack ? accessModeLabel(selectedTrack) : accessModeLabelFromState(accessMode)}
                  />
                  <div className='stack-list'>
                    <EndpointRow label='Artist' value={streamArtist} />
                    <EndpointRow
                      label='Access'
                      value={
                        (selectedTrack?.accessMode ?? accessMode) === 'classic'
                          ? `${selectedTrack?.priceDot ?? priceDot} DOT`
                          : `Human proof ${selectedTrack?.personhoodLevel ?? personhoodLevel}`
                      }
                    />
                    <EndpointRow label='Metadata' value={trackInfo?.metadataRef || selectedTrack?.metadataRef ? 'portable manifest' : 'draft source'} />
                  </div>
                  <button className='secondary-action' type='button' onClick={() => navigateToView('listen')}>
                    Back to catalog
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeView === 'rooms' && (
            <section className='content-grid rooms-grid'>
              <div className='doc-panel wide-panel'>
                <PanelTitle icon={Radio} title='Live rooms' meta={`${openRooms.length} open`} />
                <div className='room-list'>
                  {openRooms.length > 0 ? (
                    openRooms.map(room => (
                      <div className='room-row' key={room.roomId}>
                        <div>
                          <strong>{room.track?.title ?? 'Audio session'}</strong>
                          <span>
                            {room.hostName} / {room.listenerCount} listener{room.listenerCount > 1 ? 's' : ''}
                          </span>
                        </div>
                        <code>{room.roomId}</code>
                        <button type='button' onClick={() => joinRoom(room.roomId)} disabled={sessionAction !== 'idle'}>
                          {sessionAction === 'joining' ? <Disc3 size={16} className='spin' /> : <Headphones size={16} />}
                          {sessionAction === 'joining' ? 'Joining…' : 'Join'}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className='empty-state'>No open rooms</div>
                  )}
                </div>
              </div>

              <div className='doc-panel'>
                <PanelTitle icon={Headphones} title='Room code' meta='manual' />
                <form className='session-form' onSubmit={joinSession}>
                  <input
                    className='field code-field'
                    value={joinCode}
                    onChange={event => setJoinCode(event.target.value.toUpperCase())}
                    placeholder='ABC123'
                    maxLength={12}
                  />
                  <button className='primary-action' type='submit' disabled={sessionAction !== 'idle'}>
                    {sessionAction === 'joining' ? <Disc3 size={16} className='spin' /> : <Headphones size={16} />}
                    {sessionAction === 'joining' ? 'Joining…' : 'Join'}
                  </button>
                </form>
                <button className='secondary-action' type='button' onClick={() => requestOpenRooms(true)} disabled={isRefreshingRooms}>
                  {isRefreshingRooms ? <Disc3 size={16} className='spin' /> : <RefreshCw size={16} />}
                  {isRefreshingRooms ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </section>
          )}

          {activeView === 'artist' && (
            <section className='artist-console'>
              <div className='console-tabs' role='tablist' aria-label='Artist console'>
                {artistTabs.map(tab => (
                  <button
                    key={tab.id}
                    type='button'
                    role='tab'
                    aria-selected={artistTab === tab.id}
                    data-active={artistTab === tab.id}
                    onClick={() => setArtistTab(tab.id)}
                  >
                    <strong>{tab.label}</strong>
                    <span>{tab.description}</span>
                  </button>
                ))}
              </div>

              {artistTab === 'overview' && (
                <section className='content-grid artist-overview-grid'>
                  <div className='doc-panel studio-panel'>
                    <PanelTitle icon={LockKeyhole} title='Artist profile' meta={artistSetupState.toLowerCase()} />

                    <div className='fields-grid'>
                      <label>
                        <span>Artist name</span>
                        <input className='field' value={artistName} onChange={event => updateArtistName(event.target.value)} />
                      </label>
                      {connectedWallet ? (
                        <label>
                          <span>Wallet</span>
                          <div className='field wallet-field'>
                            <LockKeyhole size={14} />
                            {connectedWallet.label}
                          </div>
                        </label>
                      ) : (
                        <label>
                          <span>Dev wallet</span>
                          <select className='field' value={artistAccountIndex} onChange={event => setArtistAccountIndex(Number(event.target.value))}>
                            {evmDevAccounts.map((account, index) => (
                              <option key={account.name} value={index}>
                                {account.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>

                    <div className='stack-list'>
                      <EndpointRow
                        label='Rights wallet'
                        value={
                          <a className='verify-link' href={getBlockscoutAddressUrl(activeEvmAddress)} target='_blank' rel='noreferrer'>
                            {shorten(activeEvmAddress, 12)}
                          </a>
                        }
                      />
                      <EndpointRow
                        label='Artist profile'
                        value={
                          artistRuntimeAddress ? (
                            <div className='endpoint-link-stack'>
                              <a className='verify-link' href={getBlockscoutAddressUrl(artistRuntimeAddress)} target='_blank' rel='noreferrer'>
                                {shorten(artistRuntimeAddress, 12)}
                              </a>
                              <small>Ready to publish</small>
                            </div>
                          ) : (
                            'not created'
                          )
                        }
                      />
                    </div>

                    <p className='rights-status'>{artistRegistrationStatus}</p>

                    <button
                      className='primary-action wide'
                      type='button'
                      onClick={registerArtist}
                      disabled={isRegisteringArtist || !artistRegistrationAvailable || Boolean(artistRuntimeAddress)}
                    >
                      {isRegisteringArtist ? <Disc3 size={16} className='spin' /> : <BadgeCheck size={16} />}
                      {isRegisteringArtist ? 'Creating profile…' : artistRuntimeAddress ? 'Artist profile ready' : 'Create artist profile'}
                    </button>

                    <button
                      className='secondary-action'
                      type='button'
                      onClick={() => void refreshArtistRuntime(true)}
                      disabled={isRefreshingArtistRuntime || !artistRegistrationAvailable}
                    >
                      {isRefreshingArtistRuntime ? <Disc3 size={16} className='spin' /> : <RefreshCw size={16} />}
                      {isRefreshingArtistRuntime ? 'Refreshing…' : 'Refresh status'}
                    </button>
                  </div>

                  <div className='doc-panel next-action-panel'>
                    <PanelTitle icon={BadgeCheck} title='Next action' meta={artistSetupState} />
                    <div className='next-action-copy'>
                      <strong>
                        {!connectedWallet
                          ? 'Use a wallet to make this profile yours.'
                          : artistRuntimeAddress
                            ? 'Your artist profile is yours to publish from.'
                            : 'Create your artist-owned profile before publishing.'}
                      </strong>
                      <p>
                        {!connectedWallet
                          ? 'No password, no platform login. Your wallet becomes the address that owns your catalog and receives payments.'
                          : artistRuntimeAddress
                            ? 'Start a new release, choose the access culture around it, then publish it to your own runtime.'
                            : 'Dotify creates one artist profile per wallet. Releases, rights, and payments stay attached to that address.'}
                      </p>
                    </div>
                    {!connectedWallet ? (
                      <button className='primary-action wide' type='button' onClick={() => setShowWalletModal(true)}>
                        <LockKeyhole size={16} />
                        Use my wallet
                      </button>
                    ) : artistRuntimeAddress ? (
                      <button className='primary-action wide' type='button' onClick={() => setArtistTab('new')}>
                        <Upload size={16} />
                        Publish a release
                      </button>
                    ) : (
                      <button
                        className='primary-action wide'
                        type='button'
                        onClick={registerArtist}
                        disabled={isRegisteringArtist || !artistRegistrationAvailable}
                      >
                        {isRegisteringArtist ? <Disc3 size={16} className='spin' /> : <BadgeCheck size={16} />}
                        Create artist profile
                      </button>
                    )}
                    <div className='artist-summary-grid'>
                      <Metric label='releases' value={artistTracks.length.toString()} />
                      <Metric label='profile' value={artistRuntimeAddress ? 'ready' : 'pending'} />
                    </div>
                  </div>
                </section>
              )}

              {artistTab === 'new' && (
                <section className='content-grid release-workbench-grid'>
                  <div className='doc-panel studio-panel release-wizard'>
                    <PanelTitle
                      icon={FileAudio}
                      title='New release'
                      meta={artistStudioLocked ? 'create profile first' : (releaseSteps[releaseStepIndex]?.label ?? 'draft')}
                    />

                    <div className='release-stepper' aria-label='Release steps'>
                      {releaseSteps.map((step, index) => (
                        <button key={step.id} type='button' data-active={releaseStep === step.id} onClick={() => setReleaseStep(step.id)}>
                          <span>{index + 1}</span>
                          {step.label}
                        </button>
                      ))}
                    </div>

                    {releaseStep === 'assets' && (
                      <div className='wizard-panel'>
                        <div className='asset-actions'>
                          <label className='file-button' data-disabled={assetAction !== 'idle' || artistStudioLocked}>
                            {assetAction === 'audio' ? <Disc3 size={16} className='spin' /> : <Upload size={16} />}
                            {assetAction === 'audio' ? 'Preparing audio…' : 'Add audio'}
                            <input type='file' accept='audio/*' onChange={handleAudioFile} disabled={assetAction !== 'idle' || artistStudioLocked} />
                          </label>
                          <label className='file-button secondary-file' data-disabled={assetAction !== 'idle' || artistStudioLocked}>
                            {assetAction === 'cover' ? <Disc3 size={16} className='spin' /> : <Upload size={16} />}
                            {assetAction === 'cover' ? 'Preparing cover…' : 'Add cover image'}
                            <input type='file' accept='image/*' onChange={handleCoverFile} disabled={assetAction !== 'idle' || artistStudioLocked} />
                          </label>
                        </div>
                        <div className='asset-readiness'>
                          <div>
                            <strong>{audioSource ? 'Audio ready' : 'Audio missing'}</strong>
                            <span>{fileHash ? shorten(fileHash, 18) : 'Upload an audio file to generate the release hash.'}</span>
                          </div>
                          <div>
                            <strong>{coverSource.startsWith('blob:') ? 'Cover ready' : 'Generated cover'}</strong>
                            <span>{coverCID ? shorten(coverCID, 18) : 'A custom cover can be added before publish.'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {releaseStep === 'metadata' && (
                      <div className='wizard-panel fields-grid'>
                        <label>
                          <span>Title</span>
                          <input className='field' value={title} onChange={event => setTitle(event.target.value)} disabled={artistStudioLocked} />
                        </label>
                        <label>
                          <span>Description</span>
                          <textarea
                            className='field textarea-field'
                            value={description}
                            onChange={event => setDescription(event.target.value)}
                            disabled={artistStudioLocked}
                          />
                        </label>
                      </div>
                    )}

                    {releaseStep === 'access' && (
                      <div className='wizard-panel'>
                        <div className='fields-grid'>
                          <label>
                            <span>Access mode</span>
                            <select
                              className='field'
                              value={accessMode}
                              onChange={event => setAccessMode(event.target.value as AccessMode)}
                              disabled={artistStudioLocked}
                            >
                              <option value='human-free'>Human free</option>
                              <option value='classic'>Classic</option>
                            </select>
                          </label>
                          <label>
                            <span>PoP level</span>
                            <select
                              className='field'
                              value={personhoodLevel}
                              onChange={event => setPersonhoodLevel(event.target.value as PersonhoodLevel)}
                              disabled={artistStudioLocked}
                            >
                              <option value='DIM1'>DIM1</option>
                              <option value='DIM2'>DIM2</option>
                            </select>
                          </label>
                          <label>
                            <span>Price in DOT</span>
                            <input
                              className='field'
                              type='number'
                              min={0}
                              step={0.1}
                              value={priceDot}
                              onChange={event => setPriceDot(event.target.value)}
                              disabled={artistStudioLocked}
                            />
                          </label>
                          <label>
                            <span>Royalty bps</span>
                            <input
                              className='field'
                              type='number'
                              min={0}
                              max={10000}
                              step={25}
                              value={royaltyBps}
                              onChange={event => setRoyaltyBps(Number(event.target.value))}
                              disabled={artistStudioLocked}
                            />
                          </label>
                          {uploadToBulletinEnabled &&
                            (connectedWallet ? (
                              <label>
                                <span>Archive signer</span>
                                <div className='field wallet-field'>
                                  <LockKeyhole size={14} />
                                  {activeSubstrateAddress ? `${activeSubstrateAddress.slice(0, 8)}…` : 'No Substrate signer'}
                                </div>
                              </label>
                            ) : (
                              <label>
                                <span>Archive signer</span>
                                <select
                                  className='field'
                                  value={bulletinAccountIndex}
                                  onChange={event => setBulletinAccountIndex(Number(event.target.value))}
                                  disabled={artistStudioLocked}
                                >
                                  {devAccounts.map((account, index) => (
                                    <option key={account.name} value={index}>
                                      {account.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ))}
                        </div>
                        <label className='toggle-row'>
                          <input
                            type='checkbox'
                            checked={uploadToBulletinEnabled}
                            onChange={event => setUploadToBulletinEnabled(event.target.checked)}
                            disabled={artistStudioLocked}
                          />
                          <span>Archive manifest to Bulletin Chain</span>
                        </label>
                        <div className='rights-status'>
                          {accessMode === 'human-free'
                            ? `Human free means access through personhood, not surveillance. Listeners with Polkadot Proof of Personhood ${personhoodLevel} can unlock the full track.`
                            : `Classic access means direct payment in DOT. The artist runtime records who paid and settles royalties transparently.`}
                        </div>
                      </div>
                    )}

                    {releaseStep === 'review' && (
                      <div className='wizard-panel release-review'>
                        <EndpointRow label='Track' value={title.trim() || 'Untitled'} />
                        <EndpointRow label='Artist' value={artistName.trim() || 'Unknown artist'} />
                        <EndpointRow label='Access' value={accessMode === 'classic' ? `${priceDot} DOT` : `Human verified ${personhoodLevel}`} />
                        <EndpointRow label='Royalty' value={`${royaltyBps} bps`} />
                        <EndpointRow label='Metadata' value='IPFS canonical manifest' />
                        <EndpointRow label='Archive' value={uploadToBulletinEnabled ? 'Bulletin enabled' : 'Off'} />
                        {!canReviewRelease && <p className='error-box'>Add an audio file and title before publishing.</p>}
                      </div>
                    )}

                    <div className='wizard-actions'>
                      <button className='secondary-action compact-action' type='button' onClick={goToPreviousReleaseStep} disabled={releaseStepIndex === 0}>
                        Back
                      </button>
                      {releaseStep === 'review' ? (
                        <button
                          className='primary-action compact-action'
                          type='button'
                          onClick={registerRights}
                          disabled={isRegistering || artistStudioLocked || !canReviewRelease}
                        >
                          {isRegistering ? <Disc3 size={16} className='spin' /> : <BadgeCheck size={16} />}
                          {isRegistering ? 'Publishing…' : artistStudioLocked ? 'Create profile first' : 'Publish release'}
                        </button>
                      ) : (
                        <button className='primary-action compact-action' type='button' onClick={goToNextReleaseStep}>
                          Continue
                        </button>
                      )}
                    </div>

                    <p className='rights-status'>{rightsStatus}</p>
                  </div>

                  <div className='doc-panel release-preview-panel'>
                    <PanelTitle icon={Library} title='Release preview' meta={accessModeLabelFromState(accessMode)} />
                    <div className='release-preview-card'>
                      <div className='release-preview-cover'>
                        <img src={coverSource} alt='' crossOrigin='anonymous' />
                      </div>
                      <div className='release-preview-copy'>
                        <span className='release-preview-artist'>{artistName || 'Artist'}</span>
                        <h2>{title || 'Untitled'}</h2>
                        <p>{description || 'Add a short release note to help listeners understand the world behind this track.'}</p>
                        <div className='access-badges'>
                          <span>{accessModeLabelFromState(accessMode)}</span>
                          <span>{accessMode === 'classic' ? `${priceDot} DOT` : `PoP ${personhoodLevel}`}</span>
                        </div>
                      </div>
                    </div>
                    <div className='rights-status'>
                      Audio, cover art, and metadata are pinned to open networks. Dotify keeps the release portable instead of locking it inside one platform.
                    </div>
                  </div>
                </section>
              )}

              {artistTab === 'releases' && (
                <section className='content-grid releases-grid'>
                  <div className='doc-panel releases-panel'>
                    <PanelTitle icon={Library} title='My releases' meta={`${artistTracks.length} releases`} />
                    <div className='catalogue-table release-table'>
                      {artistTracks.length > 0 ? (
                        artistTracks.map(track => (
                          <button
                            className='catalogue-row'
                            key={track.hash}
                            type='button'
                            onClick={() => {
                              void openTrack(track);
                            }}
                          >
                            <img className='track-thumb' src={track.imageRef} alt='' crossOrigin='anonymous' />
                            <span>
                              <strong>{track.title}</strong>
                              <small>
                                {track.artist} / {accessModeLabel(track)} / {track.durationLabel}
                              </small>
                            </span>
                            <code>{track.accessMode === 'classic' ? `${track.priceDot} DOT` : track.personhoodLevel}</code>
                          </button>
                        ))
                      ) : (
                        <div className='empty-state'>No releases registered for this artist wallet yet.</div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {artistTab === 'royalties' && (
                <section className='content-grid royalties-grid'>
                  <div className='doc-panel royalties-panel'>
                    <PanelTitle icon={Wallet} title='Royalty ledger' meta={artistRuntimeAddress ? 'on-chain payments' : 'profile needed'} />
                    <div className='royalty-summary-grid'>
                      <Metric label='received' value={`${formatWeiAsDot(totalRoyaltyWei)} DOT`} />
                      <Metric label='payments' value={royaltyPayments.length.toString()} />
                      <Metric label='listeners' value={uniqueRoyaltyListeners.toString()} />
                      <Metric label='tracks paid' value={paidRoyaltyTracks.toString()} />
                    </div>
                    <div className='royalty-toolbar'>
                      <p className='rights-status'>{royaltyStatus}</p>
                      <button
                        className='secondary-action compact-action'
                        type='button'
                        onClick={() => void refreshArtistRoyalties(true)}
                        disabled={isRefreshingRoyalties || !artistRuntimeAddress}
                      >
                        {isRefreshingRoyalties ? <Disc3 size={16} className='spin' /> : <RefreshCw size={16} />}
                        {isRefreshingRoyalties ? 'Refreshing…' : 'Refresh ledger'}
                      </button>
                    </div>

                    <div className='royalty-ledger-list'>
                      {royaltyPayments.length > 0 ? (
                        royaltyPayments.map(payment => {
                          const isExpanded = expandedRoyaltyPaymentId === payment.id;

                          return (
                            <article className='royalty-entry' data-expanded={isExpanded} key={payment.id}>
                              <button
                                className='royalty-row'
                                type='button'
                                aria-expanded={isExpanded}
                                aria-controls={`royalty-details-${payment.id}`}
                                onClick={() => setExpandedRoyaltyPaymentId(current => (current === payment.id ? null : payment.id))}
                              >
                                <div className='royalty-row-main'>
                                  <strong>{payment.trackTitle}</strong>
                                  <span>{formatPaymentDate(payment.paidAtMs)}</span>
                                </div>
                                <div className='royalty-row-side'>
                                  <strong>{payment.amountDot} DOT</strong>
                                  <span>
                                    Details
                                    <ChevronDown size={15} />
                                  </span>
                                </div>
                              </button>

                              {isExpanded && (
                                <div className='royalty-details' id={`royalty-details-${payment.id}`}>
                                  <EndpointRow label='Paid at' value={formatPaymentDate(payment.paidAtMs)} />
                                  <EndpointRow
                                    label='Listener wallet'
                                    value={
                                      <a className='verify-link' href={getBlockscoutAddressUrl(payment.listener)} target='_blank' rel='noreferrer'>
                                        {shorten(payment.listener, 14)}
                                      </a>
                                    }
                                  />
                                  <EndpointRow
                                    label='Block'
                                    value={
                                      <a className='verify-link' href={getBlockscoutBlockUrl(payment.blockNumber)} target='_blank' rel='noreferrer'>
                                        {payment.blockNumber.toString()}
                                      </a>
                                    }
                                  />
                                  <EndpointRow
                                    label='Track hash'
                                    value={
                                      <div className='endpoint-link-stack'>
                                        <code>{shorten(payment.trackHash, 18)}</code>
                                        <a className='verify-link' href={getBlockscoutTxUrl(payment.transactionHash)} target='_blank' rel='noreferrer'>
                                          Source event
                                        </a>
                                      </div>
                                    }
                                  />
                                  <EndpointRow
                                    label='Transaction receipt'
                                    value={
                                      <a className='verify-link' href={getBlockscoutTxUrl(payment.transactionHash)} target='_blank' rel='noreferrer'>
                                        {shorten(payment.transactionHash, 14)}
                                      </a>
                                    }
                                  />
                                  {artistRuntimeAddress && (
                                    <EndpointRow
                                      label='Artist runtime'
                                      value={
                                        <a className='verify-link' href={getBlockscoutAddressUrl(artistRuntimeAddress)} target='_blank' rel='noreferrer'>
                                          {shorten(artistRuntimeAddress, 14)}
                                        </a>
                                      }
                                    />
                                  )}
                                  <EndpointRow label='Log index' value={payment.logIndex.toString()} />
                                </div>
                              )}
                            </article>
                          );
                        })
                      ) : (
                        <div className='empty-state'>
                          {artistRuntimeAddress ? 'No paid unlocks recorded yet.' : 'Create an artist profile before tracking payments.'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className='doc-panel royalties-context-panel'>
                    <PanelTitle icon={CircleCheckBig} title='Direct settlement' meta='artist-owned' />
                    <div className='principle-list'>
                      <div>
                        <strong>Runtime ledger</strong>
                        <span>Every row comes from a payment event emitted by your artist runtime.</span>
                      </div>
                      <div>
                        <strong>Listener proof</strong>
                        <span>The listener wallet and transaction stay verifiable without platform accounts.</span>
                      </div>
                      <div>
                        <strong>Open accounting</strong>
                        <span>Amounts are shown in DOT and each payment links back to Blockscout.</span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {artistTab === 'advanced' && (
                <section className='content-grid artist-grid'>
                  <div className='doc-panel contract-panel'>
                    <PanelTitle icon={LockKeyhole} title='Technical details' meta={artistRuntimeAddress ? 'ready' : 'pending'} />
                    <div className='stack-list'>
                      <EndpointRow
                        label='Factory'
                        value={
                          factoryAddress ? (
                            <div className='endpoint-link-stack'>
                              <a className='verify-link' href={getBlockscoutAddressUrl(factoryAddress!)} target='_blank' rel='noreferrer'>
                                {shorten(factoryAddress!, 12)}
                              </a>
                              <small>Verify on Blockscout.</small>
                            </div>
                          ) : (
                            'not deployed'
                          )
                        }
                      />
                      <EndpointRow
                        label='Directory'
                        value={
                          directoryAddress ? (
                            <a className='verify-link' href={getBlockscoutAddressUrl(directoryAddress)} target='_blank' rel='noreferrer'>
                              {shorten(directoryAddress, 12)}
                            </a>
                          ) : (
                            'not deployed'
                          )
                        }
                      />
                      <EndpointRow
                        label='Artist profile'
                        value={
                          artistRuntimeAddress ? (
                            <a className='verify-link' href={getBlockscoutAddressUrl(artistRuntimeAddress)} target='_blank' rel='noreferrer'>
                              {shorten(artistRuntimeAddress, 12)}
                            </a>
                          ) : (
                            'not registered'
                          )
                        }
                      />
                      <EndpointRow label='Content hash' value={fileHash ? shorten(fileHash, 18) : '0x'} />
                      <EndpointRow label='Audio CID' value={audioCID ? shorten(audioCID, 18) : 'pending…'} />
                      <EndpointRow label='Cover CID' value={coverCID ? shorten(coverCID, 18) : 'pending…'} />
                      <EndpointRow label='Bulletin archive' value={bulletinManifestRef || trackInfo?.bulletinRef || 'not published'} />
                    </div>
                  </div>

                  <div className='doc-panel'>
                    <PanelTitle icon={BadgeCheck} title='Capabilities' meta='culture layer' />
                    <div className='stack-list'>
                      <EndpointRow label='Self-owned identity' value='Wallet address' />
                      <EndpointRow label='Portable metadata' value='IPFS manifest' />
                      <EndpointRow label='Public archive' value={uploadToBulletinEnabled ? 'enabled for next release' : 'optional by default'} />
                      <EndpointRow label='Community signer' value={activeSubstrateAddress ? shorten(activeSubstrateAddress, 12) : 'not connected'} />
                    </div>
                  </div>
                </section>
              )}
            </section>
          )}

          {sessionLink && (
            <a className='floating-link' href={sessionLink}>
              <LinkIcon size={15} />
              {roomId}
            </a>
          )}

          {transactionFeedback && (
            <TransactionModal
              feedback={transactionFeedback}
              onClose={() => {
                if (transactionFeedback.tone !== 'pending') {
                  setTransactionFeedback(null);
                }
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function StatusPill({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: 'green' | 'pink' | 'muted' }) {
  return (
    <div className='status-pill' data-tone={tone}>
      <Icon size={14} />
      <span>{label}</span>
    </div>
  );
}

function PanelTitle({ icon: Icon, title, meta }: { icon: LucideIcon; title: string; meta?: string }) {
  return (
    <div className='panel-title'>
      <span>
        <Icon size={17} />
        {title}
      </span>
      {meta && <small>{meta}</small>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className='metric'>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function EndpointRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className='endpoint-row'>
      <span>{label}</span>
      <div className='endpoint-value'>{value}</div>
    </div>
  );
}

function encodeAudioBufferPreviewAsWav(audioBuffer: AudioBuffer, frameCount: number) {
  const channelCount = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2;
  const dataSize = frameCount * channelCount * bytesPerSample;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return bytes;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

// ── Wallet UI components ──────────────────────────────────────────────────────

function WalletStatusPill({ state, onClick, onDisconnect }: { state: WalletState; onClick: () => void; onDisconnect: () => void }) {
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

function WalletModal({
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

function AccessGateOverlay({ gate, onDismiss, onPay, onSignIn }: { gate: AccessGate; onDismiss: () => void; onPay?: () => void; onSignIn?: () => void }) {
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

function TransactionModal({ feedback, onClose }: { feedback: TransactionFeedback; onClose: () => void }) {
  const dismissible = feedback.tone !== 'pending';
  const Icon = feedback.tone === 'pending' ? Disc3 : feedback.tone === 'success' ? CircleCheckBig : CircleAlert;

  return (
    <div className='modal-backdrop' role='presentation' onClick={dismissible ? onClose : undefined}>
      <div
        className='modal-card'
        data-tone={feedback.tone}
        role='dialog'
        aria-modal='true'
        aria-labelledby='transaction-modal-title'
        onClick={event => event.stopPropagation()}
      >
        <div className='modal-header'>
          <div className='modal-icon' data-tone={feedback.tone}>
            <Icon size={20} className={feedback.tone === 'pending' ? 'spin' : undefined} />
          </div>
          {dismissible && (
            <button className='modal-close' type='button' onClick={onClose} aria-label='Close transaction feedback'>
              <X size={16} />
            </button>
          )}
        </div>
        <div className='modal-copy'>
          <p className='modal-eyebrow'>{feedback.tone === 'pending' ? 'In progress' : feedback.tone === 'success' ? 'Confirmed' : 'Attention'}</p>
          <h2 id='transaction-modal-title'>{feedback.title}</h2>
          <p>{feedback.message}</p>
        </div>
        {feedback.txHash && (
          <div className='modal-hash'>
            <span>Transaction hash</span>
            <code>{shorten(feedback.txHash, 12)}</code>
            <a className='modal-link' href={getBlockscoutTxUrl(feedback.txHash)} target='_blank' rel='noreferrer'>
              Don't trust. Verify on Blockscout.
            </a>
          </div>
        )}
        {dismissible && (
          <div className='modal-actions'>
            <button className='modal-action' type='button' onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getInitialRoomCode() {
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(hashQuery).get('room')?.toUpperCase() ?? '';
}

function shouldMaterializeRemoteSource(source: string) {
  if (!source) return false;
  if (source.startsWith('blob:') || source.startsWith('data:')) return false;

  try {
    const url = new URL(source, window.location.href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getSessionLink(roomId: string) {
  if (!roomId) return '';
  const url = new URL(window.location.href);
  url.hash = `/?room=${roomId}`;
  return url.toString();
}

function getStoredArtistName(address: `0x${string}`) {
  try {
    return window.localStorage.getItem(getArtistNameStorageKey(address));
  } catch {
    return null;
  }
}

function storeArtistName(address: `0x${string}`, name: string) {
  try {
    window.localStorage.setItem(getArtistNameStorageKey(address), name);
  } catch {
    // ignore storage failures in private browsing or restricted environments
  }
}

function getArtistNameStorageKey(address: `0x${string}`) {
  return `dotify:artist-name:${address.toLowerCase()}`;
}

function isTrackManagedByArtist(track: CatalogTrack, artistAddress: `0x${string}`, artistName: string) {
  if (track.source !== 'artist') return false;
  if (track.artistAddress) return track.artistAddress.toLowerCase() === artistAddress.toLowerCase();
  return track.artist === artistName;
}

function createTrackInfo(
  title: string,
  artist: string,
  hash: `0x${string}` | '',
  bulletinRef: string,
  duration = 0,
  metadata: Partial<TrackInfo> = {}
): TrackInfo {
  return {
    title: title.trim() || 'Untitled',
    artist: artist.trim() || 'Unknown artist',
    hash,
    bulletinRef,
    duration,
    updatedAt: getTimestamp(),
    ...metadata
  };
}

function createTrackInfoFromCatalog(track: CatalogTrack): TrackInfo {
  return createTrackInfo(track.title, track.artist, track.hash, track.bulletinRef, track.duration ?? 0, {
    imageRef: track.imageRef,
    audioRef: track.audioRef,
    metadataRef: track.metadataRef,
    description: track.description,
    accessMode: track.accessMode,
    priceDot: track.priceDot,
    personhoodLevel: track.personhoodLevel
  });
}

function createBulletinManifestRef(hash: `0x${string}`) {
  return `paseo-bulletin:dotify-manifest:${hash}`;
}

function getBlockscoutAddressUrl(address: `0x${string}`) {
  return `${blockscoutBaseUrl}/address/${address}`;
}

function getBlockscoutTxUrl(txHash: `0x${string}`) {
  return `${blockscoutBaseUrl}/tx/${txHash}`;
}

function getBlockscoutBlockUrl(blockNumber: bigint) {
  return `${blockscoutBaseUrl}/block/${blockNumber.toString()}`;
}

function resolveVisualAssetRef(assetRef: string, title: string) {
  if (!assetRef) {
    return coverImage('#06152d', '#2bb3ff', title);
  }

  if (assetRef.startsWith('ipfs://')) {
    return getGatewayUrl(assetRef.slice('ipfs://'.length));
  }

  if (assetRef.startsWith('http://') || assetRef.startsWith('https://') || assetRef.startsWith('data:') || assetRef.startsWith('blob:')) {
    return assetRef;
  }

  return coverImage('#06152d', '#2bb3ff', title);
}

function resolveAudioAssetRef(assetRef: string) {
  if (!assetRef) {
    return undefined;
  }

  // Encrypted IPFS audio — resolve to gateway URL; caller is responsible for decryption.
  if (isEncryptedAudioRef(assetRef)) {
    return getGatewayUrl(encryptedRefToCID(assetRef));
  }

  if (assetRef.startsWith('ipfs://')) {
    return getGatewayUrl(assetRef.slice('ipfs://'.length));
  }

  if (assetRef.startsWith('http://') || assetRef.startsWith('https://') || assetRef.startsWith('blob:') || assetRef.startsWith('data:')) {
    return assetRef;
  }

  return undefined;
}

function accessModeLabel(track: CatalogTrack) {
  return accessModeLabelFromState(track.accessMode);
}

function accessModeLabelFromState(mode: AccessMode) {
  return mode === 'human-free' ? 'Human free' : 'Classic';
}

function catalogAccessLabel(track: CatalogTrack) {
  return track.accessMode === 'classic' ? `${track.priceDot} DOT` : `Proof of Personhood ${track.personhoodLevel}`;
}

function catalogAccessAriaLabel(track: CatalogTrack, hasAccess: boolean) {
  const status = hasAccess ? 'Access already available' : 'Access required';
  return `${status}: ${catalogAccessLabel(track)}`;
}

function dotToPlanck(dot: string) {
  const [whole = '0', fraction = ''] = dot.trim().split('.');
  const paddedFraction = `${fraction.slice(0, 10)}${'0'.repeat(10)}`.slice(0, 10);
  return BigInt(whole || '0') * 10_000_000_000n + BigInt(paddedFraction || '0');
}

function formatPlanckAsDot(planck: bigint) {
  const whole = planck / 10_000_000_000n;
  const fraction = (planck % 10_000_000_000n).toString().padStart(10, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function formatWeiAsDot(wei: bigint) {
  const [whole = '0', fraction = ''] = formatEther(wei).split('.');
  const trimmedFraction = fraction.replace(/0+$/, '').slice(0, 4);
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

function formatBlockTimestampMs(timestamp: bigint | undefined) {
  return timestamp === undefined ? null : Number(timestamp) * 1000;
}

function formatPaymentDate(timestampMs: number | null) {
  if (timestampMs === null) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestampMs));
}

function getTimestamp() {
  return Date.now();
}

function normalizeRooms(rooms: OpenRoom[]) {
  return Array.isArray(rooms) ? rooms : [];
}

function normalizeRoomCode(roomCode: string) {
  return roomCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

function describeArtistRegistrationError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Artist registration failed';

  if (/consumes more than the allowed weight|proof_size|overweight_by/i.test(message)) {
    return 'Artist registration exceeds the current Polkadot Hub EVM weight limit. Redeploy the updated ArtistRuntimeFactory, then refresh the app deployment addresses before trying again.';
  }

  if (/artist already has a runtime/i.test(message)) {
    return 'This signer already owns a SmartRuntime. Refresh the status and manage releases on that runtime.';
  }

  return message;
}

function getPeerStatus(connectionState: RTCPeerConnectionState): PeerStatus {
  if (connectionState === 'connected') return 'connected';
  if (connectionState === 'new' || connectionState === 'connecting') return 'connecting';
  return 'disconnected';
}

function peerStatusLabel(status: PeerStatus) {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'waiting':
      return 'Waiting';
    case 'disconnected':
      return 'Disconnected';
    default:
      return status;
  }
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

function progressPercent(state: PlayerState | null) {
  if (!state || !state.duration) return 0;
  return Math.min(100, Math.max(0, (state.currentTime / state.duration) * 100));
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, '');
}

function shorten(value: string, visible: number) {
  if (value.length <= visible * 2 + 3) return value;
  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}
