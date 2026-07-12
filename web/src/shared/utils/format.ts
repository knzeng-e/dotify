import { formatEther, parseEther } from 'viem';
import type { AccessMode, CatalogTrack, PeerStatus, PlayerState } from '../types';

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

export function progressPercent(state: PlayerState | null) {
  if (!state || !state.duration) return 0;
  return Math.min(100, Math.max(0, (state.currentTime / state.duration) * 100));
}

// The contract field is still named pricePlanck for historical/Substrate
// context, but Asset Hub EVM msg.value uses 18-decimal native units.
export function dotToPlanck(dot: string) {
  return parseEther(dot.trim() || '0');
}

export function formatWeiAsDot(wei: bigint) {
  return formatNativeAmount(wei, 9);
}

function formatNativeAmount(value: bigint, maxFractionDigits: number) {
  const [whole = '0', fraction = ''] = formatEther(value).split('.');
  const trimmedFraction = fraction.replace(/0+$/, '').slice(0, maxFractionDigits);
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

export function formatBlockTimestampMs(timestamp: bigint | undefined) {
  return timestamp === undefined ? null : Number(timestamp) * 1000;
}

// Short wall-clock (HH:MM) for room social timestamps (chat, request queue).
export function formatClockTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatPaymentDate(timestampMs: number | null) {
  if (timestampMs === null) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestampMs));
}

export function shorten(value: string, visible: number) {
  if (value.length <= visible * 2 + 3) return value;
  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}

export function shortenAddress(address: string) {
  return address.length > 14 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}

export function stripExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, '');
}

export function normalizeRoomCode(roomCode: string) {
  const raw = roomCode.trim();
  if (!raw) return '';

  const explicitMatch = raw.match(/(?:#\/)?rooms\/([A-Za-z0-9]{4,12})/i) ?? raw.match(/[?&]room=([A-Za-z0-9]{4,12})/i);
  if (explicitMatch?.[1]) return explicitMatch[1].toUpperCase();

  try {
    const url = new URL(raw, window.location.href);
    const hashMatch = url.hash.match(/\/rooms\/([A-Za-z0-9]{4,12})/i);
    const searchRoom = url.searchParams.get('room');
    if (hashMatch?.[1]) return hashMatch[1].toUpperCase();
    if (searchRoom) return normalizeRoomCode(searchRoom);
  } catch {
    // Plain room codes are handled below.
  }

  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

export function normalizeRooms<T>(rooms: T[]) {
  return Array.isArray(rooms) ? rooms : [];
}

export function peerStatusLabel(status: PeerStatus) {
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

export function accessModeLabel(track: CatalogTrack) {
  return accessModeLabelFromState(track.accessMode);
}

export function accessModeLabelFromState(mode: AccessMode) {
  if (mode === 'free') return 'Free for everyone';
  return mode === 'human-free' ? 'Free for verified humans' : 'Full song';
}

export function catalogAccessLabel(track: CatalogTrack) {
  if (track.accessMode === 'free') return 'Free for everyone';
  return track.accessMode === 'classic' ? `${track.priceDot} DOT` : 'Free for verified humans';
}

export function catalogAccessAriaLabel(track: CatalogTrack, hasAccess: boolean) {
  const status = hasAccess ? 'Access already available' : 'Access required';
  return `${status}: ${catalogAccessLabel(track)}`;
}

export function describeArtistRegistrationError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Artist registration failed';

  if (/consumes more than the allowed weight|proof_size|overweight_by|Invalid Transaction Contract call|0x190f1b41/i.test(message)) {
    return 'Artist registration exceeds the current Polkadot Hub EVM weight limit. Redeploy the updated ArtistRuntimeFactory, then refresh the app deployment addresses before trying again.';
  }

  if (/artist already has a runtime/i.test(message)) {
    return 'This wallet already owns an artist space. Refresh the status and manage releases there.';
  }

  return message;
}

export function getPeerStatus(connectionState: RTCPeerConnectionState): PeerStatus {
  if (connectionState === 'connected') return 'connected';
  if (connectionState === 'new' || connectionState === 'connecting') return 'connecting';
  return 'disconnected';
}
