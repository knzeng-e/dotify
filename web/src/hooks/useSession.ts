import { useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { normalizeRoomCode, normalizeRooms, peerStatusLabel, getPeerStatus } from '../utils/format';
import type {
  CapturableMediaElement,
  CreateRoomResponse,
  JoinRoomResponse,
  ListenerRecord,
  Mode,
  OpenRoom,
  PeerStatus,
  PlayerState,
  SessionAction,
  SocketStatus,
  TrackInfo
} from '../types';
import type { FormEvent } from 'react';

// STUN alone fails silently behind symmetric NAT; configure a TURN relay for
// production rooms so "share a link, listen together" survives hostile networks.
const TURN_URL = import.meta.env.VITE_TURN_URL as string | undefined;
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME as string | undefined;
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

const iceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  ...(TURN_URL ? [{ urls: TURN_URL, username: TURN_USERNAME, credential: TURN_CREDENTIAL } satisfies RTCIceServer] : [])
];

function getSessionLink(roomId: string) {
  if (!roomId) return '';
  const url = new URL(window.location.href);
  url.hash = `/?room=${roomId}`;
  return url.toString();
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

export type UseSessionDeps = {
  signalUrl: string;
  audioSource: string | null;
  trackInfo: TrackInfo | null;
  setTrackInfo: (info: TrackInfo | null) => void;
  setPlayerState: (state: PlayerState | null) => void;
  localAudioRef: React.RefObject<HTMLAudioElement | null>;
  objectUrlsRef: React.RefObject<Set<string>>;
  resolvedAudioSourcesRef: React.RefObject<Map<string, string>>;
  navigateToView: (view: 'listen' | 'player' | 'rooms') => void;
  setAudioSource: (source: string | null) => void;
};

export function useSession(deps: UseSessionDeps) {
  const {
    signalUrl,
    setTrackInfo,
    setPlayerState,
    localAudioRef,
    objectUrlsRef,
    resolvedAudioSourcesRef,
    navigateToView,
    setAudioSource
  } = deps;

  const [roomId, setRoomId] = useState('');
  const [hostName, setHostName] = useState('');
  const [listeners, setListeners] = useState<ListenerRecord[]>([]);
  const [listenerCount, setListenerCount] = useState(0);
  const [sessionStatus, setSessionStatus] = useState('Ready');
  const [sessionAction, setSessionAction] = useState<SessionAction>('idle');
  const [mode, setMode] = useState<Mode>(() => (getInitialRoomCode() ? 'listener' : 'host'));
  const [remoteReady, setRemoteReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRooms, setOpenRooms] = useState<OpenRoom[]>([]);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('offline');
  const [joinCode, setJoinCode] = useState(() => getInitialRoomCode());
  const [displayName, setDisplayName] = useState('Listener');
  const [localStreamReady, setLocalStreamReady] = useState(false);
  const [isRefreshingRooms, setIsRefreshingRooms] = useState(false);

  const roomIdRef = useRef('');
  const hostIdRef = useRef('');
  const modeRef = useRef<Mode>(mode);
  const listenersRef = useRef<ListenerRecord[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const listenerPeerRef = useRef<RTCPeerConnection | null>(null);
  const hostPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayerStateEmitRef = useRef(0);

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

  function closeListenerPeer() {
    listenerPeerRef.current?.close();
    listenerPeerRef.current = null;
  }

  function closeHostPeers() {
    for (const peer of hostPeersRef.current.values()) {
      peer.close();
    }
    hostPeersRef.current.clear();
  }

  function closeAllPeers() {
    closeHostPeers();
    closeListenerPeer();
    localStreamRef.current = null;
    setLocalStreamReady(false);
  }

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

    const cachedSource = resolvedAudioSourcesRef.current?.get(source);
    if (cachedSource) {
      return cachedSource;
    }

    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Unable to load audio source (${response.status})`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    objectUrlsRef.current?.add(objectUrl);
    resolvedAudioSourcesRef.current?.set(source, objectUrl);
    return objectUrl;
  }

  async function prepareLocalStream(currentAudioSource: string | null, currentTrackInfo: TrackInfo | null) {
    const audio = localAudioRef.current;
    if (!audio || !currentAudioSource) return;

    try {
      const capturableSource = await ensureCapturableAudioSource(currentAudioSource);
      if (capturableSource !== currentAudioSource) {
        setSessionStatus('Preparing source');
        setAudioSource(capturableSource);
        return;
      }

      const stream = captureAudioStream(audio);
      const track: TrackInfo = {
        ...(currentTrackInfo ?? {
          title: 'Untitled',
          artist: 'Unknown artist',
          hash: '',
          bulletinRef: '',
          duration: 0,
          updatedAt: Date.now()
        }),
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        updatedAt: Date.now()
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

    const timestamp = Date.now();
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

  function createSession(currentTrackInfo: TrackInfo | null, event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setSessionAction('creating');
    changeMode('host');
    navigateToView('player');
    setError(null);
    setSessionStatus('Opening room');
    closeListenerPeer();

    const socket = connectSocket();
    socket.emit('room:create', { displayName, track: currentTrackInfo }, (response: CreateRoomResponse) => {
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

  function joinSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    joinRoom(joinCode);
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

  async function copySessionLink() {
    const link = getSessionLink(roomId);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setSessionStatus('Link copied');
    } catch {
      setSessionStatus('Copy unavailable');
    }
  }

  function socketEmit(event: string, data: unknown) {
    socketRef.current?.emit(event, data);
  }

  function destroySession() {
    socketRef.current?.emit('room:leave');
    socketRef.current?.disconnect();
    for (const peer of hostPeersRef.current.values()) {
      peer.close();
    }
    listenerPeerRef.current?.close();
    localStreamRef.current = null;
  }

  return {
    // State
    roomId,
    hostName,
    listeners,
    listenerCount,
    sessionStatus,
    setSessionStatus,
    sessionAction,
    mode,
    remoteReady,
    error,
    setError,
    openRooms,
    socketStatus,
    joinCode,
    setJoinCode,
    displayName,
    setDisplayName,
    localStreamReady,
    setLocalStreamReady,
    isRefreshingRooms,
    // Refs
    roomIdRef,
    hostIdRef,
    modeRef,
    listenersRef,
    socketRef,
    listenerPeerRef,
    hostPeersRef,
    localStreamRef,
    remoteAudioRef,
    lastPlayerStateEmitRef,
    // Functions
    connectSocket,
    getSocket,
    requestOpenRooms,
    createSession,
    joinRoom,
    joinSession,
    leaveSession,
    createHostPeer,
    createOfferForListener,
    acceptOffer,
    acceptAnswer,
    addRemoteCandidate,
    captureAudioStream,
    ensureCapturableAudioSource,
    prepareLocalStream,
    emitPlayerState,
    copySessionLink,
    closeAllPeers,
    closeHostPeers,
    closeListenerPeer,
    changeMode,
    upsertListener,
    upsertListenerStatus,
    removeListener,
    socketEmit,
    destroySession,
    sessionLink: getSessionLink(roomId)
  };
}

export function getInitialRoomCode() {
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(hashQuery).get('room')?.toUpperCase() ?? '';
}
