// ---------------------------------------------------------------------------
// Pinata / IPFS service — demo/local mode and production backend mode.
//
// Upload routing:
//   Production (VITE_DOTIFY_API_URL set) → all uploads go through the backend API.
//     - Audio:    POST /api/uploads/audio    (backend encrypts server-side)
//     - Cover:    POST /api/uploads/cover
//     - Metadata: POST /api/uploads/metadata
//
//   Demo/local (VITE_DOTIFY_API_URL absent, VITE_PINATA_JWT set) →
//     browser calls Pinata directly. For demos only.
//     Do NOT use an unrestricted Pinata JWT in production.
// ---------------------------------------------------------------------------

import { getArtistPublishE2eCid, getArtistPublishE2eScenario, isArtistPublishE2e, recordArtistPublishUploadFailure } from '../e2e/artistPublishMock';
import { contentKeyVersionForAudioRef, encryptedRefToCID, normalizeEncryptedAudioRef } from '../shared/utils/protectedAudio';
import { fetchThroughGateways } from './gatewayRace';
import { clearStoredSession, ensureDotifySession, ensureDotifySessionForSigner, type KeyRequestSigner } from './keyService';
import { getAddress, isAddress, type WalletClient } from 'viem';

// Backend API base URL. When set, uploads are routed server-side.
const API_URL = (import.meta.env.VITE_DOTIFY_API_URL as string | undefined)?.replace(/\/$/, '');

// Demo/local mode credentials — browser-side Pinata only.
// These env vars have no effect when API_URL is configured.
const JWT = import.meta.env.VITE_PINATA_JWT as string;
const PINATA_PUBLIC_GATEWAY = 'https://gateway.pinata.cloud';
function optionalEnvString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

const GATEWAY = optionalEnvString(import.meta.env.VITE_PINATA_GATEWAY as string | undefined) ?? PINATA_PUBLIC_GATEWAY;
const READ_GATEWAYS = (import.meta.env.VITE_IPFS_READ_GATEWAYS as string | undefined)
  ?.split(',')
  .map(gateway => gateway.trim())
  .filter(Boolean);
const FALLBACK_GATEWAYS = ['https://ipfs.io', 'https://dweb.link', 'https://paseo-ipfs.polkadot.io'];
const AUDIO_READ_TIMEOUT_MS = 20_000;
const AUDIO_READ_HEDGE_DELAY_MS = 8_000;

const PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PIN_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const PIN_LIST_URL = 'https://api.pinata.cloud/data/pinList';

export type AccessMode = 'human-free' | 'classic' | 'free';
export type PersonhoodLevel = 'DIM1' | 'DIM2';

export interface DotifyTrackManifest {
  schema: 'dotify.track.v1';
  createdAt: string;
  assets: {
    audioCID: string;
    coverCID: string;
    encrypted?: boolean; // audio bytes are AES-256-GCM encrypted before upload
    keyVersion?: string; // present for server-encrypted uploads that use release-bound derivation
    // previewCID existed for the retired 42% preview assets (ticket 18);
    // already-pinned manifests may still carry it, new manifests never do.
  };
  track: {
    contentHash: string;
    title: string;
    artistName: string;
    description: string;
    accessMode: AccessMode;
    priceDot: string;
    requiredPersonhood: string;
    zone: string;
  };
  royalties: Array<{ recipient: string; bps: number }>;
  settlement: {
    target: 'evm';
    royaltyBps: number;
    pricePlanck: string;
  };
  evm?: {
    txHash: string;
    contractAddress: string;
  };
}

// ---------------------------------------------------------------------------
// Mode detection
// ---------------------------------------------------------------------------

/** Returns true when the backend API is configured and uploads go server-side. */
export function isBackendConfigured(): boolean {
  return Boolean(API_URL);
}

// ---------------------------------------------------------------------------
// IPFS gateway helpers (read-only; gateway reads do not require a JWT)
// ---------------------------------------------------------------------------

export function getGatewayUrl(cid: string): string {
  return getGatewayUrls(cid)[0];
}

export function getGatewayUrls(cid: string): string[] {
  const gateways = [GATEWAY, PINATA_PUBLIC_GATEWAY, ...(READ_GATEWAYS ?? []), ...FALLBACK_GATEWAYS];
  return Array.from(new Set(gateways.map(gateway => `${gateway.replace(/\/$/, '')}/ipfs/${cid}`)));
}

function isPinataGateway(gateway: string): boolean {
  try {
    const host = new URL(gateway).hostname.toLowerCase();
    return host === 'gateway.pinata.cloud' || host.endsWith('.mypinata.cloud');
  } catch {
    return false;
  }
}

export function getAudioGatewayUrls(cid: string): string[] {
  const gateways = [GATEWAY, PINATA_PUBLIC_GATEWAY, ...(READ_GATEWAYS ?? []).filter(isPinataGateway)].filter(isPinataGateway);
  return Array.from(new Set(gateways.map(gateway => `${gateway.replace(/\/$/, '')}/ipfs/${cid}`)));
}

function extractIpfsPath(ref: string): string | null {
  if (ref.startsWith('ipfs://')) {
    return ref.slice('ipfs://'.length);
  }

  const match = ref.match(/\/ipfs\/([^?#]+)/);
  return match?.[1] ?? null;
}

export function getGatewayUrlsForAssetRef(assetRef: string): string[] {
  const ipfsPath = extractIpfsPath(assetRef);
  if (!ipfsPath) return assetRef ? [assetRef] : [];

  const fallbackUrls = getGatewayUrls(ipfsPath);
  if (!assetRef.startsWith('http://') && !assetRef.startsWith('https://')) return fallbackUrls;
  return Array.from(new Set([assetRef, ...fallbackUrls]));
}

type GatewayReadOptions = {
  signal?: AbortSignal;
};

function throwIfGatewayReadAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (typeof DOMException !== 'undefined') throw new DOMException('IPFS gateway read cancelled', 'AbortError');
  const error = new Error('IPFS gateway read cancelled');
  error.name = 'AbortError';
  throw error;
}

export async function fetchIpfsCid(cid: string, options: GatewayReadOptions = {}): Promise<Response> {
  throwIfGatewayReadAborted(options.signal);
  return fetchThroughGateways(getGatewayUrls(cid), { signal: options.signal, label: `IPFS CID ${cid}` });
}

export async function fetchAudioIpfsCid(cid: string, options: GatewayReadOptions = {}): Promise<Response> {
  throwIfGatewayReadAborted(options.signal);
  return fetchThroughGateways(getAudioGatewayUrls(cid), {
    signal: options.signal,
    timeoutMs: AUDIO_READ_TIMEOUT_MS,
    hedgeDelayMs: AUDIO_READ_HEDGE_DELAY_MS,
    label: `audio IPFS CID ${cid}`
  });
}

export async function fetchAssetRef(assetRef: string, options: GatewayReadOptions = {}): Promise<Response> {
  throwIfGatewayReadAborted(options.signal);
  return fetchThroughGateways(getGatewayUrlsForAssetRef(assetRef), { signal: options.signal, label: `asset ${assetRef}` });
}

// ---------------------------------------------------------------------------
// Backend upload helpers
// ---------------------------------------------------------------------------

export type BackendUploadErrorBody = {
  error?: unknown;
  issues?: Array<{
    path?: unknown;
    message?: unknown;
  }>;
};

export type BackendUploadIdentity = {
  chainId: number;
  walletClient?: WalletClient;
  signer?: KeyRequestSigner;
};

type BackendUploadPurpose = 'audio' | 'cover' | 'metadata';

export function formatBackendUploadError(body: BackendUploadErrorBody | null | undefined, fallback: string): string {
  const message = typeof body?.error === 'string' && body.error.trim() ? body.error : fallback;
  const issues = Array.isArray(body?.issues)
    ? body.issues
        .map(issue => {
          const path = typeof issue.path === 'string' ? issue.path.trim() : '';
          const detail = typeof issue.message === 'string' ? issue.message.trim() : '';
          if (path && detail) return `${path}: ${detail}`;
          return path || detail || '';
        })
        .filter(Boolean)
    : [];
  return issues.length > 0 ? `${message}: ${issues.join('; ')}` : message;
}

async function parseBackendError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as BackendUploadErrorBody;
    return formatBackendUploadError(body, fallback);
  } catch {
    return fallback;
  }
}

async function requestUploadAuthorization(identity: BackendUploadIdentity | undefined, purpose: BackendUploadPurpose, bytes: number): Promise<string> {
  if (!identity) throw new Error('Connect the artist wallet before uploading release assets.');
  const sessionAddress = identity.signer?.address ?? identity.walletClient?.account?.address;
  const ensureSession = () =>
    identity.signer
      ? ensureDotifySessionForSigner(identity.signer, identity.chainId)
      : identity.walletClient
        ? ensureDotifySession(identity.walletClient, identity.chainId)
        : Promise.resolve(null);
  let sessionToken = await ensureSession();
  if (!sessionToken) throw new Error('The backend requires signed artist sessions for uploads. Sign in and try again.');

  const requestAuthorization = (token: string) =>
    fetch(`${API_URL}/api/uploads/authorize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ purpose, bytes })
    });

  let res = await requestAuthorization(sessionToken);
  if (res.status === 401 && sessionAddress) {
    clearStoredSession(sessionAddress, sessionToken);
    sessionToken = await ensureSession();
    if (sessionToken) res = await requestAuthorization(sessionToken);
  }
  if (!res.ok) {
    const msg = await parseBackendError(res, `Upload authorization failed (${res.status})`);
    throw new Error(msg);
  }
  const data = (await res.json()) as { uploadAuthorization?: unknown };
  if (typeof data.uploadAuthorization !== 'string' || !data.uploadAuthorization) {
    throw new Error('The backend returned an invalid upload authorization.');
  }
  return data.uploadAuthorization;
}

/**
 * Upload a raw (unencrypted) audio file through the backend.
 * The backend derives a per-track key, encrypts server-side, and pins to Pinata.
 *
 * @param rawFile     The original audio file as selected by the artist.
 * @param contentHash 0x-prefixed blake2b-256 hash of the raw audio bytes.
 * @returns           Full Dotify audio ref: "dotify:enc:v2:key-v2:ipfs://<CID>" for new backend uploads.
 */
export async function uploadAudioToBackend(rawFile: File, contentHash: string, identity?: BackendUploadIdentity): Promise<ProtectedAudioUpload> {
  if (!API_URL) throw new Error('Backend API is not configured (VITE_DOTIFY_API_URL).');
  const authorization = await requestUploadAuthorization(identity, 'audio', rawFile.size);

  const form = new FormData();
  form.append('audio', rawFile, rawFile.name);
  form.append('contentHash', contentHash);

  const res = await fetch(`${API_URL}/api/uploads/audio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authorization}` },
    body: form
  });

  if (!res.ok) {
    const msg = await parseBackendError(res, `Audio upload failed (${res.status})`);
    throw new Error(msg);
  }

  const data = (await res.json()) as { ref?: unknown; runtimeAddress?: unknown; contentHash?: unknown; keyVersion?: unknown };
  if (typeof data.ref !== 'string' || !data.ref.trim()) {
    throw new Error('The backend returned an invalid audio upload response.');
  }
  if (typeof data.runtimeAddress !== 'string' || !isAddress(data.runtimeAddress)) {
    throw new Error('The backend returned an invalid audio upload runtime.');
  }

  return {
    ref: data.ref,
    runtimeAddress: getAddress(data.runtimeAddress),
    ...(typeof data.contentHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(data.contentHash)
      ? { contentHash: data.contentHash.toLowerCase() as `0x${string}` }
      : {}),
    ...(typeof data.keyVersion === 'string' && data.keyVersion.trim() ? { keyVersion: data.keyVersion } : {})
  };
}

/**
 * Upload a cover image through the backend.
 *
 * @returns CID string (without ipfs:// prefix) — matches the return format of
 *          uploadFileToPinata so callers are interchangeable.
 */
export async function uploadCoverToBackend(file: File, identity?: BackendUploadIdentity): Promise<string> {
  if (!API_URL) throw new Error('Backend API is not configured (VITE_DOTIFY_API_URL).');
  const authorization = await requestUploadAuthorization(identity, 'cover', file.size);

  const form = new FormData();
  form.append('cover', file, file.name);

  const res = await fetch(`${API_URL}/api/uploads/cover`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authorization}` },
    body: form
  });

  if (!res.ok) {
    const msg = await parseBackendError(res, `Cover upload failed (${res.status})`);
    throw new Error(msg);
  }

  const data = (await res.json()) as { ref: string };
  // Strip "ipfs://" prefix — callers add it themselves (matches uploadFileToPinata return format).
  return data.ref.startsWith('ipfs://') ? data.ref.slice(7) : data.ref;
}

/**
 * Upload a Dotify track manifest through the backend.
 *
 * @returns CID string (without ipfs:// prefix) — matches uploadJsonToPinata return format.
 */
export async function uploadMetadataToBackend(manifest: DotifyTrackManifest, identity?: BackendUploadIdentity): Promise<string> {
  if (!API_URL) throw new Error('Backend API is not configured (VITE_DOTIFY_API_URL).');
  const body = JSON.stringify(manifest);
  const authorization = await requestUploadAuthorization(identity, 'metadata', new TextEncoder().encode(body).byteLength);

  const res = await fetch(`${API_URL}/api/uploads/metadata`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authorization}`,
      'Content-Type': 'application/json'
    },
    body
  });

  if (!res.ok) {
    const msg = await parseBackendError(res, `Metadata upload failed (${res.status})`);
    throw new Error(msg);
  }

  const data = (await res.json()) as { ref: string };
  return data.ref.startsWith('ipfs://') ? data.ref.slice(7) : data.ref;
}

// ---------------------------------------------------------------------------
// Protected audio publication
// ---------------------------------------------------------------------------

export type ProtectedAudioSource = {
  bytes: Uint8Array;
  name: string;
  mime: string;
};

export type ProtectedAudioUpload =
  | string
  | {
      ref: string;
      runtimeAddress?: `0x${string}`;
      contentHash?: `0x${string}`;
      keyVersion?: string;
    };

function audioUploadRef(upload: ProtectedAudioUpload): string {
  return typeof upload === 'string' ? upload : upload.ref;
}

/**
 * Upload protected audio for publication and return the encrypted audio ref.
 *
 * Production (backend configured): the RAW audio goes to the backend, which
 * derives the per-track key server-side, encrypts, and pins. The content key
 * never exists in the browser at publish time; listeners obtain it later via
 * the wallet-signed key request (services/keyService.ts).
 *
 * Demo/local: bytes are encrypted in the browser with the bundle-derived
 * demo key (best-effort, not a production boundary) and pinned directly.
 */
export async function uploadProtectedAudio(audio: ProtectedAudioSource, contentHash: string, identity?: BackendUploadIdentity): Promise<ProtectedAudioUpload> {
  if (isArtistPublishE2e) {
    void audio;
    void contentHash;
    return getArtistPublishE2eCid('audio');
  }

  if (API_URL) {
    const rawFile = new File([audio.bytes as BlobPart], audio.name, { type: audio.mime || 'audio/mpeg' });
    return uploadAudioToBackend(rawFile, contentHash, identity);
  }

  const { encryptTrackAudio } = await import('../shared/utils/protectedAudio');
  const encrypted = await encryptTrackAudio(audio.bytes, contentHash);
  const encFile = new File([encrypted as BlobPart], `${audio.name}.enc`, { type: 'application/octet-stream' });
  const cid = await uploadFileToPinata(encFile, encFile.name, { app: 'dotify', type: 'audio', encrypted: 'true' });
  return normalizeEncryptedAudioRef(cid);
}

export function protectedAudioUploadToRef(upload: ProtectedAudioUpload): string {
  const refOrCid = audioUploadRef(upload);
  return refOrCid.trim() ? normalizeEncryptedAudioRef(refOrCid) : '';
}

export function protectedAudioUploadToKeyVersion(upload: ProtectedAudioUpload): string | undefined {
  if (typeof upload !== 'string' && upload.keyVersion) return upload.keyVersion;
  return contentKeyVersionForAudioRef(protectedAudioUploadToRef(upload)) ?? undefined;
}

export function protectedAudioUploadToCID(upload: ProtectedAudioUpload): string {
  const refOrCid = audioUploadRef(upload);
  if (!refOrCid.trim()) return '';
  return refOrCid.startsWith('dotify:enc:') ? encryptedRefToCID(refOrCid) : refOrCid;
}

export function protectedAudioUploadToRuntimeAddress(upload: ProtectedAudioUpload): `0x${string}` | null {
  if (typeof upload === 'string') return null;
  return upload.runtimeAddress ?? null;
}

// ---------------------------------------------------------------------------
// Demo/local mode upload helpers (direct Pinata from browser)
//
// These require VITE_PINATA_JWT. Only use in local development with a
// restricted upload-only Pinata token. Do NOT expose an unrestricted token.
// ---------------------------------------------------------------------------

function demoPinataHeaders(): Record<string, string> {
  if (!JWT) throw new Error('VITE_PINATA_JWT is not set. Configure the backend API or set a demo Pinata JWT.');
  return { Authorization: `Bearer ${JWT}` };
}

export async function uploadFileToPinata(file: File, name: string, keyvalues: Record<string, string> = {}, identity?: BackendUploadIdentity): Promise<string> {
  if (isArtistPublishE2e && keyvalues.type === 'cover') {
    void file;
    void name;
    return getArtistPublishE2eCid('cover');
  }

  // Cover images: route through backend when API is configured.
  if (API_URL && keyvalues.type === 'cover') {
    return uploadCoverToBackend(file, identity);
  }

  // Demo/local path — requires VITE_PINATA_JWT.
  const form = new FormData();
  form.append('file', file, name);
  form.append('pinataMetadata', JSON.stringify({ name, keyvalues }));

  const res = await fetch(PIN_FILE_URL, {
    method: 'POST',
    headers: demoPinataHeaders(),
    body: form
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata file upload failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { IpfsHash: string };
  return data.IpfsHash;
}

export async function uploadJsonToPinata(
  json: unknown,
  name: string,
  keyvalues: Record<string, string> = {},
  identity?: BackendUploadIdentity
): Promise<string> {
  if (isArtistPublishE2e && keyvalues.type === 'track-metadata') {
    void json;
    void name;
    if (getArtistPublishE2eScenario() === 'upload-failure') {
      recordArtistPublishUploadFailure();
      throw new Error('E2E metadata upload failed.');
    }
    return getArtistPublishE2eCid('metadata');
  }

  // Route through backend when API is configured.
  if (API_URL) {
    return uploadMetadataToBackend(json as DotifyTrackManifest, identity);
  }

  // Demo/local path — requires VITE_PINATA_JWT.
  const res = await fetch(PIN_JSON_URL, {
    method: 'POST',
    headers: {
      ...demoPinataHeaders(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pinataContent: json, pinataMetadata: { name, keyvalues } })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata JSON upload failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { IpfsHash: string };
  return data.IpfsHash;
}

// ---------------------------------------------------------------------------
// Catalog fetch (read-only, always via IPFS gateways + Pinata list)
// ---------------------------------------------------------------------------

interface PinListRow {
  ipfs_pin_hash: string;
  date_pinned: string;
}

export async function fetchCatalogFromPinata(): Promise<DotifyTrackManifest[]> {
  const query = new URLSearchParams({
    status: 'pinned',
    'metadata[keyvalues][app]': JSON.stringify({ value: 'dotify', op: 'eq' }),
    'metadata[keyvalues][type]': JSON.stringify({ value: 'track-metadata', op: 'eq' })
  });

  const res = await fetch(`${PIN_LIST_URL}?${query}`, {
    headers: { Authorization: `Bearer ${JWT}` }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Pinata catalog: ${res.statusText}`);
  }

  const data = (await res.json()) as { rows: PinListRow[] };

  const sorted = [...data.rows].sort((a, b) => a.date_pinned.localeCompare(b.date_pinned));

  const manifests = await Promise.allSettled(
    sorted.map(async pin => {
      const r = await fetchIpfsCid(pin.ipfs_pin_hash);
      const manifest = (await r.json()) as DotifyTrackManifest;
      if (manifest.schema !== 'dotify.track.v1') throw new Error('Unknown schema');
      return manifest;
    })
  );

  return manifests.filter((r): r is PromiseFulfilledResult<DotifyTrackManifest> => r.status === 'fulfilled').map(r => r.value);
}
