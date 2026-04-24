import {
  CircleAlert,
  CircleCheckBig,
  Copy,
  Play,
  Wifi,
  Disc3,
  Pause,
  Radio,
  Upload,
  Library,
  WifiOff,
  FileAudio,
  RefreshCw,
  BadgeCheck,
  Headphones,
  LockKeyhole,
  type LucideIcon,
  X,
  Link as LinkIcon
} from 'lucide-react';

import { hashFileWithBytes } from './utils/hash';
import { io, type Socket } from 'socket.io-client';
import { deployments } from './config/deployments';
import { devAccounts } from './hooks/useDevAccounts';
import { getDefaultEthRpcUrl } from './config/network';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  ensureContract,
  evmDevAccounts,
  getPublicClient,
  getWalletClient,
  artistRuntimeFactoryAbi,
  artistDirectoryAbi,
  musicRegistryAbi
} from './config/contracts';
import { checkBulletinAuthorization, destroyBulletinClient, encodeBulletinJson, uploadToBulletin } from './hooks/useBulletin';
import { fetchCatalogFromPinata, getGatewayUrl, uploadFileToPinata, uploadJsonToPinata, type DotifyTrackManifest } from './services/pinata';

type Mode = 'host' | 'listener';
type PersonhoodLevel = 'DIM1' | 'DIM2';
type View = 'listen' | 'rooms' | 'artist';
type AccessMode = 'human-free' | 'classic';
type SocketStatus = 'offline' | 'connecting' | 'online' | 'error';
type PeerStatus = 'waiting' | 'connecting' | 'connected' | 'disconnected';
type SessionAction = 'idle' | 'creating' | 'joining';
type AssetAction = 'idle' | 'audio' | 'cover';
type TransactionFeedbackTone = 'pending' | 'success' | 'error';

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

// TODO: Update this when switching to statement store signaling
const signalUrl = import.meta.env.VITE_SIGNAL_URL ?? `${window.location.protocol}//${window.location.hostname}:8788`;
const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
const blockscoutBaseUrl = 'https://blockscout-testnet.polkadot.io';
const zeroAddress = '0x0000000000000000000000000000000000000000' as const;

function coverImage(primary: string, secondary: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><rect width="640" height="640" fill="${primary}"/><circle cx="490" cy="120" r="210" fill="${secondary}" opacity=".72"/><circle cx="160" cy="520" r="190" fill="#1ed760" opacity=".82"/><text x="48" y="108" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="42" font-weight="800">${label}</text><path d="M230 242c0-25 20-45 45-45h98v62h-70v132c0 34-28 62-62 62s-62-28-62-62 28-62 62-62c13 0 25 4 35 11v-98h-46Z" fill="#fff" opacity=".92"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const initialCatalog: CatalogTrack[] = [
  {
    id: 'nala-linha-rosa',
    hash: '0xa7f6c3e91b6d4a8e9f2c45b8d31a0c3f0d8b7a6c5e4f39281726354433221100',
    title: 'Linha Rosa',
    artist: 'Nala Drift',
    description: 'A neon commute track built for shared night rides.',
    imageRef: coverImage('#2d1b69', '#e6007a', 'Linha Rosa'),
    audioRef: 'seed://audio/linha-rosa',
    bulletinRef: 'paseo-bulletin:manifest-seed-linha-rosa',
    metadataRef: 'paseo-bulletin:manifest-seed-linha-rosa',
    royaltyBps: 7000,
    royaltySplits: [],
    accessMode: 'human-free',
    priceDot: '0',
    personhoodLevel: 'DIM1',
    source: 'seed',
    zone: 'Metro',
    durationLabel: '3:24'
  },
  {
    id: 'nala-window-seat',
    hash: '0xb18f31c283d745aa910bb3e498f72c61d0d8f4a7519c6e2538271dbf640ca112',
    title: 'Window Seat Loop',
    artist: 'Nala Drift',
    description: 'Soft loop for a quiet bus window and a shared pair of headphones.',
    imageRef: coverImage('#0f5132', '#136f63', 'Window Seat'),
    audioRef: 'seed://audio/window-seat',
    bulletinRef: 'paseo-bulletin:manifest-seed-window-seat',
    metadataRef: 'paseo-bulletin:manifest-seed-window-seat',
    royaltyBps: 7000,
    royaltySplits: [],
    accessMode: 'classic',
    priceDot: '0.2',
    personhoodLevel: 'DIM1',
    source: 'seed',
    zone: 'Bus',
    durationLabel: '2:58'
  },
  {
    id: 'kongo-pulse-mbanza',
    hash: '0xc9d61f48a3b2e70444ad1f93f69e5a77e2d65109a8bc4e2038f7d615ab120091',
    title: 'Mbanza Signal',
    artist: 'Kongo Pulse',
    description: 'Percussive signal music designed for station-to-station discovery.',
    imageRef: coverImage('#2f160f', '#d97706', 'Mbanza'),
    audioRef: 'seed://audio/mbanza-signal',
    bulletinRef: 'paseo-bulletin:manifest-seed-mbanza-signal',
    metadataRef: 'paseo-bulletin:manifest-seed-mbanza-signal',
    royaltyBps: 7500,
    royaltySplits: [],
    accessMode: 'human-free',
    priceDot: '0',
    personhoodLevel: 'DIM2',
    source: 'seed',
    zone: 'Station',
    durationLabel: '4:08'
  },
  {
    id: 'rue-nova-night',
    hash: '0xd24421bc73a5019d67f49deff13c5a80b21f34a6d8e9cc70a5f8b31e902d7740',
    title: 'Rue Nova',
    artist: 'Kongo Pulse',
    description: 'A classic paid release with automatic royalty settlement metadata.',
    imageRef: coverImage('#0f172a', '#2563eb', 'Rue Nova'),
    audioRef: 'seed://audio/rue-nova',
    bulletinRef: 'paseo-bulletin:manifest-seed-rue-nova',
    metadataRef: 'paseo-bulletin:manifest-seed-rue-nova',
    royaltyBps: 7500,
    royaltySplits: [],
    accessMode: 'classic',
    priceDot: '0.5',
    personhoodLevel: 'DIM1',
    source: 'seed',
    zone: 'Tram',
    durationLabel: '3:41'
  },
  {
    id: 'sol-mai-the-platform',
    hash: '0xe90177c4a7d59b13099bb8f1c62452ac7d9a1ef513782eda9a0bc44243d90188',
    title: 'The Platform',
    artist: 'Sol Mai',
    description: 'A human-gated release for unique-person discovery drops.',
    imageRef: coverImage('#312e81', '#0891b2', 'Platform'),
    audioRef: 'seed://audio/the-platform',
    bulletinRef: 'paseo-bulletin:manifest-seed-the-platform',
    metadataRef: 'paseo-bulletin:manifest-seed-the-platform',
    royaltyBps: 6800,
    royaltySplits: [],
    accessMode: 'human-free',
    priceDot: '0',
    personhoodLevel: 'DIM1',
    source: 'seed',
    zone: 'Train',
    durationLabel: '3:12'
  }
];

const viewCopy: Record<View, { title: string; eyebrow: string }> = {
  listen: { title: 'Let the Music connect the dots', eyebrow: 'By Polkadot' },
  rooms: { title: 'Live listening rooms', eyebrow: 'Join a real-time stream opened by another host.' },
  artist: { title: 'Artist Studio', eyebrow: 'Register your artist runtime first, then manage your releases.' }
};

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
  const [selectedTrackId, setSelectedTrackId] = useState(initialCatalog[0].id);
  const [catalogTracks, setCatalogTracks] = useState<CatalogTrack[]>(initialCatalog);
  const [mode, setMode] = useState<Mode>(() => (getInitialRoomCode() ? 'listener' : 'host'));
  const [activeView, setActiveView] = useState<View>(() => (getInitialRoomCode() ? 'rooms' : 'listen'));

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
  const [uploadToBulletinEnabled, setUploadToBulletinEnabled] = useState(true);
  const [isRefreshingRooms, setIsRefreshingRooms] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [personhoodLevel, setPersonhoodLevel] = useState<PersonhoodLevel>('DIM1');
  const [coverSource, setCoverSource] = useState(coverImage('#111827', '#e6007a', 'Dotify'));
  const [description, setDescription] = useState('Describe the story, rights context, and intended audience for this track.');
  const [transactionFeedback, setTransactionFeedback] = useState<TransactionFeedback | null>(null);
  const [audioCID, setAudioCID] = useState('');
  const [coverCID, setCoverCID] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [artistRuntimeAddress, setArtistRuntimeAddress] = useState<`0x${string}` | null>(null);
  const [artistRegistrationStatus, setArtistRegistrationStatus] = useState('Checking artist registration');
  const [isRefreshingArtistRuntime, setIsRefreshingArtistRuntime] = useState(false);
  const [isRegisteringArtist, setIsRegisteringArtist] = useState(false);

  const roomIdRef = useRef('');
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
  const currentArtistAccount = evmDevAccounts[artistAccountIndex];
  const currentArtistAddress = currentArtistAccount.account.address;
  const catalogByArtist = groupTracksByArtist(catalogTracks);
  const selectedTrack = catalogTracks.find(track => track.id === selectedTrackId);

  const streamTitle = trackInfo?.title || selectedTrack?.title || title;
  const artistTracks = catalogTracks.filter(track => isTrackManagedByArtist(track, currentArtistAddress, artistName));
  const streamArtist = trackInfo?.artist || selectedTrack?.artist || artistName;
  const activeListeners = listeners.filter(listener => listener.status === 'connected').length;
  const artistRegistrationAvailable = Boolean(factoryAddress && directoryAddress);
  const artistStudioLocked = artistRegistrationAvailable && !artistRuntimeAddress;

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
    fetchCatalogFromPinata()
      .then(manifests => {
        if (manifests.length === 0) return;
        const ipfsTracks: CatalogTrack[] = manifests.map(m => ipfsManifestToCatalogTrack(m));
        setCatalogTracks(tracks => {
          const seedTracks = tracks.filter(t => t.source === 'seed');
          return [...ipfsTracks, ...seedTracks];
        });
        setSelectedTrackId(ipfsTracks[0].id);
      })
      .catch(() => {
        // fall back to seed catalog when IPFS is unavailable
        console.warn('Failed to fetch catalog from Pinata, using seed catalog only');
      });
  }, []);

  useEffect(() => {
    const storedName = getStoredArtistName(currentArtistAddress);
    if (storedName) {
      setArtistName(storedName);
      return;
    }

    setArtistName(previous => (previous.trim() && previous !== 'Dotify Artist' ? previous : `${currentArtistAccount.name} Studio`));
  }, [currentArtistAccount.name, currentArtistAddress]);

  useEffect(() => {
    if (activeView !== 'artist') return;
    const storedName = getStoredArtistName(currentArtistAddress);
    if (storedName) {
      setArtistName(storedName);
    }
  }, [activeView, currentArtistAddress]);

  useEffect(() => {
    void refreshArtistRuntime();
  }, [currentArtistAddress, directoryAddress, ethRpcUrl]);

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

  function selectTrack(track: CatalogTrack) {
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
    setAudioSource(track.localUrl ?? null);
    setTrackInfo(createTrackInfoFromCatalog(track));
    setPlayerState(null);

    if (!track.localUrl) {
      localStreamRef.current = null;
      setLocalStreamReady(false);
      closeHostPeers();
      setSessionStatus('Source required');
    }

    socketRef.current?.emit('room:track', createTrackInfoFromCatalog(track));
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
        args: [currentArtistAddress]
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

  function updateArtistName(nextName: string) {
    setArtistName(nextName);
    storeArtistName(currentArtistAddress, nextName);
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

      const walletClient = await getWalletClient(artistAccountIndex, ethRpcUrl);
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
      const message = registrationError instanceof Error ? registrationError.message : 'Artist registration failed';
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
    setActiveView('listen');
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
    setActiveView('listen');
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

      const uploadPromise = uploadFileToPinata(file, file.name, { app: 'dotify', type: 'audio' })
        .then(cid => {
          setAudioCID(cid);
          setRightsStatus('Audio ready — uploaded to IPFS');
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
        coverCID: resolvedCoverCID
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
                .then(r => r.blob())
                .then(b => uploadFileToPinata(new File([b], title || 'audio'), title || 'audio', { app: 'dotify', type: 'audio' }))
            : Promise.resolve('')),
        coverUploadRef.current ?? (coverFile ? uploadFileToPinata(coverFile, coverFile.name, { app: 'dotify', type: 'cover' }) : Promise.resolve(''))
      ]);

      if (resolvedAudioCID) setAudioCID(resolvedAudioCID);
      if (resolvedCoverCID) setCoverCID(resolvedCoverCID);

      const royaltyRecipients = [evmDevAccounts[artistAccountIndex].account.address];
      const royaltyShares = [royaltyBps];
      const manifest = createRightsManifest(fileHash, royaltyRecipients, royaltyShares, resolvedAudioCID, resolvedCoverCID);
      const manifestPayload = encodeBulletinJson(manifest);

      // Upload manifest to IPFS (Pinata) first
      setRightsStatus('Publishing manifest to IPFS…');
      setTransactionFeedback({
        tone: 'pending',
        title: 'Uploading to IPFS',
        message: 'Pinning the track manifest to IPFS via Pinata.'
      });
      const metadataCID = await uploadJsonToPinata(manifest, `${manifest.track.title}.json`, { app: 'dotify', type: 'track-metadata' });
      const ipfsMetadataRef = `ipfs://${metadataCID}`;

      if (uploadToBulletinEnabled) {
        const account = devAccounts[bulletinAccountIndex];
        setRightsStatus('Checking Bulletin authorization for metadata JSON');
        setTransactionFeedback({
          tone: 'pending',
          title: 'Authorizing Bulletin upload',
          message: 'Checking whether the selected Bulletin account can publish this manifest.'
        });
        const authorized = await checkBulletinAuthorization(account.address, manifestPayload.bytes.length);
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
        const bulletinUpload = await uploadToBulletin(manifestPayload.bytes, account.signer);
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
        storeRegisteredWork(fileHash, bulletinRef || ipfsMetadataRef, undefined, resolvedAudioCID, resolvedCoverCID, metadataCID);
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

      const walletClient = await getWalletClient(artistAccountIndex, ethRpcUrl);

      const ipfsAudioRef = resolvedAudioCID ? `ipfs://${resolvedAudioCID}` : `dotify:local:${fileHash}`;
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
            metadataRef: ipfsMetadataRef || bulletinRef || createMetadataRef(fileHash),
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
      storeRegisteredWork(fileHash, bulletinRef || ipfsMetadataRef, txHash, resolvedAudioCID, resolvedCoverCID, metadataCID);
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

  function storeRegisteredWork(
    hash: `0x${string}`,
    bulletinRef: string,
    txHash?: `0x${string}`,
    resolvedAudioCID = '',
    resolvedCoverCID = '',
    metadataCID = ''
  ) {
    const duration = localAudioRef.current?.duration;
    const resolvedDuration = Number.isFinite(duration) ? Number(duration) : 0;

    const ipfsAudioRef = resolvedAudioCID ? `ipfs://${resolvedAudioCID}` : `dotify:local:${hash}`;
    const ipfsMetadataRef = metadataCID ? `ipfs://${metadataCID}` : bulletinRef || createMetadataRef(hash);
    const coverDisplayRef = resolvedCoverCID ? getGatewayUrl(resolvedCoverCID) : coverSource;

    // Use gateway URL as localUrl so the audio plays directly from IPFS
    const localUrl = audioSource ?? (resolvedAudioCID ? getGatewayUrl(resolvedAudioCID) : undefined);

    const nextTrack: CatalogTrack = {
      id: hash,
      hash,
      title: title.trim() || 'Untitled',
      artist: artistName.trim() || 'Unknown artist',
      description: description.trim(),
      imageRef: coverDisplayRef,
      audioRef: ipfsAudioRef,
      bulletinRef,
      metadataRef: ipfsMetadataRef,
      royaltyBps,
      royaltySplits: [
        {
          label: artistName.trim() || 'Primary artist',
          recipient: currentArtistAddress,
          bps: royaltyBps
        }
      ],
      accessMode,
      priceDot: accessMode === 'classic' ? priceDot : '0',
      personhoodLevel,
      txHash,
      source: 'artist',
      zone: 'Studio',
      duration: resolvedDuration,
      durationLabel: resolvedDuration ? formatTime(resolvedDuration) : 'ready',
      localUrl,
      artistAddress: currentArtistAddress
    };

    setCatalogTracks(tracks => [nextTrack, ...tracks.filter(track => track.hash !== hash)]);
    setSelectedTrackId(nextTrack.id);
    const track = createTrackInfoFromCatalog(nextTrack);
    setTrackInfo(track);
    socketRef.current?.emit('room:track', track);
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
        </nav>
      </header>

      <div className='docs-layout' id='top'>
        <aside className='sidebar' aria-label='Dotify navigation'>
          <div className='sidebar-heading'>Dotify</div>
          <button className='sidebar-link' data-active={activeView === 'listen'} type='button' onClick={() => setActiveView('listen')}>
            <Headphones size={16} />
            Home
          </button>
          <button
            className='sidebar-link'
            data-active={activeView === 'rooms'}
            type='button'
            onClick={() => {
              setActiveView('rooms');
              requestOpenRooms(true);
            }}
          >
            <Radio size={16} />
            Rooms
          </button>
          <button className='sidebar-link' data-active={activeView === 'artist'} type='button' onClick={() => setActiveView('artist')}>
            <FileAudio size={16} />
            Artist Studio
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
            <section className='content-grid listen-grid'>
              <div className='doc-panel catalogue-panel'>
                <PanelTitle icon={Library} title='Browse catalog' meta={`${catalogTracks.length} tracks`} />
                <div className='artist-list'>
                  {catalogByArtist.map(group => (
                    <div className='artist-block' key={group.artist}>
                      <div className='artist-heading'>
                        <strong>{group.artist}</strong>
                        <span>{group.tracks.length}</span>
                      </div>
                      {group.tracks.map(track => (
                        <button
                          className='track-row'
                          data-selected={selectedTrackId === track.id}
                          key={track.id}
                          type='button'
                          onClick={() => selectTrack(track)}
                        >
                          <img className='track-thumb' src={track.imageRef} alt='' crossOrigin='anonymous' />
                          <span>
                            <strong>{track.title}</strong>
                            <small>
                              {track.zone} / {track.durationLabel} / {accessModeLabel(track)}
                            </small>
                          </span>
                          <code>{track.accessMode === 'classic' ? `${track.priceDot} DOT` : track.personhoodLevel}</code>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className='doc-panel player-panel'>
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
                      onLoadedMetadata={prepareLocalStream}
                      onPlay={() => emitPlayerState(true)}
                      onPause={() => emitPlayerState(true)}
                      onSeeked={() => emitPlayerState(true)}
                      onTimeUpdate={() => emitPlayerState(false)}
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
              </div>

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
            <section className='content-grid artist-grid'>
              <div className='studio-column'>
                <div className='doc-panel studio-panel'>
                  <PanelTitle icon={LockKeyhole} title='Artist registration' meta={artistRuntimeAddress ? 'registered' : 'required'} />

                  <div className='fields-grid'>
                    <label>
                      <span>Artist name</span>
                      <input className='field' value={artistName} onChange={event => updateArtistName(event.target.value)} />
                    </label>
                    <label>
                      <span>Signer</span>
                      <select className='field' value={artistAccountIndex} onChange={event => setArtistAccountIndex(Number(event.target.value))}>
                        {evmDevAccounts.map((account, index) => (
                          <option key={account.name} value={index}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className='stack-list'>
                    <EndpointRow
                      label='Signer'
                      value={
                        <a className='verify-link' href={getBlockscoutAddressUrl(currentArtistAddress)} target='_blank' rel='noreferrer'>
                          {shorten(currentArtistAddress, 12)}
                        </a>
                      }
                    />
                    <EndpointRow
                      label='SmartRuntime'
                      value={
                        artistRuntimeAddress ? (
                          <div className='endpoint-link-stack'>
                            <a className='verify-link' href={getBlockscoutAddressUrl(artistRuntimeAddress)} target='_blank' rel='noreferrer'>
                              {shorten(artistRuntimeAddress, 12)}
                            </a>
                            <small>Artist registered</small>
                          </div>
                        ) : (
                          'not registered'
                        )
                      }
                    />
                  </div>

                  <div className='rights-status'>
                    {artistRegistrationAvailable
                      ? 'Each artist signer gets one personal SmartRuntime. Register once, then publish and manage releases on that runtime.'
                      : 'Artist runtime contracts are not deployed yet. The studio can only stage assets locally.'}
                  </div>
                  <p className='rights-status'>{artistRegistrationStatus}</p>

                  <button className='primary-action wide' type='button' onClick={registerArtist} disabled={isRegisteringArtist || !artistRegistrationAvailable}>
                    {isRegisteringArtist ? <Disc3 size={16} className='spin' /> : <BadgeCheck size={16} />}
                    {isRegisteringArtist ? 'Registering artist…' : artistRuntimeAddress ? 'Artist registered' : 'Register artist'}
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

                <div className='doc-panel studio-panel'>
                  <PanelTitle icon={FileAudio} title='Manage releases' meta={artistStudioLocked ? 'register first' : 'runtime ready'} />
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

                  <div className='fields-grid'>
                    <label>
                      <span>Title</span>
                      <input className='field' value={title} onChange={event => setTitle(event.target.value)} disabled={artistStudioLocked} />
                    </label>
                    <label>
                      <span>Bulletin</span>
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
                    <label>
                      <span>Description</span>
                      <textarea
                        className='field textarea-field'
                        value={description}
                        onChange={event => setDescription(event.target.value)}
                        disabled={artistStudioLocked}
                      />
                    </label>
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
                  </div>

                  <label className='toggle-row'>
                    <input
                      type='checkbox'
                      checked={uploadToBulletinEnabled}
                      onChange={event => setUploadToBulletinEnabled(event.target.checked)}
                      disabled={artistStudioLocked}
                    />
                    <span>Publish metadata JSON to Bulletin Chain</span>
                  </label>

                  <button className='primary-action wide' type='button' onClick={registerRights} disabled={isRegistering || artistStudioLocked}>
                    {isRegistering ? <Disc3 size={16} className='spin' /> : <BadgeCheck size={16} />}
                    {isRegistering ? 'Registering…' : artistStudioLocked ? 'Register artist to unlock' : 'Register track'}
                  </button>

                  <div className='rights-status'>
                    Audio and cover art are held in memory for this session. Bulletin Chain receives only the compact JSON manifest.
                  </div>
                  <div className='rights-status'>
                    {accessMode === 'human-free'
                      ? `Human free tracks are listenable by users with Polkadot Proof of Personhood ${personhoodLevel}; NFT transfers stay PoP-gated.`
                      : `Classic tracks require a DOT payment or subscription; the contract records royalty recipients for automatic settlement.`}
                  </div>
                  <p className='rights-status'>{rightsStatus}</p>
                </div>
              </div>

              <div className='doc-panel contract-panel'>
                <PanelTitle icon={LockKeyhole} title='Artist runtime' meta={artistRuntimeAddress ? 'ready' : 'pending'} />
                <div className='stack-list'>
                  <EndpointRow
                    label='Factory'
                    value={
                      factoryAddress ? (
                        <div className='endpoint-link-stack'>
                          <a className='verify-link' href={getBlockscoutAddressUrl(factoryAddress!)} target='_blank' rel='noreferrer'>
                            {shorten(factoryAddress!, 12)}
                          </a>
                          <small>Don't trust. Verify on Blockscout.</small>
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
                    label='Runtime'
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
                  <EndpointRow label='Audio' value={audioSource ? 'ready' : 'not loaded'} />
                  <EndpointRow label='Audio CID' value={audioCID ? shorten(audioCID, 18) : 'pending…'} />
                  <EndpointRow label='Cover' value={coverSource.startsWith('blob:') ? 'ready' : 'generated'} />
                  <EndpointRow label='Cover CID' value={coverCID ? shorten(coverCID, 18) : 'pending…'} />
                  <EndpointRow label='Bulletin JSON' value={bulletinManifestRef || trackInfo?.bulletinRef || 'not published'} />
                </div>

                <div className='registry-releases'>
                  <PanelTitle icon={Library} title='My releases' meta={`${artistTracks.length} releases`} />
                  <div className='catalogue-table'>
                    {artistTracks.length > 0 ? (
                      artistTracks.map(track => (
                        <button className='catalogue-row' key={track.hash} type='button' onClick={() => selectTrack(track)}>
                          <img className='track-thumb' src={track.imageRef} alt='' crossOrigin='anonymous' />
                          <span>
                            <strong>{track.title}</strong>
                            <small>
                              {track.artist} / {accessModeLabel(track)}
                            </small>
                          </span>
                          <code>{track.accessMode === 'classic' ? `${track.priceDot} DOT` : track.personhoodLevel}</code>
                        </button>
                      ))
                    ) : (
                      <div className='empty-state'>No releases registered for this artist signer</div>
                    )}
                  </div>
                </div>
              </div>
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

function ipfsManifestToCatalogTrack(m: DotifyTrackManifest): CatalogTrack {
  const { track, assets, royalties, settlement, evm } = m;
  const audioCID = assets?.audioCID ?? '';
  const coverCID = assets?.coverCID ?? '';
  const metadataCID = evm?.txHash ? '' : ''; // metadataCID unknown here; ref stored separately
  const ipfsAudioRef = audioCID ? `ipfs://${audioCID}` : '';
  const coverDisplayRef = coverCID ? getGatewayUrl(coverCID) : coverImage('#111827', '#e6007a', track.title);

  return {
    id: track.contentHash || `ipfs-${m.createdAt}`,
    hash: (track.contentHash as `0x${string}`) || '0x',
    title: track.title,
    artist: track.artistName,
    description: track.description,
    imageRef: coverDisplayRef,
    audioRef: ipfsAudioRef,
    bulletinRef: '',
    metadataRef: metadataCID ? `ipfs://${metadataCID}` : '',
    royaltyBps: settlement.royaltyBps,
    royaltySplits: royalties.map(r => ({
      label: r.recipient,
      recipient: r.recipient as `0x${string}`,
      bps: r.bps
    })),
    artistAddress: royalties[0]?.recipient as `0x${string}` | undefined,
    accessMode: track.accessMode,
    priceDot: track.priceDot,
    personhoodLevel: (track.requiredPersonhood === 'DIM2' ? 'DIM2' : 'DIM1') as PersonhoodLevel,
    txHash: evm?.txHash as `0x${string}` | undefined,
    source: 'artist',
    zone: track.zone ?? 'Studio',
    durationLabel: 'ready',
    localUrl: audioCID ? getGatewayUrl(audioCID) : undefined
  };
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

function createMetadataRef(hash: `0x${string}`) {
  return createBulletinManifestRef(hash);
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

function accessModeLabel(track: CatalogTrack) {
  return accessModeLabelFromState(track.accessMode);
}

function accessModeLabelFromState(mode: AccessMode) {
  return mode === 'human-free' ? 'Human free' : 'Classic';
}

function dotToPlanck(dot: string) {
  const [whole = '0', fraction = ''] = dot.trim().split('.');
  const paddedFraction = `${fraction.slice(0, 10)}${'0'.repeat(10)}`.slice(0, 10);
  return BigInt(whole || '0') * 10_000_000_000n + BigInt(paddedFraction || '0');
}

function getTimestamp() {
  return Date.now();
}

function groupTracksByArtist(tracks: CatalogTrack[]) {
  const groups = new Map<string, CatalogTrack[]>();
  for (const track of tracks) {
    groups.set(track.artist, [...(groups.get(track.artist) ?? []), track]);
  }

  return Array.from(groups.entries())
    .map(([artist, groupTracks]) => ({ artist, tracks: groupTracks }))
    .sort((left, right) => left.artist.localeCompare(right.artist));
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
