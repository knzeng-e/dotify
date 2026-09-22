import type { RoomQualityTelemetrySnapshot } from '../rooms/roomQualityTelemetry';
import type { Mode } from '../../shared/types';
import type { ProductHostStatus } from './productHost';
import { normalizeIpfsCid } from '../../shared/utils/ipfsCid';

export const PRODUCT_ROOM_SMOKE_STORAGE_KEY = 'dotify:product-room-smoke-evidence:v1';

export type ProductRoomHostSurface = 'product-desktop' | 'product-web-gateway';

export type ProductRoomSmokeContext = {
  buildSha: string | null;
  productAppVersion: string | null;
  productId: string;
  publicAppUrl: string | null;
  productHostStatus: ProductHostStatus;
  hostOrigin: string;
  mode: Mode;
  roomId: string;
  sessionLink: string;
  listenerCount: number;
  localStreamReady: boolean;
};

export type ProductRoomSmokeCandidate = {
  gitSha: string;
  productAppVersion: string;
  deployedCid: string;
};

export type ProductRoomSmokeDraft = {
  candidate: ProductRoomSmokeCandidate;
  startedAt: string;
  roomId: string | null;
  hostSurface: ProductRoomHostSurface | null;
  hostVersion: string;
  guestOrigin: string;
  hostSharedCanonicalUrl: boolean;
  guestWalletlessObserved: boolean;
  guestHeardAudio: boolean;
  guestInSync: boolean;
};

export type ProductRoomSmokeCheck = {
  id: string;
  label: string;
  tone: 'ok' | 'warning' | 'error';
  detail: string;
};

export type ProductRoomSmokeEvidence = {
  schemaVersion: 2;
  capturedAt: string;
  candidate: ProductRoomSmokeCandidate;
  hostSurface: ProductRoomHostSurface | null;
  hostOrigin: string;
  hostVersion: string;
  guestOrigin: string;
  canonicalRoomUrl: string;
  hostSharedCanonicalUrl: boolean;
  guestAccountConnected: false | null;
  guestJoined: boolean;
  guestHeardAudio: boolean;
  guestInSync: boolean;
  hostRoomCreated: boolean;
  hostStreamReady: boolean;
  hostPeerConnected: boolean;
  hostListenerCount: number;
  checks: ProductRoomSmokeCheck[];
  limitations: string[];
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const FULL_SHA = /^[0-9a-f]{40}$/i;
const PRODUCT_VERSION = /^\[\d+(?:,\s*\d+)*\]$/;

function sessionStorageOrNull(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function cleanText(value: unknown, maxLength = 240): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validCandidate(value: unknown): ProductRoomSmokeCandidate | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ProductRoomSmokeCandidate>;
  const gitSha = cleanText(candidate.gitSha, 40);
  const productAppVersion = cleanText(candidate.productAppVersion, 64);
  const deployedCid = normalizeIpfsCid(cleanText(candidate.deployedCid, 160));
  if (!FULL_SHA.test(gitSha) || !PRODUCT_VERSION.test(productAppVersion) || !deployedCid) return null;
  return { gitSha, productAppVersion, deployedCid };
}

function candidateFromContext(context: ProductRoomSmokeContext, deployedCid: string): ProductRoomSmokeCandidate | null {
  return validCandidate({
    gitSha: context.buildSha,
    productAppVersion: context.productAppVersion,
    deployedCid
  });
}

function sameCandidate(left: ProductRoomSmokeCandidate, right: ProductRoomSmokeCandidate): boolean {
  return left.gitSha === right.gitSha && left.productAppVersion === right.productAppVersion && left.deployedCid === right.deployedCid;
}

function normalizeDraft(value: unknown): ProductRoomSmokeDraft | null {
  if (!value || typeof value !== 'object') return null;
  const draft = value as Partial<ProductRoomSmokeDraft>;
  const candidate = validCandidate(draft.candidate);
  const startedAt = cleanText(draft.startedAt, 40);
  if (!candidate || !Number.isFinite(Date.parse(startedAt))) return null;
  const hostSurface = draft.hostSurface === 'product-desktop' || draft.hostSurface === 'product-web-gateway' ? draft.hostSurface : null;
  return {
    candidate,
    startedAt,
    roomId: cleanText(draft.roomId, 12).toUpperCase() || null,
    hostSurface,
    hostVersion: cleanText(draft.hostVersion, 120),
    guestOrigin: cleanText(draft.guestOrigin, 240),
    hostSharedCanonicalUrl: draft.hostSharedCanonicalUrl === true,
    guestWalletlessObserved: draft.guestWalletlessObserved === true,
    guestHeardAudio: draft.guestHeardAudio === true,
    guestInSync: draft.guestInSync === true
  };
}

function writeDraft(draft: ProductRoomSmokeDraft, storage: StorageLike | null): ProductRoomSmokeDraft {
  storage?.setItem(PRODUCT_ROOM_SMOKE_STORAGE_KEY, JSON.stringify(draft));
  return draft;
}

export function readProductRoomSmokeDraft(storage: StorageLike | null = sessionStorageOrNull()): ProductRoomSmokeDraft | null {
  try {
    const raw = storage?.getItem(PRODUCT_ROOM_SMOKE_STORAGE_KEY);
    return raw ? normalizeDraft(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearProductRoomSmokeDraft(storage: StorageLike | null = sessionStorageOrNull()): void {
  storage?.removeItem(PRODUCT_ROOM_SMOKE_STORAGE_KEY);
}

export function bindProductRoomSmokeCandidate(
  context: ProductRoomSmokeContext,
  deployedCid: string,
  storage: StorageLike | null = sessionStorageOrNull(),
  now = new Date()
): ProductRoomSmokeDraft | null {
  const candidate = candidateFromContext(context, deployedCid);
  if (!candidate) return null;
  const existing = readProductRoomSmokeDraft(storage);
  if (existing && sameCandidate(existing.candidate, candidate)) return existing;
  return writeDraft(
    {
      candidate,
      startedAt: now.toISOString(),
      roomId: null,
      hostSurface: null,
      hostVersion: '',
      guestOrigin: '',
      hostSharedCanonicalUrl: false,
      guestWalletlessObserved: false,
      guestHeardAudio: false,
      guestInSync: false
    },
    storage
  );
}

export function updateProductRoomSmokeDraft(
  patch: Partial<Omit<ProductRoomSmokeDraft, 'candidate' | 'startedAt'>>,
  storage: StorageLike | null = sessionStorageOrNull()
): ProductRoomSmokeDraft | null {
  const current = readProductRoomSmokeDraft(storage);
  if (!current) return null;
  const next = normalizeDraft({ ...current, ...patch });
  return next ? writeDraft(next, storage) : null;
}

export function bindCurrentProductRoom(roomId: string, storage: StorageLike | null = sessionStorageOrNull()): ProductRoomSmokeDraft | null {
  const current = readProductRoomSmokeDraft(storage);
  if (!current) return null;
  const normalizedRoomId = cleanText(roomId, 12).toUpperCase();
  if (!normalizedRoomId) return null;
  return writeDraft(
    {
      ...current,
      roomId: normalizedRoomId,
      hostSharedCanonicalUrl: false,
      guestWalletlessObserved: false,
      guestHeardAudio: false,
      guestInSync: false
    },
    storage
  );
}

function isHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value.replace(/\/$/, '');
  } catch {
    return false;
  }
}

function hasHostMetric(snapshot: RoomQualityTelemetrySnapshot, roomId: string, startedAt: number, phase: string): boolean {
  return snapshot.events.some(event => event.role === 'host' && event.phase === phase && event.roomId === roomId && event.timestamp >= startedAt);
}

export function buildProductRoomSmokeEvidence(
  context: ProductRoomSmokeContext,
  draft: ProductRoomSmokeDraft,
  snapshot: RoomQualityTelemetrySnapshot,
  capturedAt = new Date()
): ProductRoomSmokeEvidence {
  const startedAt = Date.parse(draft.startedAt);
  const activeRoom = context.mode === 'host' && Boolean(draft.roomId) && context.roomId === draft.roomId;
  const canonicalRoomUrl = activeRoom ? context.sessionLink : '';
  const expectedPrefix = context.publicAppUrl ? `${context.publicAppUrl.replace(/\/$/, '')}/#/rooms/${draft.roomId ?? ''}` : '';
  const hostRoomCreated = activeRoom && hasHostMetric(snapshot, context.roomId, startedAt, 'room-created');
  const hostPeerConnected = activeRoom && hasHostMetric(snapshot, context.roomId, startedAt, 'peer-connected');
  const hostStreamReady = activeRoom && context.localStreamReady && (hostPeerConnected || hasHostMetric(snapshot, context.roomId, startedAt, 'stream-ready'));
  const hostListenerCount = activeRoom ? Math.max(0, context.listenerCount) : 0;
  const guestJoined = hostPeerConnected && hostListenerCount > 0;
  const hostSurfaceReady = Boolean(
    draft.hostSurface && draft.hostVersion && context.hostOrigin && (draft.hostSurface === 'product-web-gateway' || context.productHostStatus === 'available')
  );

  const checks: ProductRoomSmokeCheck[] = [
    {
      id: 'candidate',
      label: 'Deployed candidate',
      tone: 'ok',
      detail: `${draft.candidate.gitSha.slice(0, 8)} ${draft.candidate.productAppVersion} · ${draft.candidate.deployedCid}`
    },
    {
      id: 'surface',
      label: 'Product host surface',
      tone: hostSurfaceReady ? 'ok' : 'warning',
      detail:
        draft.hostSurface && draft.hostVersion ? `${draft.hostSurface} · ${draft.hostVersion}` : 'Choose the Product surface and record its visible version.'
    },
    {
      id: 'room',
      label: 'Hosted room',
      tone: hostRoomCreated ? 'ok' : 'warning',
      detail: hostRoomCreated ? `Room ${draft.roomId} was created by this Product host.` : 'Start a room, then bind that room to this capture.'
    },
    {
      id: 'stream',
      label: 'Host stream',
      tone: hostStreamReady ? 'ok' : 'warning',
      detail: hostStreamReady ? 'The host published a live room stream.' : 'Play the track until the host stream is ready.'
    },
    {
      id: 'guest',
      label: 'Browser guest',
      tone: guestJoined ? 'ok' : 'warning',
      detail: guestJoined
        ? `${hostListenerCount} browser listener${hostListenerCount === 1 ? '' : 's'} connected to the media peer.`
        : 'Join from the shared link in an ordinary browser.'
    },
    {
      id: 'canonical-link',
      label: 'Shared room link',
      tone: expectedPrefix && canonicalRoomUrl === expectedPrefix && draft.hostSharedCanonicalUrl ? 'ok' : 'warning',
      detail: canonicalRoomUrl || 'No canonical room link is active.'
    },
    {
      id: 'guest-observation',
      label: 'Audible and in sync',
      tone: draft.guestWalletlessObserved && draft.guestHeardAudio && draft.guestInSync && isHttpsOrigin(draft.guestOrigin) ? 'ok' : 'warning',
      detail: 'Confirm on the guest device: no account connected, audio heard, and player shown in sync.'
    }
  ];

  return {
    schemaVersion: 2,
    capturedAt: capturedAt.toISOString(),
    candidate: draft.candidate,
    hostSurface: draft.hostSurface,
    hostOrigin: context.hostOrigin,
    hostVersion: draft.hostVersion,
    guestOrigin: draft.guestOrigin,
    canonicalRoomUrl,
    hostSharedCanonicalUrl: draft.hostSharedCanonicalUrl,
    guestAccountConnected: draft.guestWalletlessObserved ? false : null,
    guestJoined,
    guestHeardAudio: draft.guestHeardAudio,
    guestInSync: draft.guestInSync,
    hostRoomCreated,
    hostStreamReady,
    hostPeerConnected,
    hostListenerCount,
    checks,
    limitations: [
      'Guest audibility, sync, and account state are explicit operator observations on the guest device.',
      'This artifact contains no wallet address, SDP, ICE candidate, IP address, content key, signature, or audio.'
    ]
  };
}

export function productRoomSmokeComplete(evidence: ProductRoomSmokeEvidence): boolean {
  return evidence.checks.every(check => check.tone === 'ok');
}

export function serializeProductRoomSmokeEvidence(evidence: ProductRoomSmokeEvidence): string {
  return JSON.stringify(evidence, null, 2);
}
