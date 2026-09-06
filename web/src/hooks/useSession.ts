import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  createRoomJoinE2eCaptureStream,
  isRoomJoinE2e,
  recordRoomJoinE2eOffer,
  recordRoomJoinE2eRemotePlaybackCue,
  recordRoomJoinE2eReplaceTrack,
  recordRoomJoinE2eStreamReadySignal,
  recordRoomJoinE2eWebAudioCapture,
  recordRoomJoinE2eWebAudioMonitorGain,
  roomJoinE2eOfferDelayMs,
  roomJoinE2eOfferSnapshot,
  shouldUseRoomJoinE2eSyntheticCapture,
  roomJoinE2eIceServers
} from '../e2e/roomJoinMock';
import { buildSessionLink, getInitialRoomCode } from '../features/rooms/roomState';
import {
  publishRoomQualityMetric,
  summarizeRoomPeerStats,
  type RoomQualityMetric,
  type RoomQualityPhase,
  type RoomQualityRole
} from '../features/rooms/roomQualityTelemetry';
import { createSignalClient, describeSignalConnectError } from '../features/rooms/signalClient';
import { diagnoseSignalFailure } from '../features/rooms/signalDiagnostics';
import { ensureProductHostRoomPermissions, isProductHostWebRtcUnavailable, openProductHostExternalUrl } from '../features/productHost/productHost';
import { useRoomBeacon } from './useRoomBeacon';
import { isChosenDisplayName, sanitizeDisplayName, storeDisplayName } from '../features/identity/walletIdentity';
import { nextCaptureAttempt, shouldReuseCapture, type CaptureAttempt } from '../features/rooms/streamCapture';
import { CHAT_CLIENT_LIMIT, CHAT_TEXT_MAX_LENGTH, REQUEST_QUEUE_CLIENT_LIMIT, REQUEST_TEXT_MAX_LENGTH } from '../shared/social';
import { normalizeRoomCode, normalizeRooms, peerStatusLabel, getPeerStatus } from '../shared/utils/format';
import { getTurnIceServers, hasTurnIceServer } from '../services/turn';
import type {
  CapturableMediaElement,
  CreateRoomResponse,
  JoinRoomResponse,
  ListenerRecord,
  Mode,
  OpenRoom,
  PeerStatus,
  PlayerState,
  ResumeRoomResponse,
  RoomPresenceListener,
  RoomChatMessage,
  RoomPlaybackMode,
  RoomReactionEvent,
  RoomRequest,
  SessionAction,
  SoloListeningByTrackHash,
  SocketStatus,
  TrackInfo
} from '../shared/types';
import type { FormEvent } from 'react';

// E2E room-join runs loopback-only ICE (no public STUN) so two browser contexts
// in the same headless Chromium connect deterministically without internet.
const stunIceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

// Hosts must show liveness to the signaling server; rooms with silent hosts
// are swept server-side to avoid zombie rooms.
const HOST_HEARTBEAT_INTERVAL_MS = 25_000;
const SIGNAL_ACK_TIMEOUT_MS = 8_000;
const WEBRTC_CONNECTION_TIMEOUT_MS = 10_000;
const WEBRTC_AUTOMATIC_RETRIES = 1;
const dotifyApiUrl = (import.meta.env.VITE_DOTIFY_API_URL as string | undefined)?.trim();

type AudioContextWindow = Window & { webkitAudioContext?: typeof AudioContext };

type WebAudioElementCapture = {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  destination: MediaStreamAudioDestinationNode;
  monitorGain: GainNode;
  stream: MediaStream;
};

type PlaceholderAudioStream = {
  context: AudioContext;
  oscillator: OscillatorNode;
  stream: MediaStream;
};

type CreateSessionOptions = {
  audioSourceHint?: string | null;
};

type WebRtcDiagnosticDetails = {
  errorCode?: number;
  peer?: RTCPeerConnection | null;
};

const webAudioElementCaptures = new WeakMap<HTMLMediaElement, WebAudioElementCapture>();

function syncWebAudioMonitorGain(audio: HTMLMediaElement, capture: WebAudioElementCapture) {
  const gain = audio.muted ? 0 : audio.volume;
  capture.monitorGain.gain.value = Number.isFinite(gain) ? gain : 1;
  if (isRoomJoinE2e) recordRoomJoinE2eWebAudioMonitorGain(capture.monitorGain.gain.value);
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

function hasAudioMediaSection(description: RTCSessionDescriptionInit | null): boolean {
  return Boolean(description?.sdp && /(?:^|\r?\n)m=audio\s/i.test(description.sdp));
}

function hasIceCandidate(description: RTCSessionDescriptionInit | null): boolean {
  return Boolean(description?.sdp && /(?:^|\r?\n)a=candidate:/i.test(description.sdp));
}

function webRtcConnectionFailureMessage(turnRelayAvailable: boolean) {
  if (!turnRelayAvailable) {
    return 'Live audio could not cross the host and listener networks. This deployment needs a TURN relay for reliable mobile rooms.';
  }
  return 'Live audio negotiation timed out. Retry audio; if it still fails, verify the configured TURN relay.';
}

function describeWebRtcError(error: unknown): { errorName: string; message: string } {
  if (error instanceof Error) {
    return { errorName: error.name || 'Error', message: error.message || 'Unknown WebRTC error' };
  }
  return { errorName: 'Error', message: String(error || 'Unknown WebRTC error') };
}

export type UseSessionDeps = {
  signalUrl: string;
  // Canonical externally reachable app URL. Product-host builds use this
  // instead of sharing an internal container/gateway location.
  publicAppUrl?: string | null;
  // Optional local identity key used only to remember a display name on this
  // browser. It never crosses the anonymous room signaling boundary.
  identityAddress?: string | null;
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
    publicAppUrl,
    identityAddress,
    audioSource,
    trackInfo,
    setTrackInfo,
    setPlayerState,
    localAudioRef,
    objectUrlsRef,
    resolvedAudioSourcesRef,
    navigateToView,
    setAudioSource
  } = deps;

  const productHostWebRtcUnavailable = isProductHostWebRtcUnavailable();

  const [roomId, setRoomId] = useState('');
  const [hostName, setHostName] = useState('');
  const [listeners, setListeners] = useState<ListenerRecord[]>([]);
  const [listenerCount, setListenerCount] = useState(0);
  const [sessionStatus, setSessionStatus] = useState('Ready');
  const [sessionAction, setSessionAction] = useState<SessionAction>('idle');
  const [mode, setMode] = useState<Mode>(() => (getInitialRoomCode() ? 'listener' : 'host'));
  const [remoteReady, setRemoteReady] = useState(false);
  const [remoteStreamVersion, setRemoteStreamVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [openRooms, setOpenRooms] = useState<OpenRoom[]>([]);
  const [soloListeningByTrackHash, setSoloListeningByTrackHash] = useState<SoloListeningByTrackHash>({});
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('offline');
  const [joinCode, setJoinCode] = useState(() => getInitialRoomCode());
  const [displayName, setDisplayName] = useState('Listener');
  const [localStreamReady, setLocalStreamReady] = useState(false);
  const [isRefreshingRooms, setIsRefreshingRooms] = useState(false);
  // `preview` is retained only for backward-compatible signaling payloads.
  // Access model v2 creates and updates current rooms in `full` mode; a host
  // without access sends no protected audio.
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
  const hostResumeTokenRef = useRef('');
  const modeRef = useRef<Mode>(mode);
  const listenersRef = useRef<ListenerRecord[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const soloTrackHashRef = useRef<string | null>(null);
  const listenerPeerRef = useRef<RTCPeerConnection | null>(null);
  const hostPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const listenerConnectionTimerRef = useRef<number | null>(null);
  const hostConnectionTimersRef = useRef<Map<string, number>>(new Map());
  const listenerOfferReceivedRef = useRef(false);
  const listenerAudioRetryCountRef = useRef(0);
  const hostRoomStartedAtRef = useRef<number | null>(null);
  const hostPeerStartedAtRef = useRef<Map<string, number>>(new Map());
  const listenerJoinStartedAtRef = useRef<number | null>(null);
  const listenerConnectionStartedAtRef = useRef<number | null>(null);
  const turnRelayAvailableRef = useRef(false);
  const roomPermissionRef = useRef<Promise<boolean> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const placeholderAudioStreamRef = useRef<PlaceholderAudioStream | null>(null);
  const audioSourceRef = useRef<string | null>(audioSource);
  const trackInfoRef = useRef<TrackInfo | null>(trackInfo);
  // Which audioSource the current local stream was captured from. Capturing is
  // idempotent per source: source changes renegotiate listeners onto a fresh
  // receiver, while same-source play/pause/seek refreshes can stay on
  // replaceTrack so a live listener is not rebuilt for every transport event.
  const capturedSourceRef = useRef<string | null>(null);
  const captureStartedPausedRef = useRef(false);
  // Counts consecutive capture attempts that produced no live track for a
  // source, so a genuinely trackless asset (unsupported codec, silent file)
  // surfaces a failure instead of retrying forever on every play event.
  const captureAttemptRef = useRef<CaptureAttempt>({ source: null, count: 0 });
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayerStateEmitRef = useRef(0);

  useEffect(() => {
    audioSourceRef.current = audioSource;
    trackInfoRef.current = trackInfo;
  }, [audioSource, trackInfo]);

  function monotonicNow() {
    return typeof performance === 'undefined' ? Date.now() : performance.now();
  }

  function elapsedSince(startedAt: number | null) {
    return startedAt === null ? undefined : Math.max(0, Math.round(monotonicNow() - startedAt));
  }

  function socketTransportName() {
    return (socketRef.current?.io.engine.transport as { name?: string } | undefined)?.name;
  }

  function publishRoomQuality(phase: RoomQualityPhase, role: RoomQualityRole, details: Partial<Omit<RoomQualityMetric, 'phase' | 'role' | 'timestamp'>> = {}) {
    publishRoomQualityMetric({
      phase,
      role,
      timestamp: Date.now(),
      roomId: roomIdRef.current || undefined,
      socketTransport: socketTransportName(),
      ...details
    });
  }

  async function publishPeerRoomQuality(
    phase: RoomQualityPhase,
    role: RoomQualityRole,
    peer: RTCPeerConnection | null,
    details: Partial<Omit<RoomQualityMetric, 'phase' | 'role' | 'timestamp' | 'stats'>> = {}
  ) {
    let stats: RoomQualityMetric['stats'];
    try {
      stats = peer && peer.connectionState !== 'closed' ? summarizeRoomPeerStats(await peer.getStats(), role) : undefined;
    } catch {
      stats = undefined;
    }
    publishRoomQuality(phase, role, {
      connectionState: peer?.connectionState,
      iceConnectionState: peer?.iceConnectionState,
      stats,
      ...details
    });
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

  async function resolveRoomIceServers(): Promise<RTCIceServer[]> {
    if (isRoomJoinE2e) {
      const iceServers = roomJoinE2eIceServers();
      turnRelayAvailableRef.current = false;
      publishRoomQuality('ice-servers-resolved', modeRef.current, {
        turnRelayAvailable: false,
        iceServerCount: iceServers.length
      });
      return iceServers;
    }

    const turnServers = await getTurnIceServers();
    const iceServers = [...stunIceServers, ...turnServers];
    turnRelayAvailableRef.current = hasTurnIceServer(iceServers);
    publishRoomQuality('ice-servers-resolved', modeRef.current, {
      turnRelayAvailable: turnRelayAvailableRef.current,
      iceServerCount: iceServers.length
    });
    return iceServers;
  }

  function emitWebRtcDiagnostic(phase: string, error?: unknown, details: WebRtcDiagnosticDetails = {}) {
    const described = error === undefined ? { errorName: '', message: '' } : describeWebRtcError(error);
    const peer = details.peer;
    socketRef.current?.emit('webrtc:diagnostic', {
      phase,
      errorName: described.errorName,
      message: described.message,
      errorCode: details.errorCode,
      peerConnectionAvailable: typeof window.RTCPeerConnection === 'function',
      turnRelayAvailable: turnRelayAvailableRef.current,
      protocol: window.location.protocol,
      embedded: window.self !== window.top,
      connectionState: peer?.connectionState,
      iceConnectionState: peer?.iceConnectionState,
      iceGatheringState: peer?.iceGatheringState,
      signalingState: peer?.signalingState
    });
  }

  function createRoomPeerConnection(iceServers: RTCIceServer[]) {
    if (typeof window.RTCPeerConnection !== 'function') {
      throw new Error('This Polkadot Mobile build blocks Product WebRTC. Continue this room in the browser to hear live audio.');
    }
    return new window.RTCPeerConnection({ iceServers, iceCandidatePoolSize: 4 });
  }

  async function openRoomInBrowser() {
    if (!publicAppUrl) {
      setError('Dotify cannot open the browser because VITE_PUBLIC_APP_URL is not configured.');
      return;
    }

    const targetUrl = roomIdRef.current ? buildSessionLink(roomIdRef.current, publicAppUrl) : new URL(publicAppUrl).toString();
    try {
      const result = await openProductHostExternalUrl(targetUrl);
      if (!result.ok) {
        setError(result.reason);
      }
    } catch (navigationError) {
      setError(`The Polkadot host could not open the browser: ${describeWebRtcError(navigationError).message}`);
    }
  }

  function applyListenerRoster(roster: RoomPresenceListener[]) {
    setListeners(previous => {
      const previousById = new Map(previous.map(listener => [listener.id, listener]));
      const next = roster.map(listener => {
        const current = previousById.get(listener.id);
        return {
          id: listener.id,
          displayName: listener.displayName,
          status: current?.status ?? (modeRef.current === 'host' && localStreamRef.current ? 'connecting' : 'connected')
        };
      });
      listenersRef.current = next;
      return next;
    });
    setListenerCount(roster.length);
  }

  function clearListenerConnectionTimer() {
    if (listenerConnectionTimerRef.current === null) return;
    window.clearTimeout(listenerConnectionTimerRef.current);
    listenerConnectionTimerRef.current = null;
  }

  function clearHostConnectionTimer(listenerId: string) {
    const timer = hostConnectionTimersRef.current.get(listenerId);
    if (timer !== undefined) window.clearTimeout(timer);
    hostConnectionTimersRef.current.delete(listenerId);
  }

  function clearHostConnectionTimers() {
    for (const timer of hostConnectionTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    hostConnectionTimersRef.current.clear();
  }

  function closeListenerPeer(options: { clearPendingCandidates?: boolean } = {}) {
    clearListenerConnectionTimer();
    listenerPeerRef.current?.close();
    listenerPeerRef.current = null;
    if (options.clearPendingCandidates !== false) {
      pendingIceCandidatesRef.current.clear();
      listenerOfferReceivedRef.current = false;
    }
    const remoteAudio = remoteAudioRef.current;
    if (remoteAudio) {
      remoteAudio.pause();
      remoteAudio.srcObject = null;
    }
    setRemoteReady(false);
    setRemoteStreamVersion(version => version + 1);
  }

  function closeHostPeers() {
    clearHostConnectionTimers();
    for (const peer of hostPeersRef.current.values()) {
      peer.close();
    }
    hostPeersRef.current.clear();
    hostPeerStartedAtRef.current.clear();
    pendingIceCandidatesRef.current.clear();
  }

  function closeAllPeers() {
    closeHostPeers();
    closeListenerPeer();
    closePlaceholderAudioStream();
    localStreamRef.current = null;
    capturedSourceRef.current = null;
    captureStartedPausedRef.current = false;
    captureAttemptRef.current = { source: null, count: 0 };
    listenerAudioRetryCountRef.current = 0;
    hostRoomStartedAtRef.current = null;
    hostPeerStartedAtRef.current.clear();
    listenerJoinStartedAtRef.current = null;
    listenerConnectionStartedAtRef.current = null;
    setLocalStreamReady(false);
  }

  function clearRoomState(status: string, errorMessage: string | null, options: { closePeers?: boolean } = {}) {
    if (options.closePeers !== false) {
      closeAllPeers();
    }
    roomIdRef.current = '';
    hostIdRef.current = '';
    hostResumeTokenRef.current = '';
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
    setRemoteStreamVersion(version => version + 1);
    setSessionAction('idle');
    setSessionStatus(status);
    setError(errorMessage);
  }

  function cueRemotePlayback(status = 'Live') {
    const remoteAudio = remoteAudioRef.current;
    if (!remoteAudio?.srcObject) return;
    setRemoteReady(true);
    setRemoteStreamVersion(version => version + 1);
    setSessionStatus(status);
    if (isRoomJoinE2e) recordRoomJoinE2eRemotePlaybackCue();
    publishRoomQuality('remote-audio-cued', 'listener', {
      elapsedMs: elapsedSince(listenerJoinStartedAtRef.current),
      detail: status
    });
  }

  function getSocket() {
    if (socketRef.current) return socketRef.current;

    const socket = createSignalClient(signalUrl);
    let diagnosisStarted = false;

    socket.on('connect', () => {
      diagnosisStarted = false;
      setSocketStatus('online');
      setError(null);
      socket.emit('rooms:list', (rooms: OpenRoom[]) => setOpenRooms(normalizeRooms(rooms)));
      if (soloTrackHashRef.current && !roomIdRef.current) {
        socket.emit('presence:solo', { trackHash: soloTrackHashRef.current });
      }

      if (modeRef.current === 'host' && roomIdRef.current && hostResumeTokenRef.current) {
        setSessionStatus('Reconnecting room');
        resumeHostedRoom();
        return;
      }

      // A listener whose socket dropped mid-session rejoins the same room
      // automatically (the server sees a fresh socket id, so a clean re-join
      // is the correct recovery; the host then re-offers WebRTC).
      if (modeRef.current === 'listener' && roomIdRef.current) {
        setSessionStatus('Reconnecting');
        rejoinRoom(roomIdRef.current);
      }
    });
    socket.on('connect_error', connectError => {
      setSocketStatus('error');
      setSessionAction('idle');
      setIsRefreshingRooms(false);
      setError('Room service unavailable.');
      console.error('Dotify signaling connection failed', {
        origin: window.location.origin,
        signalUrl,
        reason: describeSignalConnectError(connectError)
      });
      if (diagnosisStarted) return;
      diagnosisStarted = true;
      // Socket.IO cannot tell us why. Ask the server's public /health and
      // upgrade the message in place once it answers; the generic reason above
      // already stands if it does not.
      void diagnoseSignalFailure(signalUrl, window.location.origin).then(reason => {
        if (socketRef.current !== socket || socket.connected) return;
        setError(reason);
      });
    });
    socket.on('disconnect', () => {
      setSocketStatus('offline');
      if (modeRef.current === 'host' && roomIdRef.current) {
        setSessionStatus('Reconnecting room');
        setError('The room connection was interrupted. Reconnecting...');
        publishRoomQuality('host-reconnecting', 'host', { listenerCount: listenersRef.current.length, detail: 'signal-disconnect' });
        closeHostPeers();
        return;
      }
      if (roomIdRef.current) {
        setSessionStatus('Reconnecting');
        publishRoomQuality('peer-disconnected', 'listener', { detail: 'signal-disconnect' });
      }
    });
    socket.on('rooms:updated', (rooms: OpenRoom[]) => setOpenRooms(normalizeRooms(rooms)));
    socket.on('presence:solo:updated', (payload: unknown) => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        setSoloListeningByTrackHash({});
        return;
      }

      const counts: SoloListeningByTrackHash = {};
      for (const [trackHash, count] of Object.entries(payload)) {
        if (!/^0x[0-9a-f]{64}$/.test(trackHash) || !Number.isSafeInteger(count) || Number(count) <= 0) continue;
        counts[trackHash] = Number(count);
      }
      setSoloListeningByTrackHash(counts);
    });

    socket.on('listener:joined', (payload: { listenerId: string; displayName: string; listenerCount: number }) => {
      publishRoomQuality('listener-ready', 'host', {
        peerId: payload.listenerId,
        listenerCount: payload.listenerCount,
        detail: 'joined'
      });
      upsertListener({
        id: payload.listenerId,
        displayName: payload.displayName,
        status: localStreamRef.current ? 'connecting' : 'waiting'
      });
      setListenerCount(payload.listenerCount);
      setSessionStatus(localStreamRef.current ? 'Pairing listener' : 'Room open');
      void pairListenerOrPrepareStream(payload.listenerId);
    });
    socket.on('listener:ready', (payload: { listenerId: string; displayName: string; listenerCount: number }) => {
      publishRoomQuality('listener-ready', 'host', {
        peerId: payload.listenerId,
        listenerCount: payload.listenerCount
      });
      upsertListener({
        id: payload.listenerId,
        displayName: payload.displayName,
        status: localStreamRef.current ? 'connecting' : 'waiting'
      });
      setListenerCount(payload.listenerCount);
      setSessionStatus(localStreamRef.current ? 'Pairing listener' : 'Room open');
      void pairListenerOrPrepareStream(payload.listenerId);
    });
    socket.on('listener:left', (payload: { listenerId: string; listenerCount: number }) => {
      clearHostConnectionTimer(payload.listenerId);
      hostPeersRef.current.get(payload.listenerId)?.close();
      hostPeersRef.current.delete(payload.listenerId);
      removeListener(payload.listenerId);
      setListenerCount(payload.listenerCount);
    });
    socket.on('listener:renamed', (payload: { listenerId: string; displayName: string }) => {
      setListeners(previous => {
        const next = previous.map(listener => (listener.id === payload.listenerId ? { ...listener, displayName: payload.displayName } : listener));
        listenersRef.current = next;
        return next;
      });
    });
    socket.on('room:listeners', (payload: { listenerCount: number; listeners: RoomPresenceListener[] }) => {
      applyListenerRoster(Array.isArray(payload.listeners) ? payload.listeners : []);
      setListenerCount(payload.listenerCount);
    });
    socket.on('host:renamed', (payload: { displayName: string }) => {
      setHostName(payload.displayName);
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
      publishRoomQuality('room-closed', modeRef.current, { detail: payload.reason ?? 'Room closed' });
      clearRoomState(payload.reason ?? 'Room closed', payload.reason ?? 'Room closed');
    });
    socket.on('room:host-connection', (payload: { status?: string }) => {
      if (modeRef.current !== 'listener' || !roomIdRef.current) return;
      if (payload?.status === 'reconnecting') {
        closeListenerPeer({ clearPendingCandidates: false });
        setSessionStatus('Host reconnecting');
        setError('The host connection was interrupted. The room is being restored.');
        publishRoomQuality('host-reconnecting', 'listener');
        return;
      }
      if (payload?.status === 'online') {
        setSessionStatus('Waiting stream');
        setError(null);
        publishRoomQuality('host-online', 'listener');
      }
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
    socket.on('room:stream-ready', () => {
      if (modeRef.current !== 'listener') return;
      publishRoomQuality('stream-ready', 'listener', {
        elapsedMs: elapsedSince(listenerJoinStartedAtRef.current)
      });
      cueRemotePlayback('Live');
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

  function failRoomPermission(message: string) {
    setSocketStatus('error');
    setSessionAction('idle');
    setIsRefreshingRooms(false);
    setSessionStatus('Error');
    setError(message);
  }

  async function ensureRoomTransportReady() {
    if (!roomPermissionRef.current) {
      roomPermissionRef.current = ensureProductHostRoomPermissions(signalUrl, undefined, {
        remoteUrls: dotifyApiUrl ? [dotifyApiUrl] : []
      })
        .then(result => {
          if (result.ok) return true;
          roomPermissionRef.current = null;
          failRoomPermission(result.reason);
          return false;
        })
        .catch(error => {
          roomPermissionRef.current = null;
          const detail = error instanceof Error ? error.message : String(error);
          failRoomPermission(`Room service unavailable. The Polkadot host could not prepare room permissions: ${detail}`);
          return false;
        });
    }

    return roomPermissionRef.current;
  }

  async function connectRoomSocket() {
    if (!(await ensureRoomTransportReady())) return null;
    return connectSocket();
  }

  async function emitAckWhenConnected<Response>(event: string, payload: unknown, onAck: (response: Response) => void, onFailure: () => void) {
    const socket = await connectRoomSocket();
    if (!socket) return;
    const activeSocket = socket;
    let settled = false;
    let timeoutId = 0;

    function cleanup() {
      activeSocket.off('connect', send);
      activeSocket.off('connect_error', fail);
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
      activeSocket.timeout(SIGNAL_ACK_TIMEOUT_MS).emit(event, payload, (error: Error | null, response: Response | undefined) => {
        if (error || response === undefined) {
          onFailure();
          return;
        }
        onAck(response);
      });
    }

    timeoutId = window.setTimeout(fail, SIGNAL_ACK_TIMEOUT_MS);
    if (activeSocket.connected) {
      send();
    } else {
      activeSocket.once('connect', send);
      activeSocket.once('connect_error', fail);
    }

    return activeSocket;
  }

  async function requestOpenRooms(showBusy = false) {
    if (showBusy) {
      setIsRefreshingRooms(true);
    }
    const socket = await connectRoomSocket();
    if (!socket) {
      if (showBusy) {
        setIsRefreshingRooms(false);
      }
      return;
    }
    socket.emit('rooms:list', (rooms: OpenRoom[]) => {
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
    if (isRoomJoinE2e && shouldUseRoomJoinE2eSyntheticCapture()) return createRoomJoinE2eCaptureStream();
    const capturable = audio as CapturableMediaElement;
    const stream = capturable.captureStream?.() ?? capturable.mozCaptureStream?.();
    if (stream) return stream;

    const contextCtor = window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
    if (!contextCtor) {
      throw new Error('This browser cannot host room audio streams. Join as a listener from this device, or host from a browser with WebRTC audio capture.');
    }

    const existing = webAudioElementCaptures.get(audio);
    if (existing) {
      syncWebAudioMonitorGain(audio, existing);
      void existing.context.resume().catch(() => undefined);
      return existing.stream;
    }

    const context = new contextCtor();
    const source = context.createMediaElementSource(audio);
    const destination = context.createMediaStreamDestination();
    const monitorGain = context.createGain();
    source.connect(destination);
    // Once a media element is routed through Web Audio, monitor it locally too.
    // The WebRTC leg is connected before this gain, so host mute only affects
    // the host's local output and never silences room listeners.
    source.connect(monitorGain).connect(context.destination);
    const fallbackCapture = { context, source, destination, monitorGain, stream: destination.stream };
    syncWebAudioMonitorGain(audio, fallbackCapture);
    audio.addEventListener('volumechange', () => syncWebAudioMonitorGain(audio, fallbackCapture));
    webAudioElementCaptures.set(audio, fallbackCapture);
    void context.resume().catch(() => undefined);
    if (isRoomJoinE2e) recordRoomJoinE2eWebAudioCapture();
    // Do NOT throw when there is no audio track yet: capture can legitimately
    // run before the element starts producing audio (e.g. at loadedmetadata,
    // before play). The caller checks for a live track and retries on play,
    // rather than failing the whole room with "no audio track".
    return fallbackCapture.stream;
  }

  function streamHasLiveAudio(stream: MediaStream | null): boolean {
    return Boolean(stream && stream.getAudioTracks().some(track => track.readyState === 'live'));
  }

  function closePlaceholderAudioStream() {
    const placeholder = placeholderAudioStreamRef.current;
    if (!placeholder) return;
    placeholderAudioStreamRef.current = null;
    try {
      placeholder.oscillator.stop();
    } catch {
      // Already stopped.
    }
    for (const track of placeholder.stream.getTracks()) {
      track.stop();
    }
    void placeholder.context.close().catch(() => undefined);
  }

  function createPlaceholderAudioStream(): MediaStream | null {
    const existing = placeholderAudioStreamRef.current;
    if (existing && streamHasLiveAudio(existing.stream)) return existing.stream;

    closePlaceholderAudioStream();
    const contextCtor = window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
    if (!contextCtor) return null;

    const context = new contextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const destination = context.createMediaStreamDestination();
    // Near-silent track: enough for WebRTC negotiation, inaudible while the
    // real media element capture finishes preparing.
    gain.gain.value = 0.0001;
    oscillator.connect(gain).connect(destination);
    oscillator.start();
    void context.resume().catch(() => undefined);

    placeholderAudioStreamRef.current = { context, oscillator, stream: destination.stream };
    return destination.stream;
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
    if (modeRef.current !== 'host') return;
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
      if (
        shouldReuseCapture(
          capturedSourceRef.current,
          currentAudioSource,
          streamHasLiveAudio(localStreamRef.current),
          captureStartedPausedRef.current,
          audio.paused
        )
      ) {
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

      const previousCapturedSource = capturedSourceRef.current;
      const shouldRenegotiateListeners = Boolean(previousCapturedSource && previousCapturedSource !== currentAudioSource);

      const previousPlaceholderStream = placeholderAudioStreamRef.current?.stream ?? null;
      localStreamRef.current = stream;
      capturedSourceRef.current = currentAudioSource;
      captureStartedPausedRef.current = audio.paused;
      setLocalStreamReady(true);
      setTrackInfo(track);
      setSessionStatus(roomIdRef.current ? 'Live' : 'Audio ready');
      socketRef.current?.emit('room:track', track);

      await publishLocalStreamToListeners(stream, { renegotiate: shouldRenegotiateListeners });
      if (previousPlaceholderStream && previousPlaceholderStream !== stream) {
        closePlaceholderAudioStream();
      }
      // Do not stop tracks from an older captureStream() result here. Media
      // element capture streams follow source selection: when <audio>.src
      // changes, the browser can add the new source track to every existing
      // captured stream before this replacement finishes. Stopping the old
      // stream would then stop the newly selected source and leave listeners
      // with a live-looking but silent sender. Once sender replacement or
      // renegotiation completes, the previous stream is unreferenced and the
      // browser can retire it.
    } catch (streamError) {
      setError(streamError instanceof Error ? streamError.message : 'Audio capture unavailable in this browser');
      setSessionStatus('Capture unavailable');
    }
  }

  async function publishLocalStreamToListeners(stream: MediaStream, options: { renegotiate?: boolean } = {}) {
    const [audioTrack] = stream.getAudioTracks();
    if (!audioTrack) return;

    await Promise.all(
      listenersRef.current.map(async listener => {
        const peer = hostPeersRef.current.get(listener.id);
        const sender = peer?.getSenders().find(candidate => candidate.track?.kind === 'audio');
        if (options.renegotiate && peer?.connectionState !== 'closed') {
          await createOfferForListener(listener.id);
          return;
        }
        if (peer && sender && peer.connectionState !== 'closed') {
          try {
            await sender.replaceTrack(audioTrack);
            if (isRoomJoinE2e) recordRoomJoinE2eReplaceTrack();
            upsertListenerStatus(listener.id, getPeerStatus(peer.connectionState));
            return;
          } catch (replaceError) {
            console.warn('replaceTrack failed; renegotiating listener stream', replaceError);
          }
        }

        await createOfferForListener(listener.id);
      })
    );

    if (roomIdRef.current && listenersRef.current.length > 0) {
      socketRef.current?.emit('room:stream-ready');
      if (isRoomJoinE2e) recordRoomJoinE2eStreamReadySignal();
      publishRoomQuality('stream-ready', 'host', {
        listenerCount: listenersRef.current.length
      });
    }
  }

  async function pairListenerOrPrepareStream(listenerId: string) {
    if (localStreamRef.current) {
      await createOfferForListener(listenerId, { allowPlaceholder: Boolean(audioSourceRef.current) });
      return;
    }

    if (!audioSourceRef.current) return;
    setSessionStatus('Preparing audio');
    await prepareLocalStream(audioSourceRef.current, trackInfoRef.current);
    const existingPeer = hostPeersRef.current.get(listenerId);
    if (!existingPeer || existingPeer.connectionState === 'closed') {
      await createOfferForListener(listenerId, { allowPlaceholder: true });
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

  function startHostConnectionTimeout(listenerId: string, peer: RTCPeerConnection) {
    clearHostConnectionTimer(listenerId);
    const timer = window.setTimeout(() => {
      hostConnectionTimersRef.current.delete(listenerId);
      if (hostPeersRef.current.get(listenerId) !== peer || peer.connectionState === 'connected' || peer.connectionState === 'closed') return;
      upsertListenerStatus(listenerId, 'disconnected');
      setSessionStatus('Listener audio blocked');
      setError(webRtcConnectionFailureMessage(turnRelayAvailableRef.current));
      publishRoomQuality('connection-timeout', 'host', {
        peerId: listenerId,
        elapsedMs: elapsedSince(hostPeerStartedAtRef.current.get(listenerId) ?? null),
        listenerCount: listenersRef.current.length
      });
      emitWebRtcDiagnostic('host:connection-timeout', undefined, { peer });
    }, WEBRTC_CONNECTION_TIMEOUT_MS);
    hostConnectionTimersRef.current.set(listenerId, timer);
  }

  function requestListenerAudioOffer(status: string) {
    if (modeRef.current !== 'listener' || !roomIdRef.current) return;

    const retryCount = listenerAudioRetryCountRef.current;
    const retryElapsedMs = retryCount > 0 ? elapsedSince(listenerConnectionStartedAtRef.current) : undefined;
    pendingIceCandidatesRef.current.clear();
    closeListenerPeer();
    listenerOfferReceivedRef.current = false;
    listenerConnectionStartedAtRef.current = monotonicNow();
    setError(null);
    setSessionStatus(status);
    publishRoomQuality(retryCount > 0 || /^retrying/i.test(status) ? 'retry-requested' : 'listener-ready', 'listener', {
      retryCount,
      elapsedMs: retryElapsedMs,
      detail: status
    });
    connectSocket().emit('listener:ready');
    startListenerConnectionTimeout();
  }

  function startListenerConnectionTimeout() {
    clearListenerConnectionTimer();
    listenerConnectionTimerRef.current = window.setTimeout(() => {
      listenerConnectionTimerRef.current = null;
      const peer = listenerPeerRef.current;
      if (peer?.connectionState === 'connected' || remoteAudioRef.current?.srcObject) return;

      if (listenerAudioRetryCountRef.current < WEBRTC_AUTOMATIC_RETRIES && roomIdRef.current && socketRef.current?.connected) {
        listenerAudioRetryCountRef.current += 1;
        requestListenerAudioOffer('Retrying live audio');
        return;
      }

      setSessionStatus(listenerOfferReceivedRef.current ? 'Audio connection failed' : 'Waiting for host audio');
      setError(
        listenerOfferReceivedRef.current
          ? webRtcConnectionFailureMessage(turnRelayAvailableRef.current)
          : 'The host did not send a live-audio offer. Ask the host to retry the room.'
      );
      publishRoomQuality('connection-timeout', 'listener', {
        retryCount: listenerAudioRetryCountRef.current,
        elapsedMs: elapsedSince(listenerConnectionStartedAtRef.current),
        detail: listenerOfferReceivedRef.current ? 'connection-timeout' : 'offer-timeout'
      });
      emitWebRtcDiagnostic(listenerOfferReceivedRef.current ? 'listener:connection-timeout' : 'listener:offer-timeout', undefined, { peer });
    }, WEBRTC_CONNECTION_TIMEOUT_MS);
  }

  function createHostPeer(listenerId: string, iceServers: RTCIceServer[], stream: MediaStream | null = localStreamRef.current) {
    clearHostConnectionTimer(listenerId);
    hostPeersRef.current.get(listenerId)?.close();
    pendingIceCandidatesRef.current.delete(listenerId);
    hostPeerStartedAtRef.current.set(listenerId, monotonicNow());
    const peer = createRoomPeerConnection(iceServers);

    if (stream) {
      for (const track of stream.getAudioTracks()) {
        peer.addTrack(track, stream);
      }
    }

    let emittedIceCandidate = false;
    peer.onicecandidate = event => {
      if (event.candidate) {
        emittedIceCandidate = true;
        socketRef.current?.emit('webrtc:ice-candidate', {
          targetId: listenerId,
          candidate: event.candidate.toJSON()
        });
        return;
      }
      if (!emittedIceCandidate && !hasIceCandidate(peer.localDescription) && peer.connectionState !== 'closed') {
        setSessionStatus('WebRTC permission blocked');
        setError('The Product host did not expose a WebRTC network route. Confirm that WebRTC permission is allowed for Dotify.');
      }
    };
    peer.onicecandidateerror = event => {
      emitWebRtcDiagnostic('host:ice-candidate-error', new Error(event.errorText || 'ICE candidate gathering failed'), {
        errorCode: event.errorCode,
        peer
      });
    };
    peer.onconnectionstatechange = () => {
      const status = getPeerStatus(peer.connectionState);
      upsertListenerStatus(listenerId, status);
      if (status === 'connected') {
        clearHostConnectionTimer(listenerId);
        setSessionStatus('Live');
        setError(null);
        void publishPeerRoomQuality('peer-connected', 'host', peer, {
          peerId: listenerId,
          elapsedMs: elapsedSince(hostPeerStartedAtRef.current.get(listenerId) ?? null),
          listenerCount: listenersRef.current.length
        });
      } else if (peer.connectionState === 'failed') {
        void publishPeerRoomQuality('peer-failed', 'host', peer, {
          peerId: listenerId,
          elapsedMs: elapsedSince(hostPeerStartedAtRef.current.get(listenerId) ?? null),
          listenerCount: listenersRef.current.length
        });
      } else if (peer.connectionState === 'disconnected') {
        void publishPeerRoomQuality('peer-disconnected', 'host', peer, {
          peerId: listenerId,
          elapsedMs: elapsedSince(hostPeerStartedAtRef.current.get(listenerId) ?? null),
          listenerCount: listenersRef.current.length
        });
      }
    };

    hostPeersRef.current.set(listenerId, peer);
    return peer;
  }

  async function createOfferForListener(listenerId: string, options: { allowPlaceholder?: boolean } = {}) {
    try {
      let stream = localStreamRef.current;
      if (!stream && options.allowPlaceholder && audioSourceRef.current) {
        stream = createPlaceholderAudioStream();
        if (stream) {
          localStreamRef.current = stream;
          setSessionStatus('Preparing live audio');
        }
      }

      if (!stream) {
        upsertListenerStatus(listenerId, 'waiting');
        return;
      }

      const iceServers = await resolveRoomIceServers();
      const peer = createHostPeer(listenerId, iceServers, stream);
      upsertListenerStatus(listenerId, 'connecting');

      if (isRoomJoinE2e) recordRoomJoinE2eOffer();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (!hasAudioMediaSection(peer.localDescription)) {
        throw new Error('The host WebRTC offer contains no audio track. Retry playback before opening the room.');
      }
      const outboundOffer = roomJoinE2eOfferSnapshot(peer.localDescription?.toJSON() ?? offer);
      const offerDelayMs = roomJoinE2eOfferDelayMs();
      if (offerDelayMs > 0) {
        await new Promise(resolve => window.setTimeout(resolve, offerDelayMs));
      }
      socketRef.current?.emit('webrtc:offer', {
        targetId: listenerId,
        offer: outboundOffer
      });
      publishRoomQuality('offer-sent', 'host', {
        peerId: listenerId,
        elapsedMs: elapsedSince(hostPeerStartedAtRef.current.get(listenerId) ?? null),
        listenerCount: listenersRef.current.length
      });
      startHostConnectionTimeout(listenerId, peer);
    } catch (offerError) {
      upsertListenerStatus(listenerId, 'disconnected');
      setError(offerError instanceof Error ? offerError.message : 'Unable to create WebRTC offer');
      publishRoomQuality('peer-failed', 'host', {
        peerId: listenerId,
        elapsedMs: elapsedSince(hostPeerStartedAtRef.current.get(listenerId) ?? null),
        detail: 'create-offer-failed'
      });
      emitWebRtcDiagnostic('host:create-offer-failed', offerError);
    }
  }

  async function acceptOffer(from: string, offer: RTCSessionDescriptionInit) {
    if (!hasAudioMediaSection(offer)) {
      setSessionStatus('Host audio unavailable');
      setError('The host sent a room offer without an audio track. Ask the host to restart playback and retry the room.');
      return;
    }

    let phase = 'prepare-answer';
    let peer: RTCPeerConnection | null = null;
    try {
      // ICE candidates can arrive before the offer on Product Mobile's Fetch
      // polling transport. Keep that queue while replacing the previous peer;
      // acceptOffer flushes it immediately after setting the remote description.
      closeListenerPeer({ clearPendingCandidates: false });
      listenerOfferReceivedRef.current = true;
      setSessionStatus('Negotiating live audio');
      publishRoomQuality('offer-received', 'listener', {
        peerId: from,
        elapsedMs: elapsedSince(listenerJoinStartedAtRef.current)
      });

      phase = 'resolve-ice';
      const iceServers = await resolveRoomIceServers();
      phase = 'create-peer';
      peer = createRoomPeerConnection(iceServers);
      listenerPeerRef.current = peer;

      peer.ontrack = event => {
        const [stream] = event.streams;
        if (remoteAudioRef.current && stream) {
          remoteAudioRef.current.srcObject = stream;
          clearListenerConnectionTimer();
          publishRoomQuality('remote-track', 'listener', {
            peerId: from,
            elapsedMs: elapsedSince(listenerJoinStartedAtRef.current)
          });
          cueRemotePlayback('Live');
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
      peer.onicecandidateerror = event => {
        emitWebRtcDiagnostic('listener:ice-candidate-error', new Error(event.errorText || 'ICE candidate gathering failed'), {
          errorCode: event.errorCode,
          peer
        });
      };
      peer.onconnectionstatechange = () => {
        if (!peer) return;
        const status = getPeerStatus(peer.connectionState);
        setSessionStatus(status === 'connected' ? 'Live' : peerStatusLabel(status));
        if (status === 'connected') {
          clearListenerConnectionTimer();
          listenerAudioRetryCountRef.current = 0;
          setError(null);
          socketRef.current?.emit('peer:connected', { targetId: from });
          void publishPeerRoomQuality('peer-connected', 'listener', peer, {
            peerId: from,
            elapsedMs: elapsedSince(listenerJoinStartedAtRef.current)
          });
        } else if (peer.connectionState === 'failed') {
          clearListenerConnectionTimer();
          setError(webRtcConnectionFailureMessage(turnRelayAvailableRef.current));
          void publishPeerRoomQuality('peer-failed', 'listener', peer, {
            peerId: from,
            elapsedMs: elapsedSince(listenerConnectionStartedAtRef.current)
          });
          emitWebRtcDiagnostic('listener:connection-failed', undefined, { peer });
        } else if (peer.connectionState === 'disconnected') {
          void publishPeerRoomQuality('peer-disconnected', 'listener', peer, {
            peerId: from,
            elapsedMs: elapsedSince(listenerConnectionStartedAtRef.current)
          });
        }
      };

      phase = 'set-remote-description';
      await peer.setRemoteDescription(offer);
      phase = 'flush-remote-candidates';
      await flushRemoteCandidates(from, peer);
      phase = 'create-answer';
      const answer = await peer.createAnswer();
      phase = 'set-local-description';
      await peer.setLocalDescription(answer);
      phase = 'send-answer';
      socketRef.current?.emit('webrtc:answer', {
        targetId: from,
        answer: peer.localDescription
      });
      publishRoomQuality('answer-sent', 'listener', {
        peerId: from,
        elapsedMs: elapsedSince(listenerConnectionStartedAtRef.current)
      });
      startListenerConnectionTimeout();
    } catch (answerError) {
      clearListenerConnectionTimer();
      emitWebRtcDiagnostic(`listener:${phase}-failed`, answerError, { peer });
      const detail = describeWebRtcError(answerError).message;
      setError(`Live audio could not start on this device (${phase}): ${detail}`);
      setSessionStatus('WebRTC error');
      publishRoomQuality('peer-failed', 'listener', {
        peerId: from,
        elapsedMs: elapsedSince(listenerConnectionStartedAtRef.current),
        detail: phase
      });
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

  function createSession(
    currentTrackInfo: TrackInfo | null,
    playbackMode: RoomPlaybackMode = 'full',
    event?: FormEvent<HTMLFormElement>,
    options: CreateSessionOptions = {}
  ) {
    event?.preventDefault();
    if (productHostWebRtcUnavailable) {
      setSessionAction('idle');
      changeMode('host');
      navigateToView('player');
      setSessionStatus('Browser required');
      setError('This Polkadot Mobile build does not expose Product WebRTC. Open Dotify in the browser to host live audio.');
      return;
    }
    if (options.audioSourceHint) {
      audioSourceRef.current = options.audioSourceHint;
    }
    // Persist the chosen name on submit (not on every keystroke): storeDisplayName
    // no-ops for the untouched default, so a connected host is remembered without
    // recording a partial name typed into the create sheet.
    storeDisplayName(identityAddress, displayName);
    setSessionAction('creating');
    changeMode('host');
    navigateToView('player');
    setError(null);
    setSessionStatus('Opening room');
    closeListenerPeer();
    hostRoomStartedAtRef.current = monotonicNow();
    publishRoomQuality('room-create-started', 'host', {
      listenerCount: 0
    });

    emitAckWhenConnected<CreateRoomResponse>(
      'room:create',
      { displayName, track: currentTrackInfo, playbackMode },
      (response: CreateRoomResponse) => {
        setSessionAction('idle');
        if (!response.ok) {
          setError(response.error);
          setSessionStatus('Error');
          return;
        }

        roomIdRef.current = response.roomId;
        hostResumeTokenRef.current = response.hostResumeToken;
        publishRoomQuality('room-created', 'host', {
          roomId: response.roomId,
          elapsedMs: elapsedSince(hostRoomStartedAtRef.current),
          listenerCount: 0
        });
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
        clearRoomState('Error', 'Room service unavailable.', { closePeers: false });
      }
    );
  }

  function joinRoom(roomCode: string, options: { displayName?: string } = {}) {
    const normalizedRoomId = normalizeRoomCode(roomCode);
    if (!normalizedRoomId) {
      setError('Room code required');
      return;
    }
    const joinDisplayName = options.displayName ?? displayName;

    // Persist the chosen name on a real join (not on every keystroke). No-ops
    // for the untouched default, so link/QR guests joining as "Listener" are
    // not recorded. A silent reconnect goes through rejoinRoom, not here.
    storeDisplayName(identityAddress, joinDisplayName);
    changeMode('listener');
    setSessionAction('joining');
    navigateToView('player');
    setError(null);
    setSessionStatus('Joining room');
    closeHostPeers();
    closeListenerPeer();
    listenerJoinStartedAtRef.current = monotonicNow();
    listenerConnectionStartedAtRef.current = listenerJoinStartedAtRef.current;
    publishRoomQuality('room-join-started', 'listener', {
      roomId: normalizedRoomId
    });

    emitAckWhenConnected<JoinRoomResponse>(
      'room:join',
      { roomId: normalizedRoomId, displayName: joinDisplayName },
      (response: JoinRoomResponse) => {
        setSessionAction('idle');
        if (!response.ok) {
          setError(response.error);
          setSessionStatus('Error');
          return;
        }

        roomIdRef.current = response.roomId;
        hostIdRef.current = response.hostId;
        publishRoomQuality('room-joined', 'listener', {
          roomId: response.roomId,
          elapsedMs: elapsedSince(listenerJoinStartedAtRef.current),
          listenerCount: response.listenerCount
        });
        setRoomId(response.roomId);
        setJoinCode(response.roomId);
        setHostName(response.hostName);
        setTrackInfo(response.track);
        setPlayerState(response.playerState);
        if (response.listeners) {
          applyListenerRoster(response.listeners);
        } else {
          setListenerCount(response.listenerCount);
        }
        setRoomPlaybackMode(response.playbackMode === 'preview' ? 'preview' : 'full');
        setChatMessages(response.chatHistory ?? []);
        setRequestQueue(response.requests ?? []);
        setSessionStatus(response.track ? 'Waiting stream' : 'Connected');
        listenerOfferReceivedRef.current = false;
        listenerAudioRetryCountRef.current = 0;
        listenerConnectionStartedAtRef.current = monotonicNow();
        startListenerConnectionTimeout();
        requestOpenRooms();
      },
      () => {
        clearRoomState('Error', 'Room service unavailable.', { closePeers: false });
      }
    );
  }

  // Silent re-join after a socket reconnect: same room, fresh socket id.
  // The host receives listener:joined and re-offers WebRTC.
  function rejoinRoom(targetRoomId: string) {
    const socket = socketRef.current;
    if (!socket) return;

    closeListenerPeer();
    listenerJoinStartedAtRef.current = monotonicNow();
    listenerConnectionStartedAtRef.current = listenerJoinStartedAtRef.current;
    listenerOfferReceivedRef.current = false;
    listenerAudioRetryCountRef.current = 0;
    publishRoomQuality('room-join-started', 'listener', {
      roomId: targetRoomId,
      detail: 'socket-reconnect'
    });

    socket.emit('room:join', { roomId: targetRoomId, displayName }, (response: JoinRoomResponse) => {
      if (!response.ok) {
        clearRoomState('Room closed', response.error);
        return;
      }

      roomIdRef.current = response.roomId;
      hostIdRef.current = response.hostId;
      publishRoomQuality('room-rejoined', 'listener', {
        roomId: response.roomId,
        elapsedMs: elapsedSince(listenerJoinStartedAtRef.current),
        listenerCount: response.listenerCount
      });
      setHostName(response.hostName);
      setTrackInfo(response.track);
      setPlayerState(response.playerState);
      if (response.listeners) {
        applyListenerRoster(response.listeners);
      } else {
        setListenerCount(response.listenerCount);
      }
      setRoomPlaybackMode(response.playbackMode === 'preview' ? 'preview' : 'full');
      setChatMessages(response.chatHistory ?? []);
      setRequestQueue(response.requests ?? []);
      setSessionStatus(response.track ? 'Waiting stream' : 'Connected');
      listenerConnectionStartedAtRef.current = monotonicNow();
      startListenerConnectionTimeout();
    });
  }

  // A mobile host can briefly lose its signaling transport while the webview
  // remains alive. The opaque token proves continuity to the server without a
  // wallet prompt or public identifier; it is kept in memory for this room only.
  function resumeHostedRoom() {
    const socket = socketRef.current;
    const targetRoomId = roomIdRef.current;
    const hostResumeToken = hostResumeTokenRef.current;
    if (!socket?.connected || !targetRoomId || !hostResumeToken) return;

    socket
      .timeout(SIGNAL_ACK_TIMEOUT_MS)
      .emit('room:resume', { roomId: targetRoomId, hostResumeToken }, (ackError: Error | null, response: ResumeRoomResponse | undefined) => {
        if (ackError || !response) {
          setSessionStatus('Reconnecting room');
          setError('The room connection is still recovering.');
          return;
        }
        if (!response.ok) {
          clearRoomState('Room closed', response.error);
          return;
        }

        roomIdRef.current = response.roomId;
        setRoomId(response.roomId);
        setHostName(response.hostName);
        applyListenerRoster(response.listeners);
        setSessionStatus(localStreamRef.current ? 'Live' : 'Room open');
        setError(null);
        publishRoomQuality('host-online', 'host', {
          roomId: response.roomId,
          listenerCount: response.listenerCount
        });
        requestOpenRooms();
      });
  }

  function joinSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    joinRoom(joinCode);
  }

  function updateDisplayName(nextDisplayName: string) {
    const clean = sanitizeDisplayName(nextDisplayName);
    setDisplayName(clean);
    if (!isChosenDisplayName(clean)) {
      setError('Choose a room name first.');
      return;
    }

    storeDisplayName(identityAddress, clean);
    if (!roomIdRef.current) return;

    const socket = connectSocket();
    socket
      .timeout(SIGNAL_ACK_TIMEOUT_MS)
      .emit('room:rename', { displayName: clean }, (error: Error | null, response: { ok: boolean; displayName?: string; error?: string } | undefined) => {
        if (error || !response?.ok) {
          setError(response?.error ?? 'Unable to update room name.');
          return;
        }
        setDisplayName(response.displayName ?? clean);
        setError(null);
      });
  }

  function requestRoomAudio() {
    if (modeRef.current !== 'listener' || !roomIdRef.current) return;
    if (productHostWebRtcUnavailable) {
      setSessionStatus('Browser required');
      setError('This Polkadot Mobile build does not expose Product WebRTC. Continue this room in the browser to hear live audio.');
      return;
    }
    listenerAudioRetryCountRef.current = 0;
    requestListenerAudioOffer('Connecting audio');
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

  // Announce the room on the Statement Store so it can be discovered without
  // Dotify's signaling server. Additive only: the share link remains the way in,
  // and this is inert unless the build opted in and a Product host is present.
  useRoomBeacon({
    isHosting: mode === 'host' && Boolean(roomId),
    roomCode: roomId,
    hostName: displayName,
    listenerCount
  });

  async function copySessionLink() {
    const link = buildSessionLink(roomId, publicAppUrl || window.location.href);
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

  function setSoloListeningTrack(trackHash: string | null) {
    const normalized = typeof trackHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(trackHash) ? trackHash.toLowerCase() : null;
    soloTrackHashRef.current = normalized;

    if (normalized) {
      const socket = connectSocket();
      if (socket.connected) socket.emit('presence:solo', { trackHash: normalized });
      return;
    }

    if (socketRef.current?.connected) socketRef.current.emit('presence:solo', { trackHash: null });
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
    closeAllPeers();
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
    remoteStreamVersion,
    error,
    setError,
    openRooms,
    soloListeningByTrackHash,
    socketStatus,
    joinCode,
    setJoinCode,
    displayName,
    setDisplayName,
    localStreamReady,
    setLocalStreamReady,
    isRefreshingRooms,
    roomPlaybackMode,
    productHostWebRtcUnavailable,
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
    updateDisplayName,
    requestRoomAudio,
    openRoomInBrowser,
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
    setSoloListeningTrack,
    sendChatMessage,
    sendRoomReaction,
    sendRoomRequest,
    removeRoomRequest,
    clearRoomRequests,
    destroySession,
    sessionLink: buildSessionLink(roomId, publicAppUrl || window.location.href)
  };
}
