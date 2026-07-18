// Room-join e2e mock (Sprint 1, Ticket 07).
//
// Makes the listening-room flow deterministic for Playwright without a live
// blockchain, IPFS, or key backend. The REAL Socket.IO signaling server and
// REAL WebRTC negotiation stay in the loop; only two things are neutralized so
// the flow is CI-stable:
//
//   1. Host audio capture is replaced with a synthetic near-silent Web Audio
//      MediaStream (a real audio track, no fixture file or autoplay gesture).
//   2. ICE drops public STUN so negotiation uses loopback host candidates only
//      (no public internet, reliable cross-context connection).
//
// Room access doctrine under test (docs/backlog/README.md): only the HOST must
// satisfy the track access policy. Listeners join with a link, never connect a
// wallet, and never request or receive a content key. This mock exposes a
// per-context content-key counter so the spec can assert that boundary.

import type { CatalogTrack } from '../shared/types';

export const isRoomJoinE2e = import.meta.env.VITE_E2E_ROOM_JOIN === 'true';

export type RoomJoinE2eScenario = 'public' | 'protected-authorized' | 'protected-unauthorized';

export const E2E_ROOM_RUNTIME = '0x000000000000000000000000000000000000b0b0' as const;
export const E2E_ROOM_ARTIST = '0x000000000000000000000000000000000000b0a1' as const;
export const E2E_ROOM_PROTECTED_HASH = '0xb0b0000000000000000000000000000000000000000000000000000000000001' as const;
export const E2E_ROOM_PUBLIC_ID = 'e2e-room-public';
export const E2E_ROOM_PROTECTED_TITLE = 'E2E Protected Room Track';
export const E2E_ROOM_PUBLIC_TITLE = 'E2E Public Room Track';

// Two restrained aura covers so the host/listener cards render without remote assets.
const PROTECTED_COVER =
  'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20640%20640%22%3E%3Crect%20width%3D%22640%22%20height%3D%22640%22%20fill%3D%22%23071a33%22/%3E%3Ccircle%20cx%3D%22200%22%20cy%3D%22210%22%20r%3D%22210%22%20fill%3D%22%2300E5A0%22%20opacity%3D%22.55%22/%3E%3C/svg%3E';
const PUBLIC_COVER =
  'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20640%20640%22%3E%3Crect%20width%3D%22640%22%20height%3D%22640%22%20fill%3D%22%23102f57%22/%3E%3Ccircle%20cx%3D%22460%22%20cy%3D%22440%22%20r%3D%22220%22%20fill%3D%22%2304B8FF%22%20opacity%3D%22.5%22/%3E%3C/svg%3E';

// A deterministic 2s 8-bit/8kHz silent WAV, built once at module load (pure,
// no Date/random). It gives the host a real, finite-duration local source so
// playback progresses deterministically for the room specs.
function buildSilentWavDataUrl(fillValue = 128): string {
  const sampleRate = 8000;
  const seconds = 2;
  const dataLen = sampleRate * seconds; // 8-bit mono
  const bytes = new Uint8Array(44 + dataLen);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate (8-bit mono)
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, dataLen, true);
  bytes.fill(fillValue, 44); // unsigned 8-bit near-silence

  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export const E2E_ROOM_PUBLIC_AUDIO_URL = buildSilentWavDataUrl(128);
export const E2E_ROOM_PROTECTED_AUDIO_URL = buildSilentWavDataUrl(129);
export const E2E_ROOM_AUDIO_URL = E2E_ROOM_PUBLIC_AUDIO_URL;

export const E2E_ROOM_PROTECTED_TRACK: CatalogTrack = {
  id: `${E2E_ROOM_RUNTIME}:${E2E_ROOM_PROTECTED_HASH}`,
  zone: 'E2E',
  title: E2E_ROOM_PROTECTED_TITLE,
  artist: 'Dotify Room Host',
  artistAddress: E2E_ROOM_ARTIST,
  audioRef: 'dotify:enc:ipfs://room-join-e2e-protected',
  imageRef: PROTECTED_COVER,
  priceDot: '0.5',
  localUrl: E2E_ROOM_PROTECTED_AUDIO_URL,
  duration: 2,
  hash: E2E_ROOM_PROTECTED_HASH,
  description: 'A deterministic protected track used by the room-join e2e flow.',
  bulletinRef: '',
  metadataRef: 'e2e:room-join-protected',
  royaltyBps: 7000,
  durationLabel: '0:02',
  accessMode: 'classic',
  source: 'artist',
  royaltySplits: [{ label: 'Primary recipient', recipient: E2E_ROOM_ARTIST, bps: 7000 }],
  personhoodLevel: 'DIM1',
  encrypted: true,
  registeredAtBlock: 1
};

export const E2E_ROOM_PUBLIC_TRACK: CatalogTrack = {
  id: E2E_ROOM_PUBLIC_ID,
  zone: 'E2E',
  title: E2E_ROOM_PUBLIC_TITLE,
  artist: 'Dotify Room Host',
  artistAddress: E2E_ROOM_ARTIST,
  audioRef: `dotify:local:${E2E_ROOM_PUBLIC_ID}`,
  imageRef: PUBLIC_COVER,
  priceDot: '0',
  localUrl: E2E_ROOM_PUBLIC_AUDIO_URL,
  duration: 2,
  hash: '0xb0b0000000000000000000000000000000000000000000000000000000000002',
  description: 'A deterministic public track used by the room-join e2e flow.',
  bulletinRef: '',
  metadataRef: 'e2e:room-join-public',
  royaltyBps: 0,
  durationLabel: '0:02',
  accessMode: 'human-free',
  source: 'artist',
  royaltySplits: [],
  personhoodLevel: 'DIM1',
  encrypted: false,
  registeredAtBlock: 1
};

// Ordered [protected, public] so the unauthorized-host scenario skips forward
// from the protected track (index 0) to the public track (index 1).
export function getRoomJoinE2eTracks(): CatalogTrack[] {
  return [E2E_ROOM_PROTECTED_TRACK, E2E_ROOM_PUBLIC_TRACK];
}

export function isRoomJoinE2eTrack(track: Pick<CatalogTrack, 'id'>) {
  if (!isRoomJoinE2e) return false;
  const id = track.id.toLowerCase();
  return id === E2E_ROOM_PUBLIC_ID || id.startsWith(`${E2E_ROOM_RUNTIME.toLowerCase()}:`);
}

export function isRoomJoinE2eProtectedHash(contentHash: string) {
  return isRoomJoinE2e && contentHash.toLowerCase() === E2E_ROOM_PROTECTED_HASH.toLowerCase();
}

export function getRoomJoinE2eScenario(): RoomJoinE2eScenario {
  if (!isRoomJoinE2e || typeof window === 'undefined') return 'public';
  const requested = new URLSearchParams(window.location.search).get('e2eRoom');
  if (requested === 'protected-authorized' || requested === 'protected-unauthorized' || requested === 'public') {
    return requested;
  }
  return 'public';
}

// True when this page is a room-join e2e context: a host scenario (`?e2eRoom=`)
// or a listener share link (`#/rooms/<id>`). Used to keep the room flow wallet-
// free in the harness, where the classic-unlock flag would otherwise auto-connect
// a wallet and contradict the "guests join with no wallet" guarantee under test.
export function isRoomJoinE2eContext() {
  if (!isRoomJoinE2e || typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('e2eRoom')) return true;
  return /\/rooms\/[A-Za-z0-9]{4,12}/.test(window.location.hash);
}

// The HOST satisfies the protected track policy only in the authorized scenario.
// Listener contexts open a bare #/rooms/<id> link (no e2eRoom param) and default
// to 'public', so they never claim protected access.
export function roomJoinE2eHostHasAccess() {
  return getRoomJoinE2eScenario() === 'protected-authorized';
}

// ── Per-context content-key boundary counter ─────────────────────────────────

export type RoomJoinE2eState = {
  scenario: RoomJoinE2eScenario;
  keyRequests: number;
  deniedKeyRequests: number;
  offers: number;
  replaceTrackSwaps: number;
  captureTrackStops: number;
  webAudioCaptures: number;
  streamReadySignals: number;
  remotePlaybackCues: number;
};

declare global {
  interface Window {
    __DOTIFY_E2E_ROOM_JOIN__?: RoomJoinE2eState;
  }
}

export function getRoomJoinE2eState(): RoomJoinE2eState {
  if (typeof window === 'undefined') {
    return {
      scenario: 'public',
      keyRequests: 0,
      deniedKeyRequests: 0,
      offers: 0,
      replaceTrackSwaps: 0,
      captureTrackStops: 0,
      webAudioCaptures: 0,
      streamReadySignals: 0,
      remotePlaybackCues: 0
    };
  }
  window.__DOTIFY_E2E_ROOM_JOIN__ ??= {
    scenario: getRoomJoinE2eScenario(),
    keyRequests: 0,
    deniedKeyRequests: 0,
    offers: 0,
    replaceTrackSwaps: 0,
    captureTrackStops: 0,
    webAudioCaptures: 0,
    streamReadySignals: 0,
    remotePlaybackCues: 0
  };
  window.__DOTIFY_E2E_ROOM_JOIN__.offers ??= 0;
  window.__DOTIFY_E2E_ROOM_JOIN__.replaceTrackSwaps ??= 0;
  window.__DOTIFY_E2E_ROOM_JOIN__.captureTrackStops ??= 0;
  window.__DOTIFY_E2E_ROOM_JOIN__.webAudioCaptures ??= 0;
  window.__DOTIFY_E2E_ROOM_JOIN__.streamReadySignals ??= 0;
  window.__DOTIFY_E2E_ROOM_JOIN__.remotePlaybackCues ??= 0;
  return window.__DOTIFY_E2E_ROOM_JOIN__;
}

export function recordRoomJoinE2eKeyRequest(authorized: boolean) {
  if (typeof window === 'undefined') return;
  const state = getRoomJoinE2eState();
  state.keyRequests += 1;
  if (!authorized) state.deniedKeyRequests += 1;
}

export function recordRoomJoinE2eOffer() {
  if (typeof window === 'undefined') return;
  getRoomJoinE2eState().offers += 1;
}

export function recordRoomJoinE2eReplaceTrack() {
  if (typeof window === 'undefined') return;
  getRoomJoinE2eState().replaceTrackSwaps += 1;
}

export function recordRoomJoinE2eWebAudioCapture() {
  if (typeof window === 'undefined') return;
  getRoomJoinE2eState().webAudioCaptures += 1;
}

export function recordRoomJoinE2eStreamReadySignal() {
  if (typeof window === 'undefined') return;
  getRoomJoinE2eState().streamReadySignals += 1;
}

export function recordRoomJoinE2eRemotePlaybackCue() {
  if (typeof window === 'undefined') return;
  getRoomJoinE2eState().remotePlaybackCues += 1;
}

// ── WebRTC test doubles ──────────────────────────────────────────────────────

// Loopback-only ICE: no public STUN. Cross-context peers in the same headless
// Chromium connect over host candidates with zero network dependency.
export function roomJoinE2eIceServers(): RTCIceServer[] {
  return [];
}

export function shouldUseRoomJoinE2eSyntheticCapture() {
  if (!isRoomJoinE2e || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('e2eCapture') !== 'web-audio';
}

let e2eAudioContext: AudioContext | null = null;

type AudioContextWindow = Window & { webkitAudioContext?: typeof AudioContext };

// A real, live, near-silent audio MediaStream. Replaces <audio>.captureStream()
// so the host always has a transmittable track regardless of the local element's
// state, keeping WebRTC negotiation deterministic.
export function createRoomJoinE2eCaptureStream(): MediaStream {
  const Ctor = window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
  if (!Ctor) throw new Error('AudioContext unavailable for room-join e2e capture stream.');
  e2eAudioContext ??= new Ctor();
  void e2eAudioContext.resume();
  const oscillator = e2eAudioContext.createOscillator();
  const gain = e2eAudioContext.createGain();
  gain.gain.value = 0.0001; // audible-floor: a live track, effectively silent
  const destination = e2eAudioContext.createMediaStreamDestination();
  oscillator.connect(gain).connect(destination);
  oscillator.start();
  const [track] = destination.stream.getAudioTracks();
  if (track) {
    const stop = track.stop.bind(track);
    track.stop = () => {
      getRoomJoinE2eState().captureTrackStops += 1;
      stop();
    };
  }
  return destination.stream;
}
