import {
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
  Link as LinkIcon
} from 'lucide-react';

import { hashFileWithBytes } from './utils/hash';
import { io, type Socket } from 'socket.io-client';
import { deployments } from './config/deployments';
import { devAccounts } from './hooks/useDevAccounts';
import { getDefaultEthRpcUrl } from './config/network';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { toGatewayUrl, uploadAssetToIpfs, type IpfsAssetMetadata } from './hooks/useIpfs';
import { bytesToHex, decryptAudio, encryptAudio, generateContentKey, hexToBytes } from './utils/crypto';
import { ensureContract, evmDevAccounts, getPublicClient, getWalletClient, musicRightsAbi } from './config/contracts';
import { checkBulletinAuthorization, destroyBulletinClient, encodeBulletinJson, uploadToBulletin } from './hooks/useBulletin';

type Mode = 'host' | 'listener';
type PersonhoodLevel = 'DIM1' | 'DIM2';
type View = 'listen' | 'rooms' | 'artist';
type AccessMode = 'human-free' | 'classic';
type SocketStatus = 'offline' | 'connecting' | 'online' | 'error';
type PeerStatus = 'waiting' | 'connecting' | 'connected' | 'disconnected';

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
  artistContractRef?: string;
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
  contentKeyHex?: string;
  source: 'seed' | 'artist';
  artistContractRef: string;
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

const signalUrl = import.meta.env.VITE_SIGNAL_URL ?? `${window.location.protocol}//${window.location.hostname}:8788`;
const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

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
    audioRef: 'ipfs://dotify-seed-audio-linha-rosa',
    bulletinRef: 'paseo-bulletin:manifest-seed-linha-rosa',
    metadataRef: 'paseo-bulletin:manifest-seed-linha-rosa',
    artistContractRef: 'ipfs://dotify-seed-contract-nala-drift',
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
    audioRef: 'ipfs://dotify-seed-audio-window-seat',
    bulletinRef: 'paseo-bulletin:manifest-seed-window-seat',
    metadataRef: 'paseo-bulletin:manifest-seed-window-seat',
    artistContractRef: 'ipfs://dotify-seed-contract-nala-drift',
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
    audioRef: 'ipfs://dotify-seed-audio-mbanza-signal',
    bulletinRef: 'paseo-bulletin:manifest-seed-mbanza-signal',
    metadataRef: 'paseo-bulletin:manifest-seed-mbanza-signal',
    artistContractRef: 'ipfs://dotify-seed-contract-kongo-pulse',
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
    audioRef: 'ipfs://dotify-seed-audio-rue-nova',
    bulletinRef: 'paseo-bulletin:manifest-seed-rue-nova',
    metadataRef: 'paseo-bulletin:manifest-seed-rue-nova',
    artistContractRef: 'ipfs://dotify-seed-contract-kongo-pulse',
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
    audioRef: 'ipfs://dotify-seed-audio-the-platform',
    bulletinRef: 'paseo-bulletin:manifest-seed-the-platform',
    metadataRef: 'paseo-bulletin:manifest-seed-the-platform',
    artistContractRef: 'ipfs://dotify-seed-contract-sol-mai',
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
  artist: { title: 'Artist Studio', eyebrow: 'Pin assets to IPFS, publish metadata, and register rights.' }
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
  const [artistName, setArtistName] = useState('Dotify Artist');
  const [artistAccountIndex, setArtistAccountIndex] = useState(0);
  const [fileHash, setFileHash] = useState<`0x${string}` | ''>('');
  const [bulletinManifestRef, setBulletinManifestRef] = useState('');
  const [bulletinAccountIndex, setBulletinAccountIndex] = useState(0);
  const [accessMode, setAccessMode] = useState<AccessMode>('human-free');
  const [rightsStatus, setRightsStatus] = useState('No audio file selected');
  const [audioAsset, setAudioAsset] = useState<IpfsAssetMetadata | null>(null);
  const [coverAsset, setCoverAsset] = useState<IpfsAssetMetadata | null>(null);
  const [uploadToBulletinEnabled, setUploadToBulletinEnabled] = useState(true);
  const [personhoodLevel, setPersonhoodLevel] = useState<PersonhoodLevel>('DIM1');
  const [trackContentKey, setTrackContentKey] = useState<Uint8Array | null>(null);
  const [coverSource, setCoverSource] = useState(coverImage('#111827', '#e6007a', 'Dotify'));
  const [artistContractAsset, setArtistContractAsset] = useState<IpfsAssetMetadata | null>(null);
  const [description, setDescription] = useState('Describe the story, rights context, and intended audience for this track.');

  const roomIdRef = useRef('');
  const hostIdRef = useRef('');
  const modeRef = useRef<Mode>(mode);
  const lastPlayerStateEmitRef = useRef(0);
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<ListenerRecord[]>([]);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const localStreamRef = useRef<MediaStream | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const listenerPeerRef = useRef<RTCPeerConnection | null>(null);
  const hostPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const currentPage = viewCopy[activeView];
  const sessionLink = getSessionLink(roomId);
  const contractAddress = deployments.evm;
  const catalogByArtist = groupTracksByArtist(catalogTracks);
  const selectedTrack = catalogTracks.find(track => track.id === selectedTrackId);

  const streamTitle = trackInfo?.title || selectedTrack?.title || title;
  const artistTracks = catalogTracks.filter(track => track.source === 'artist');
  const streamArtist = trackInfo?.artist || selectedTrack?.artist || artistName;
  const activeListeners = listeners.filter(listener => listener.status === 'connected').length;

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
      destroyBulletinClient();
    };
  }, []);

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

  function requestOpenRooms() {
    connectSocket().emit('rooms:list', (rooms: OpenRoom[]) => setOpenRooms(normalizeRooms(rooms)));
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
    setAudioAsset(createReferencedAsset('audio', track.audioRef, track.hash, `${track.title}.audio`));
    setCoverAsset(createReferencedAsset('cover', track.imageRef, track.hash, `${track.title}.cover`));
    setArtistContractAsset(createReferencedAsset('artist-contract', track.artistContractRef, track.hash, `${track.artist}.pdf`));
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
      // For encrypted artist tracks, fetch ciphertext from IPFS and decrypt in-app
      if (track.contentKeyHex && track.audioRef) {
        void loadEncryptedTrack(track);
      } else {
        setSessionStatus('Local source required');
      }
    }

    socketRef.current?.emit('room:track', createTrackInfoFromCatalog(track));
  }

  function createSession(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    changeMode('host');
    setActiveView('listen');
    setError(null);
    setSessionStatus('Opening room');
    closeListenerPeer();

    const socket = connectSocket();
    socket.emit('room:create', { displayName, track: getCurrentTrack() }, (response: CreateRoomResponse) => {
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
    setActiveView('listen');
    setError(null);
    setSessionStatus('Joining room');
    closeHostPeers();

    const socket = connectSocket();
    socket.emit('room:join', { roomId: normalizedRoomId, displayName }, (response: JoinRoomResponse) => {
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

    // hashFileWithBytes reads the file bytes — reuse them for encryption
    const result = await hashFileWithBytes(file);
    const nextTitle = title.trim() === 'Untitled jam' ? stripExtension(file.name) : title;
    // Keep a clear local blob URL for in-session host playback (never leaves the device)
    const nextUrl = URL.createObjectURL(file);
    objectUrlsRef.current.add(nextUrl);

    setAudioSource(nextUrl);
    setFileHash(result.hash);
    setTitle(nextTitle);
    setSelectedTrackId('draft-upload');
    setRightsStatus('Encrypting audio');

    try {
      // Generate a random 32-byte per-track content key (AES-256-GCM)
      const key = generateContentKey();
      setTrackContentKey(key);

      // Encrypt the raw bytes; IPFS will store only ciphertext
      const encryptedBytes = await encryptAudio(result.bytes, key);
      const encryptedFile = new File([encryptedBytes], `${file.name}.enc`, {
        type: 'application/octet-stream'
      });

      setRightsStatus('Uploading encrypted audio to IPFS');
      const nextAudioAsset = await uploadAssetToIpfs(encryptedFile, 'audio', result.hash);
      setAudioAsset({ ...nextAudioAsset, encrypted: true });
      setRightsStatus(nextAudioAsset.uploadMode === 'remote' ? 'Audio encrypted and uploaded to IPFS' : 'Audio encrypted and staged for IPFS upload');

      const track = createTrackInfo(nextTitle, artistName, result.hash, '', 0, {
        imageRef: coverSource,
        audioRef: nextAudioAsset.uri,
        description,
        accessMode,
        priceDot: accessMode === 'classic' ? priceDot : '0',
        personhoodLevel
      });
      setTrackInfo(track);
      socketRef.current?.emit('room:track', track);
    } catch (ipfsError) {
      setAudioAsset(null);
      setRightsStatus(ipfsError instanceof Error ? ipfsError.message : 'Audio IPFS upload failed');
    }
  }

  async function handleCoverFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const nextUrl = URL.createObjectURL(file);
    objectUrlsRef.current.add(nextUrl);
    setCoverSource(nextUrl);

    try {
      const result = await hashFileWithBytes(file);
      setRightsStatus('Uploading cover to IPFS');
      const nextCoverAsset = await uploadAssetToIpfs(file, 'cover', result.hash);
      setCoverAsset(nextCoverAsset);
      setRightsStatus(nextCoverAsset.uploadMode === 'remote' ? 'Cover uploaded to IPFS' : 'Cover staged for IPFS upload');
    } catch (ipfsError) {
      setCoverAsset(null);
      setRightsStatus(ipfsError instanceof Error ? ipfsError.message : 'Cover IPFS upload failed');
    }
  }

  async function handleArtistContractFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await hashFileWithBytes(file);
      setRightsStatus('Uploading artist contract PDF to IPFS');
      const nextContractAsset = await uploadAssetToIpfs(file, 'artist-contract', result.hash);
      setArtistContractAsset(nextContractAsset);
      setRightsStatus(nextContractAsset.uploadMode === 'remote' ? 'Artist contract uploaded to IPFS' : 'Artist contract staged for IPFS upload');
    } catch (ipfsError) {
      setArtistContractAsset(null);
      setRightsStatus(ipfsError instanceof Error ? ipfsError.message : 'Artist contract IPFS upload failed');
    }
  }

  async function prepareLocalStream() {
    const audio = localAudioRef.current;
    if (!audio || !audioSource) return;

    try {
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
      audioRef: audioAsset?.uri,
      metadataRef: bulletinManifestRef || trackInfo?.metadataRef,
      artistContractRef: artistContractAsset?.uri,
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

  function createRightsManifest(contentHash: `0x${string}`, royaltyRecipients: `0x${string}`[], royaltyShares: number[]) {
    return {
      schema: 'dotify.track.v1',
      createdAt: new Date().toISOString(),
      track: {
        contentHash,
        title: title.trim() || 'Untitled',
        artistName: artistName.trim() || 'Unknown artist',
        description: description.trim(),
        accessMode,
        priceDot: accessMode === 'classic' ? priceDot : '0',
        requiredPersonhood: accessMode === 'human-free' ? personhoodLevel : 'None'
      },
      assets: {
        audio: audioAsset,
        cover: coverAsset,
        artistContract: artistContractAsset
      },
      royalties: royaltyRecipients.map((recipient, index) => ({
        recipient,
        bps: royaltyShares[index] ?? 0
      })),
      settlement: {
        target: 'evm',
        royaltyBps,
        pricePlanck: dotToPlanck(accessMode === 'classic' ? priceDot : '0').toString()
      },
      // Best-effort content protection: IPFS stores ciphertext only.
      // The key is stored here so authorized readers (those who pass canAccess()) can decrypt.
      // This is not DRM — a determined attacker who can read this manifest gets the key.
      ...(trackContentKey && {
        encryption: {
          algorithm: 'aes-256-gcm',
          keyHex: bytesToHex(trackContentKey),
          note: 'key in manifest — access gated by canAccess() on MusicRightsRegistry'
        }
      })
    };
  }

  async function registerRights() {
    if (!fileHash) {
      setRightsStatus('Select an audio file');
      return;
    }
    if (!audioAsset) {
      setRightsStatus('Upload the audio file to IPFS first');
      return;
    }
    if (!coverAsset) {
      setRightsStatus('Upload a cover image to IPFS first');
      return;
    }
    if (!artistContractAsset) {
      setRightsStatus('Upload the artist contract PDF to IPFS first');
      return;
    }

    let bulletinRef = trackInfo?.bulletinRef ?? '';
    try {
      const royaltyRecipients = [evmDevAccounts[artistAccountIndex].account.address];
      const royaltyShares = [royaltyBps];
      const manifest = createRightsManifest(fileHash, royaltyRecipients, royaltyShares);
      const manifestPayload = encodeBulletinJson(manifest);

      if (uploadToBulletinEnabled) {
        const account = devAccounts[bulletinAccountIndex];
        setRightsStatus('Checking Bulletin authorization for metadata JSON');
        const authorized = await checkBulletinAuthorization(account.address, manifestPayload.bytes.length);
        if (!authorized) {
          setRightsStatus('Bulletin account is not authorized');
          return;
        }

        setRightsStatus('Publishing metadata JSON to Bulletin Chain');
        const bulletinUpload = await uploadToBulletin(manifestPayload.bytes, account.signer);
        bulletinRef = createBulletinManifestRef(bulletinUpload.contentHash);
        setBulletinManifestRef(bulletinRef);
      }

      if (!contractAddress) {
        setRightsStatus('Rights staged locally');
        storeRegisteredWork(fileHash, bulletinRef);
        return;
      }

      setRightsStatus('Checking contract');
      const exists = await ensureContract(contractAddress, ethRpcUrl);
      if (!exists) {
        setRightsStatus('Contract not found');
        return;
      }

      setRightsStatus('Submitting rights transaction');
      const walletClient = await getWalletClient(artistAccountIndex, ethRpcUrl);
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: musicRightsAbi,
        functionName: 'registerTrack',
        args: [
          {
            contentHash: fileHash,
            title,
            artistName,
            description,
            imageRef: coverAsset.uri,
            audioRef: audioAsset.uri,
            metadataRef: bulletinRef || createMetadataRef(fileHash),
            artistContractRef: artistContractAsset.uri,
            accessMode: accessMode === 'human-free' ? 0 : 1,
            pricePlanck: dotToPlanck(accessMode === 'classic' ? priceDot : '0'),
            requiredPersonhood: accessMode === 'human-free' ? (personhoodLevel === 'DIM2' ? 2 : 1) : 0
          },
          royaltyRecipients,
          royaltyShares
        ]
      });

      await getPublicClient(ethRpcUrl).waitForTransactionReceipt({ hash: txHash });
      setRightsStatus('Rights registered');
      storeRegisteredWork(fileHash, bulletinRef, txHash);
    } catch (registrationError) {
      setRightsStatus(registrationError instanceof Error ? registrationError.message : 'Registration failed');
    }
  }

  function storeRegisteredWork(hash: `0x${string}`, bulletinRef: string, txHash?: `0x${string}`) {
    const duration = localAudioRef.current?.duration;
    const resolvedDuration = Number.isFinite(duration) ? Number(duration) : 0;
    const nextTrack: CatalogTrack = {
      id: hash,
      hash,
      title: title.trim() || 'Untitled',
      artist: artistName.trim() || 'Unknown artist',
      description: description.trim(),
      imageRef: coverSource,
      audioRef: audioAsset?.uri ?? '',
      bulletinRef,
      metadataRef: bulletinRef || createMetadataRef(hash),
      artistContractRef: artistContractAsset?.uri ?? '',
      royaltyBps,
      royaltySplits: [
        {
          label: artistName.trim() || 'Primary artist',
          recipient: evmDevAccounts[artistAccountIndex].account.address,
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
      durationLabel: resolvedDuration ? formatTime(resolvedDuration) : 'local',
      localUrl: audioSource ?? undefined,
      contentKeyHex: trackContentKey ? bytesToHex(trackContentKey) : undefined
    };

    setCatalogTracks(tracks => [nextTrack, ...tracks.filter(track => track.hash !== hash)]);
    setSelectedTrackId(nextTrack.id);
    const track = createTrackInfoFromCatalog(nextTrack);
    setTrackInfo(track);
    socketRef.current?.emit('room:track', track);
  }

  // Fetch encrypted audio from IPFS, decrypt in-app, and load as a blob URL.
  // Called when an artist track is selected without a local clear URL (e.g. after reload).
  async function loadEncryptedTrack(track: CatalogTrack) {
    if (!track.contentKeyHex || !track.audioRef) return;

    const cid = track.audioRef.startsWith('ipfs://') ? track.audioRef.replace('ipfs://', '') : null;
    if (!cid || cid.startsWith('dotify-seed')) return;

    const gatewayUrl = toGatewayUrl(cid);

    try {
      setRightsStatus('Fetching encrypted audio from IPFS');
      const response = await fetch(gatewayUrl);
      if (!response.ok) throw new Error(`IPFS fetch failed: ${response.status}`);

      const encryptedBytes = new Uint8Array(await response.arrayBuffer());
      const key = hexToBytes(track.contentKeyHex);

      setRightsStatus('Decrypting audio');
      const clearBytes = await decryptAudio(encryptedBytes, key);

      const blob = new Blob([clearBytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.add(url);

      setAudioSource(url);
      setLocalStreamReady(false);
      setSessionStatus('Decrypted — ready');
      setRightsStatus('Audio decrypted and ready for playback');
    } catch (err) {
      setRightsStatus(err instanceof Error ? err.message : 'Audio decryption failed');
      setSessionStatus('Decryption failed');
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
              requestOpenRooms();
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
            <p className='eyebrow'>{currentPage.eyebrow}</p>
            <h1>{currentPage.title}</h1>
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
                          <img className='track-thumb' src={track.imageRef} alt='' />
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
                    <img src={trackInfo?.imageRef ?? selectedTrack?.imageRef ?? coverSource} alt='' />
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
                      controls
                      onLoadedMetadata={prepareLocalStream}
                      onPlay={() => emitPlayerState(true)}
                      onPause={() => emitPlayerState(true)}
                      onSeeked={() => emitPlayerState(true)}
                      onTimeUpdate={() => emitPlayerState(false)}
                    />
                    <div className='remote-state' data-active={localStreamReady}>
                      {localStreamReady ? <Play size={16} /> : <Pause size={16} />}
                      <span>{localStreamReady ? 'Stream ready' : 'Local source missing'}</span>
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
                    <button className='primary-action' type='submit'>
                      <Radio size={16} />
                      Start a room
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
                    <button className='primary-action' type='submit'>
                      <Headphones size={16} />
                      Join
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
                        <button type='button' onClick={() => joinRoom(room.roomId)}>
                          <Headphones size={16} />
                          Join
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
                  <button className='primary-action' type='submit'>
                    <Headphones size={16} />
                    Join
                  </button>
                </form>
                <button className='secondary-action' type='button' onClick={requestOpenRooms}>
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>
            </section>
          )}

          {activeView === 'artist' && (
            <section className='content-grid artist-grid'>
              <div className='doc-panel studio-panel'>
                <PanelTitle icon={FileAudio} title='Register a track' meta='artist' />
                <label className='file-button'>
                  <Upload size={16} />
                  Audio to IPFS
                  <input type='file' accept='audio/*' onChange={handleAudioFile} />
                </label>
                <label className='file-button secondary-file'>
                  <Upload size={16} />
                  Cover to IPFS
                  <input type='file' accept='image/*' onChange={handleCoverFile} />
                </label>
                <label className='file-button secondary-file'>
                  <Upload size={16} />
                  Artist contract PDF
                  <input type='file' accept='application/pdf' onChange={handleArtistContractFile} />
                </label>

                <div className='fields-grid'>
                  <label>
                    <span>Title</span>
                    <input className='field' value={title} onChange={event => setTitle(event.target.value)} />
                  </label>
                  <label>
                    <span>Artist</span>
                    <input className='field' value={artistName} onChange={event => setArtistName(event.target.value)} />
                  </label>
                  <label>
                    <span>Description</span>
                    <textarea className='field textarea-field' value={description} onChange={event => setDescription(event.target.value)} />
                  </label>
                  <label>
                    <span>Access mode</span>
                    <select className='field' value={accessMode} onChange={event => setAccessMode(event.target.value as AccessMode)}>
                      <option value='human-free'>Human free</option>
                      <option value='classic'>Classic</option>
                    </select>
                  </label>
                  <label>
                    <span>PoP level</span>
                    <select className='field' value={personhoodLevel} onChange={event => setPersonhoodLevel(event.target.value as PersonhoodLevel)}>
                      <option value='DIM1'>DIM1</option>
                      <option value='DIM2'>DIM2</option>
                    </select>
                  </label>
                  <label>
                    <span>Price in DOT</span>
                    <input className='field' type='number' min={0} step={0.1} value={priceDot} onChange={event => setPriceDot(event.target.value)} />
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
                    />
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
                  <label>
                    <span>Bulletin</span>
                    <select className='field' value={bulletinAccountIndex} onChange={event => setBulletinAccountIndex(Number(event.target.value))}>
                      {devAccounts.map((account, index) => (
                        <option key={account.name} value={index}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className='toggle-row'>
                  <input type='checkbox' checked={uploadToBulletinEnabled} onChange={event => setUploadToBulletinEnabled(event.target.checked)} />
                  <span>Publish metadata JSON to Bulletin Chain</span>
                </label>

                <button className='primary-action wide' type='button' onClick={registerRights}>
                  <BadgeCheck size={16} />
                  Register track
                </button>

                <div className='rights-status'>
                  Audio, cover art, and the artist contract PDF are referenced from IPFS. Bulletin Chain receives only the compact JSON manifest.
                </div>
                <div className='rights-status'>
                  {accessMode === 'human-free'
                    ? `Human free tracks are listenable by users with Polkadot Proof of Personhood ${personhoodLevel}; NFT transfers stay PoP-gated.`
                    : `Classic tracks require a DOT payment or subscription; the contract records royalty recipients for automatic settlement.`}
                </div>
                <p className='rights-status'>{rightsStatus}</p>
              </div>

              <div className='doc-panel contract-panel'>
                <PanelTitle icon={LockKeyhole} title='Rights registry' meta='EVM' />
                <div className='stack-list'>
                  <EndpointRow label='Contract' value={contractAddress ?? 'not deployed'} />
                  <EndpointRow label='Content hash' value={fileHash ? shorten(fileHash, 18) : '0x'} />
                  <EndpointRow label='Audio IPFS' value={audioAsset?.uri ?? 'not uploaded'} />
                  <EndpointRow label='Cover IPFS' value={coverAsset?.uri ?? 'not uploaded'} />
                  <EndpointRow label='Artist PDF' value={artistContractAsset?.uri ?? 'not uploaded'} />
                  <EndpointRow label='Bulletin JSON' value={bulletinManifestRef || trackInfo?.bulletinRef || 'not published'} />
                </div>

                <div className='registry-releases'>
                  <PanelTitle icon={Library} title='Artist releases' meta={`${artistTracks.length} local`} />
                  <div className='catalogue-table'>
                    {artistTracks.length > 0 ? (
                      artistTracks.map(track => (
                        <button className='catalogue-row' key={track.hash} type='button' onClick={() => selectTrack(track)}>
                          <img className='track-thumb' src={track.imageRef} alt='' />
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
                      <div className='empty-state'>No artist tracks registered</div>
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

function EndpointRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='endpoint-row'>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getInitialRoomCode() {
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(hashQuery).get('room')?.toUpperCase() ?? '';
}

function getSessionLink(roomId: string) {
  if (!roomId) return '';
  const url = new URL(window.location.href);
  url.hash = `/?room=${roomId}`;
  return url.toString();
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
    artistContractRef: track.artistContractRef,
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

function createReferencedAsset(kind: IpfsAssetMetadata['kind'], uri: string, contentHash: `0x${string}`, name: string): IpfsAssetMetadata {
  const cid = uri.startsWith('ipfs://') ? uri.replace(/^ipfs:\/\//, '') : `inline-${kind}-${contentHash.slice(2, 14)}`;
  return {
    kind,
    cid,
    uri,
    gatewayUrl: uri,
    name,
    mimeType: kind === 'artist-contract' ? 'application/pdf' : 'application/octet-stream',
    size: 0,
    contentHash,
    uploadMode: 'staged'
  };
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
