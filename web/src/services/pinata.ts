import { bulletinAssetUrl, fetchBulletinPublicAsset } from './bulletinPublicAssets';
import { readPreparationId, waitForAudioPreparation, type AudioPreparationPhase } from '../features/uploads/streamingPreparation';
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
import { loadPublicArtwork } from './publicArtworkCache';
import { clearStoredSession, ensureDotifySession, ensureDotifySessionForSigner, type KeyRequestSigner } from './keyService';
import { getAddress, isAddress, type WalletClient } from 'viem';
import { parseReleaseEditorialMetadata } from '../features/catalog/releaseMetadata';
import type { ReleaseEditorialMetadata } from '../shared/types';

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
const FALLBACK_GATEWAYS = ['https://ipfs.io', 'https://dweb.link', 'https://devnet-ipfs.api.polkadotcommunity.foundation'];
const RETIRED_GATEWAY_HOSTS = new Set(['bulletin-kubo.tservices.es', 'paseo-ipfs.polkadot.io']);

const PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PIN_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const PIN_LIST_URL = 'https://api.pinata.cloud/data/pinList';

export type AccessMode = 'human-free' | 'classic' | 'free';
export type PersonhoodLevel = 'DIM1' | 'DIM2';

export interface DotifyTrackManifest {
  schema: 'dotify.track.v2';
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
    durationSeconds: number | null;
    accessMode: AccessMode;
    priceDot: string;
    requiredPersonhood: string;
    zone: string;
  };
  editorial: ReleaseEditorialMetadata;
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

export async function fetchTrackManifest(metadataRef: string, options: GatewayReadOptions = {}): Promise<DotifyTrackManifest> {
  const response = await fetchAssetRef(metadataRef, options);
  if (!response.ok) throw new Error(`Release details could not be read (${response.status}).`);
  const value = (await response.json()) as Partial<DotifyTrackManifest> | null;
  if (!value || value.schema !== 'dotify.track.v2' || !value.track || !value.assets || !value.settlement || !Array.isArray(value.royalties)) {
    throw new Error('This release does not use the current Dotify metadata format.');
  }
  const editorial = parseReleaseEditorialMetadata(value.editorial);
  if (!editorial) throw new Error('The release details are incomplete or invalid.');
  return { ...value, editorial } as DotifyTrackManifest;
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
  const bulletin = bulletinAssetUrl(cid, API_URL);
  if (bulletin) return bulletin;
  const gateways = [GATEWAY, PINATA_PUBLIC_GATEWAY, ...(READ_GATEWAYS ?? []), ...FALLBACK_GATEWAYS].filter(gateway => !isRetiredGateway(gateway));
  return Array.from(new Set(gateways.map(gateway => `${gateway.replace(/\/$/, '')}/ipfs/${cid}`)));
}

function isRetiredGateway(url: string): boolean {
  try {
    return RETIRED_GATEWAY_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
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

  const bulletin = bulletinAssetUrl(ipfsPath, API_URL);
  if (bulletin) return bulletin;
  const fallbackUrls = getGatewayUrls(ipfsPath);
  if (isRetiredGateway(assetRef) || (!assetRef.startsWith('http://') && !assetRef.startsWith('https://'))) return fallbackUrls;
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
  return fetchAssetRef(`ipfs://${cid}`, options);
}

export async function fetchAssetRef(assetRef: string, options: GatewayReadOptions = {}): Promise<Response> {
  throwIfGatewayReadAborted(options.signal);
  const urls = getGatewayUrlsForAssetRef(assetRef);
  if (urls[0]?.includes('/api/assets/ipfs/')) return fetchBulletinPublicAsset(urls[0], options.signal);
  return fetchThroughGateways(urls, { signal: options.signal, label: `asset ${assetRef}` });
}

// ---------------------------------------------------------------------------
// Backend upload helpers
// ---------------------------------------------------------------------------

export type BackendUploadErrorBody = {
  code?: unknown;
  error?: unknown;
  issues?: Array<{
    path?: unknown;
    message?: unknown;
  }>;
};

export type BackendUploadIdentity = {
  chainId: number;
  onAudioPreparation?: (phase: AudioPreparationPhase) => void;
  walletClient?: WalletClient;
  signer?: KeyRequestSigner;
};

/** A stalled upload must not leave the publication modal pending forever.
 * Expiry ends the local wait, not the owned durable job or its ciphertext. */
async function fetchBackendUpload(url: string, init: RequestInit): Promise<Response> {
  const signal = AbortSignal.timeout(5 * 60_000);
  try {
    return await fetch(url, { ...init, signal });
  } catch (error) {
    if (signal.aborted) throw new Error('The upload connection timed out. Your draft is safe. Publish again to check or resume preparation.');
    throw error;
  }
}

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
 * @returns           Full Dotify audio ref: "dotify:enc:v3:key-v2:ipfs://<directory CID>" for new backend uploads.
 */
export async function uploadAudioToBackend(rawFile: File, contentHash: string, identity?: BackendUploadIdentity): Promise<ProtectedAudioUpload> {
  if (!API_URL) throw new Error('Backend API is not configured (VITE_DOTIFY_API_URL).');
  const principal = identity?.signer?.address ?? identity?.walletClient?.account?.address;
  const storageKey = `dotify.audio-preparation.v1:${API_URL}:${identity?.chainId}:${principal?.toLowerCase()}:${contentHash.toLowerCase()}`;
  const requestJob = async (id: string, retry: boolean | 'discard' = false): Promise<unknown> => {
    if (!identity) throw new Error('Connect your artist account to resume audio preparation.');
    const session = () =>
      identity.signer
        ? ensureDotifySessionForSigner(identity.signer, identity.chainId)
        : identity.walletClient
          ? ensureDotifySession(identity.walletClient, identity.chainId)
          : Promise.resolve(null);
    let token = await session();
    if (!token) throw new Error('Sign in to resume preparing your music.');
    const send = (value: string) =>
      fetch(`${API_URL}/api/uploads/audio/jobs/${id}${retry === 'discard' ? '/discard' : retry ? '/retry' : ''}`, {
        method: retry ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${value}` },
        signal: AbortSignal.timeout(15_000)
      });
    let response = await send(token);
    if (response.status === 401 && principal) {
      clearStoredSession(principal, token);
      token = await session();
      if (token) response = await send(token);
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as BackendUploadErrorBody | null;
      throw Object.assign(new Error(formatBackendUploadError(body, 'Audio preparation could not be checked. Please try again.')), {
        status: response.status,
        code: typeof body?.code === 'string' ? body.code : undefined
      });
    }
    return response.status === 204 ? null : response.json();
  };
  const discard = async (id: string) => {
    await requestJob(id, 'discard');
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* No secret is stored. */
    }
  };
  const saved = readPreparationId(storageKey);
  if (saved) {
    try {
      const ready = await waitForAudioPreparation({
        job: await requestJob(saved),
        storageKey,
        request: requestJob,
        onProgress: identity?.onAudioPreparation,
        discard,
        retryFailed: true
      });
      if (!isAddress(ready.runtimeAddress) || ready.contentHash.toLowerCase() !== contentHash.toLowerCase())
        throw new Error('Prepared audio does not match this release.');
      return { ...ready, runtimeAddress: getAddress(ready.runtimeAddress), contentHash: ready.contentHash.toLowerCase() as `0x${string}` };
    } catch (error) {
      // A stale local hint after expiry/reset is safe to discard. A transport
      // failure is not proof that a durable job disappeared.
      if ((error as { status?: number }).status === 404) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* Storage can be unavailable. */
        }
      } else throw error;
    }
  }
  const authorization = await requestUploadAuthorization(identity, 'audio', rawFile.size);

  const form = new FormData();
  form.append('audio', rawFile, rawFile.name);
  form.append('contentHash', contentHash);

  const res = await fetchBackendUpload(`${API_URL}/api/uploads/audio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authorization}` },
    body: form
  });

  if (!res.ok) {
    const msg = await parseBackendError(res, `Audio upload failed (${res.status})`);
    throw new Error(msg);
  }

  const responseBody: unknown = await res.json();
  if (res.status !== 202) throw new Error('The backend returned an unsupported audio preparation response.');
  const prepared = await waitForAudioPreparation({ job: responseBody, storageKey, request: requestJob, onProgress: identity?.onAudioPreparation, discard });
  const data = prepared as { ref?: unknown; runtimeAddress?: unknown; contentHash?: unknown; keyVersion?: unknown };
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

  const res = await fetchBackendUpload(`${API_URL}/api/uploads/cover`, {
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

  const res = await fetchBackendUpload(`${API_URL}/api/uploads/metadata`, {
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
    getArtistPublishE2eCid('audio');
    return 'dotify:enc:v3:key-v2:ipfs://Qm' + 'a'.repeat(44);
  }

  if (API_URL) {
    const rawFile = new File([audio.bytes as BlobPart], audio.name, { type: audio.mime || 'audio/mpeg' });
    return uploadAudioToBackend(rawFile, contentHash, identity);
  }

  throw new Error('The backend API is required to prepare protected streaming audio.');
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
    const ref = await uploadCoverToBackend(file, identity);
    // Warm canonical public variants while the artist reviews/signs the release.
    // A local original must never be stored under a different immutable CID.
    for (const width of [160, 320, 640]) {
      const variant = ref.replace(/\/cover\/640\.webp$/, `/cover/${width}.webp`);
      void loadPublicArtwork(getGatewayUrlsForAssetRef(variant.startsWith('ipfs://') ? variant : `ipfs://${variant}`)).catch(() => {});
    }
    return ref;
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
      if (manifest.schema !== 'dotify.track.v2') throw new Error('Unknown schema');
      return manifest;
    })
  );

  return manifests.filter((r): r is PromiseFulfilledResult<DotifyTrackManifest> => r.status === 'fulfilled').map(r => r.value);
}
