import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { createRoomJoinE2eCaptureStream, isRoomJoinE2e, roomJoinE2eIceServers } from '../e2e/roomJoinMock';
import { buildSessionLink, getInitialRoomCode } from '../features/rooms/roomState';
import { storeDisplayName } from '../features/identity/walletIdentity';
import { nextCaptureAttempt, shouldReuseCapture, type CaptureAttempt } from '../features/rooms/streamCapture';
import { CHAT_CLIENT_LIMIT, CHAT_TEXT_MAX_LENGTH, REQUEST_QUEUE_CLIENT_LIMIT, REQUEST_TEXT_MAX_LENGTH } from '../shared/social';
import { normalizeRoomCode, normalizeRooms, peerStatusLabel, getPeerStatus } from '../shared/utils/format';
import type {
  CapturableMediaElement,
  CreateRoomResponse,
  JoinRoomResponse,
  ListenerRecord,
  Mode,
  OpenRoom,
  PeerStatus,
  PlayerState,
  RoomChatMessage,
  RoomPlaybackMode,
  RoomReactionEvent,
  RoomRequest,
  SessionAction,
  SocketStatus,
  TrackInfo
} from '../shared/types';
import type { FormEvent } from 'react';

// STUN alone fails silently behind symmetric NAT; configure a TURN relay for
// production rooms so "share a link, listen together" survives hostile networks.
const TURN_URL = import.meta.env.VITE_TURN_URL as string | undefined;
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME as string | undefined;
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

// E2E room-join runs loopback-only ICE (no public STUN) so two browser contexts
// in the same headless Chromium connect deterministically without internet.
const iceServers: RTCIceServer[] = isRoomJoinE2e
  ? roomJoinE2eIceServers()
  : [
      { urls: 'stun:stun.l.google.com:19302' },
      ...(TURN_URL ? [{ urls: TURN_URL, username: TURN_USERNAME, credential: TURN_CREDENTIAL } satisfies RTCIceServer] : [])
    ];

// Hosts must show liveness to the signaling server; rooms with silent hosts
// are swept server-side to avoid zombie rooms.
const HOST_HEARTBEAT_INTERVAL_MS = 25_000;
const SIGNAL_ACK_TIMEOUT_MS = 8_000;

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
  // Optional wallet address of the host, surfaced in public room metadata.
  // Never used for listener access: rooms are host-access based.
  hostAddress?: string | null;
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
  const { signalUrl, hostAddress, setTrackInfo, setPlayerState, localAudioRef, objectUrlsRef, resolvedAudioSourcesRef, navigateToView, setAudioSource } = deps;

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
  // Host-declared playback mode for the room: 'preview' when the host lacks
  // access to the current protected track and streams the 42% fallback.
  const [roomPlaybackMode, setRoomPlaybackMode] = useState<'full' | 'preview'>('full');
  // Room social layer. Chat mirrors the server's capped in-room history;
  // the reaction feed keeps a short sliding window that the player view
  // turns into rising petals.
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [reactionFeed, setReactionFeed] = useState<RoomReactionEvent[]>([]);
  // Collaborative request queue: server-authoritative full-list broadcast,
  // so the client only ever mirrors what the room actually holds.
  const [requestQueue, setRequestQueue] = useState<RoomRequest[]>([]);

  const roomIdRef = useRef('');
  const hostIdRef = useRef('');
  const modeRef = useRef<Mode>(mode);
  const listenersRef = useRef<ListenerRecord[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const listenerPeerRef = useRef<RTCPeerConnection | null>(null);
  const hostPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  // Which audioSource the current local stream was captured from. Capturing is
  // idempotent per source: we only (re)capture and renegotiate when the source
  // actually changes (track skip/next), never on every play/pause/seek, so a
  // live listener is not torn down and rebuilt for no reason.
  const capturedSourceRef = useRef<string | null>(null);
  // Counts consecutive capture attempts that produced no live track for a
  // source, so a genuinely trackless asset (unsupported codec, silent file)
  // surfaces a failure instead of retrying forever on every play event.
  const captureAttemptRef = useRef<CaptureAttempt>({ source: null, count: 0 });
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
    pendingIceCandidatesRef.current.clear();
    const remoteAudio = remoteAudioRef.current;
    if (remoteAudio) {
      remoteAudio.pause();
      remoteAudio.srcObject = null;
    }
    setRemoteReady(false);
  }

  function closeHostPeers() {
    for (const peer of hostPeersRef.current.values()) {
      peer.close();
    }
    hostPeersRef.current.clear();
    pendingIceCandidatesRef.current.clear();
  }

  function closeAllPeers() {
    closeHostPeers();
    closeListenerPeer();
    localStreamRef.current = null;
    capturedSourceRef.current = null;
    captureAttemptRef.current = { source: null, count: 0 };
    setLocalStreamReady(false);
  }

  function clearRoomState(status: string, errorMessage: string | null, options: { closePeers?: boolean } = {}) {
    if (options.closePeers !== false) {
      closeAllPeers();
    }
    roomIdRef.current = '';
    hostIdRef.current = '';
    setRoomId('');
    setHostName('');
    setListeners([]);
    listenersRef.current = [];
    setListenerCount(0);
    setRoomPlaybackMode('full');
    setChatMessages([]);
    setReactionFeed([]);
    setRequestQueue([]);
    setRemoteReady(false);
    setSessionAction('idle');
    setSessionStatus(status);
    setError(errorMessage);
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

      // A listener whose socket dropped mid-session rejoins the same room
      // automatically (the server sees a fresh socket id, so a clean re-join
      // is the correct recovery; the host then re-offers WebRTC).
      if (modeRef.current === 'listener' && roomIdRef.current) {
        setSessionStatus('Reconnecting');
        rejoinRoom(roomIdRef.current);
      }
    });
    socket.on('connect_error', () => {
      setSocketStatus('error');
      setSessionAction('idle');
      setIsRefreshingRooms(false);
      setError(`Signal server unavailable: ${signalUrl}`);
    });
    socket.on('disconnect', () => {
      setSocketStatus('offline');
      if (modeRef.current === 'host' && roomIdRef.current) {
        clearRoomState('Room closed', 'Signal disconnected. The hosted room was closed.');
        return;
      }
      if (roomIdRef.current) {
        setSessionStatus('Reconnecting');
      }
    });
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
    socket.on('listener:ready', (payload: { listenerId: string; displayName: string; listenerCount: number }) => {
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
    socket.on('room:playback-mode', (payload: { playbackMode?: 'full' | 'preview' }) => {
      const playbackMode = payload?.playbackMode === 'preview' ? 'preview' : 'full';
      setRoomPlaybackMode(playbackMode);
      if (modeRef.current === 'listener') {
        setSessionStatus(playbackMode === 'preview' ? 'Host preview mode' : 'Live');
      }
    });
    socket.on('room:closed', (payload: { reason?: string }) => {
      // The room is gone (host left, expired, or timed out): forget it so the
      // reconnect logic does not try to rejoin a dead room.
      clearRoomState(payload.reason ?? 'Room closed', payload.reason ?? 'Room closed');
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

    // Social layer: the server is the source of truth (it sanitizes,
    // rate-limits, and buffers); the client only mirrors what it relays.
    socket.on('room:chat', (message: RoomChatMessage) => {
      if (!message || typeof message.text !== 'string' || typeof message.id !== 'string') return;
      setChatMessages(previous => [...previous, message].slice(-CHAT_CLIENT_LIMIT));
    });
    socket.on('room:reaction', (reaction: RoomReactionEvent) => {
      if (!reaction || typeof reaction.emoji !== 'string' || typeof reaction.id !== 'string') return;
      setReactionFeed(previous => [...previous.slice(-19), reaction]);
    });
    socket.on('room:requests', (requests: RoomRequest[]) => {
      // Full-list broadcast: guard each item's shape before accepting, matching
      // the per-message validation the chat handler above uses.
      const valid = Array.isArray(requests) ? requests.filter(request => request && typeof request.id === 'string' && typeof request.text === 'string') : [];
      setRequestQueue(valid.slice(-REQUEST_QUEUE_CLIENT_LIMIT));
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

  function emitAckWhenConnected<Response>(event: string, payload: unknown, onAck: (response: Response) => void, onFailure: () => void) {
    const socket = connectSocket();
    let settled = false;
    let timeoutId = 0;

    function cleanup() {
      socket.off('connect', send);
      socket.off('connect_error', fail);
      if (timeoutId) window.clearTimeout(timeoutId);
    }

    function fail() {
      if (settled) return;
      settled = true;
      cleanup();
      onFailure();
    }

    function send() {
      if (settled) return;
      settled = true;
      cleanup();
      socket.timeout(SIGNAL_ACK_TIMEOUT_MS).emit(event, payload, (error: Error | null, response: Response | undefined) => {
        if (error || response === undefined) {
          onFailure();
          return;
        }
        onAck(response);
      });
    }

    timeoutId = window.setTimeout(fail, SIGNAL_ACK_TIMEOUT_MS);
    if (socket.connected) {
      send();
    } else {
      socket.once('connect', send);
      socket.once('connect_error', fail);
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
    // E2E: stream a synthetic near-silent track instead of capturing the local
    // element, so the host always has a transmittable audio track in CI.
    if (isRoomJoinE2e) return createRoomJoinE2eCaptureStream();
    const capturable = audio as CapturableMediaElement;
    const stream = capturable.captureStream?.() ?? capturable.mozCaptureStream?.();
    if (!stream) throw new Error('captureStream() is not supported by this browser.');
    // Do NOT throw when there is no audio track yet: capture can legitimately
    // run before the element starts producing audio (e.g. at loadedmetadata,
    // before play). The caller checks for a live track and retries on play,
    // rather than failing the whole room with "no audio track".
    return stream;
  }

  function streamHasLiveAudio(stream: MediaStream | null): boolean {
    return Boolean(stream && stream.getAudioTracks().some(track => track.readyState === 'live'));
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

      // Already streaming this exact source with a live track? Do nothing.
      // This is what makes play/pause/seek cheap: they re-trigger this path but
      // must not rebuild every listener peer. Only a real source change
      // (skip/next/loop-into-new-track) falls through to re-capture.
      if (shouldReuseCapture(capturedSourceRef.current, currentAudioSource, streamHasLiveAudio(localStreamRef.current))) {
        return;
      }

      const stream = captureAudioStream(audio);
      if (!streamHasLiveAudio(stream)) {
        // No live track yet. This is normal for the first attempt (captured at
        // loadedmetadata, before playback), so we keep the old stream and let
        // onPlay retry. But a source that never yields a track (unsupported
        // codec, genuinely silent asset) would retry forever; after a few
        // attempts, surface the failure instead of leaving a silent player.
        const { attempt, exhausted } = nextCaptureAttempt(captureAttemptRef.current, currentAudioSource);
        captureAttemptRef.current = attempt;
        if (exhausted) {
          setError('Audio capture is unavailable for this track in this browser.');
          setSessionStatus('Capture unavailable');
        }
        return;
      }
      // A live track appeared: clear the trackless-attempt counter.
      captureAttemptRef.current = { source: null, count: 0 };

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
      capturedSourceRef.current = currentAudioSource;
      setLocalStreamReady(true);
      setTrackInfo(track);
      setSessionStatus(roomIdRef.current ? 'Live' : 'Audio ready');
      socketRef.current?.emit('room:track', track);

      // Re-offer every listener with the new stream. On a track change this is a
      // full renegotiation (new MediaStream), which is how the room hears the
      // new track; existing listeners transition through a brief reconnect.
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
    pendingIceCandidatesRef.current.delete(listenerId);
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
        // Playback is triggered by usePlayback which correctly surfaces
        // 'autoplay-blocked' to the UI when the browser policy blocks autoplay.
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
      await flushRemoteCandidates(from, peer);
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
      await flushRemoteCandidates(from, peer);
    } catch (answerError) {
      upsertListenerStatus(from, 'disconnected');
      setError(answerError instanceof Error ? answerError.message : 'Invalid WebRTC answer');
    }
  }

  function queueRemoteCandidate(from: string, candidate: RTCIceCandidateInit) {
    const pending = pendingIceCandidatesRef.current.get(from) ?? [];
    pending.push(candidate);
    pendingIceCandidatesRef.current.set(from, pending);
  }

  async function flushRemoteCandidates(from: string, peer: RTCPeerConnection) {
    const pending = pendingIceCandidatesRef.current.get(from);
    if (!pending?.length) return;

    pendingIceCandidatesRef.current.delete(from);
    for (const candidate of pending) {
      try {
        await peer.addIceCandidate(candidate);
      } catch (candidateError) {
        console.warn('ICE candidate rejected', candidateError);
      }
    }
  }

  async function addRemoteCandidate(from: string, candidate: RTCIceCandidateInit) {
    if (!candidate) return;
    const peer = modeRef.current === 'host' ? hostPeersRef.current.get(from) : listenerPeerRef.current;
    if (!peer || !peer.remoteDescription) {
      queueRemoteCandidate(from, candidate);
      return;
    }

    try {
      await peer.addIceCandidate(candidate);
    } catch (candidateError) {
      console.warn('ICE candidate rejected', candidateError);
    }
  }

  function createSession(currentTrackInfo: TrackInfo | null, playbackMode: RoomPlaybackMode = 'full', event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    // Persist the chosen name on submit (not on every keystroke): storeDisplayName
    // no-ops for the untouched default, so a connected host is remembered without
    // recording a partial name typed into the create sheet.
    storeDisplayName(hostAddress, displayName);
    setSessionAction('creating');
    changeMode('host');
    navigateToView('player');
    setError(null);
    setSessionStatus('Opening room');
    closeListenerPeer();

    emitAckWhenConnected<CreateRoomResponse>(
      'room:create',
      { displayName, track: currentTrackInfo, hostAddress: hostAddress ?? null, playbackMode },
      (response: CreateRoomResponse) => {
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
        setRoomPlaybackMode(playbackMode);
        setChatMessages([]);
        setReactionFeed([]);
        setRequestQueue([]);
        setSessionStatus(localStreamRef.current ? 'Live' : 'Room open');
        requestOpenRooms();
      },
      () => {
        clearRoomState('Error', 'Signal server did not confirm room creation.', { closePeers: false });
      }
    );
  }

  function joinRoom(roomCode: string) {
    const normalizedRoomId = normalizeRoomCode(roomCode);
    if (!normalizedRoomId) {
      setError('Room code required');
      return;
    }

    // Persist the chosen name on a real join (not on every keystroke). No-ops
    // for the untouched default, so link/QR guests joining as "Listener" are
    // not recorded. A silent reconnect goes through rejoinRoom, not here.
    storeDisplayName(hostAddress, displayName);
    changeMode('listener');
    setSessionAction('joining');
    navigateToView('player');
    setError(null);
    setSessionStatus('Joining room');
    closeHostPeers();

    emitAckWhenConnected<JoinRoomResponse>(
      'room:join',
      { roomId: normalizedRoomId, displayName },
      (response: JoinRoomResponse) => {
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
        setRoomPlaybackMode(response.playbackMode === 'preview' ? 'preview' : 'full');
        setChatMessages(response.chatHistory ?? []);
        setRequestQueue(response.requests ?? []);
        setSessionStatus(response.track ? 'Waiting stream' : 'Connected');
        requestOpenRooms();
      },
      () => {
        clearRoomState('Error', 'Signal server did not confirm room join.', { closePeers: false });
      }
    );
  }

  // Silent re-join after a socket reconnect: same room, fresh socket id.
  // The host receives listener:joined and re-offers WebRTC.
  function rejoinRoom(targetRoomId: string) {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('room:join', { roomId: targetRoomId, displayName }, (response: JoinRoomResponse) => {
      if (!response.ok) {
        clearRoomState('Room closed', response.error);
        return;
      }

      roomIdRef.current = response.roomId;
      hostIdRef.current = response.hostId;
      setHostName(response.hostName);
      setTrackInfo(response.track);
      setPlayerState(response.playerState);
      setListenerCount(response.listenerCount);
      setRoomPlaybackMode(response.playbackMode === 'preview' ? 'preview' : 'full');
      setChatMessages(response.chatHistory ?? []);
      setRequestQueue(response.requests ?? []);
      setSessionStatus(response.track ? 'Waiting stream' : 'Connected');
    });
  }

  function joinSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    joinRoom(joinCode);
  }

  function requestRoomAudio() {
    if (modeRef.current !== 'listener' || !roomIdRef.current) return;

    pendingIceCandidatesRef.current.clear();
    closeListenerPeer();
    setError(null);
    setSessionStatus('Connecting audio');
    connectSocket().emit('listener:ready');
  }

  function leaveSession() {
    socketRef.current?.emit('room:leave');
    clearRoomState('Ready', null);
    requestOpenRooms();
  }

  // Host heartbeat: proves liveness to the signaling server so the room is
  // not swept as a zombie. Only active while hosting an open room.
  useEffect(() => {
    if (mode !== 'host' || !roomId) return;

    const timer = setInterval(() => {
      socketRef.current?.emit('host:heartbeat');
    }, HOST_HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [mode, roomId]);

  async function copySessionLink() {
    const link = buildSessionLink(roomId);
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

  // Social layer sends. The server validates, rate-limits, and echoes back to
  // the whole room (sender included), so local state only updates on receipt:
  // one render path, no optimistic divergence.
  function sendChatMessage(text: string) {
    if (!roomIdRef.current) return;
    const trimmed = text.trim().slice(0, CHAT_TEXT_MAX_LENGTH);
    if (!trimmed) return;
    socketRef.current?.emit('room:chat', { text: trimmed });
  }

  function sendRoomReaction(emoji: string) {
    if (!roomIdRef.current) return;
    socketRef.current?.emit('room:reaction', { emoji });
  }

  // Collaborative request queue. Any participant proposes; the server appends,
  // caps, and rebroadcasts the full list. Host-only veto/clear are ignored by
  // the server for non-hosts, so we do not gate them here beyond the room
  // guard -- the server is the authority.
  function sendRoomRequest(text: string) {
    if (!roomIdRef.current) return;
    const trimmed = text.trim().slice(0, REQUEST_TEXT_MAX_LENGTH);
    if (!trimmed) return;
    socketRef.current?.emit('room:request', { text: trimmed });
  }

  function removeRoomRequest(id: string) {
    if (!roomIdRef.current || !id) return;
    socketRef.current?.emit('room:request:remove', { id });
  }

  function clearRoomRequests() {
    if (!roomIdRef.current) return;
    socketRef.current?.emit('room:request:clear');
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
    roomPlaybackMode,
    chatMessages,
    reactionFeed,
    requestQueue,
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
    requestRoomAudio,
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
    sendChatMessage,
    sendRoomReaction,
    sendRoomRequest,
    removeRoomRequest,
    clearRoomRequests,
    destroySession,
    sessionLink: buildSessionLink(roomId)
  };
}
