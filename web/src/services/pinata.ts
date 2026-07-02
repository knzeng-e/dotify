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

// Backend API base URL. When set, uploads are routed server-side.
const API_URL = (import.meta.env.VITE_DOTIFY_API_URL as string | undefined)?.replace(/\/$/, '');

// Demo/local mode credentials — browser-side Pinata only.
// These env vars have no effect when API_URL is configured.
const JWT = import.meta.env.VITE_PINATA_JWT as string;
const GATEWAY = (import.meta.env.VITE_PINATA_GATEWAY as string | undefined) ?? 'https://paseo-ipfs.polkadot.io';
const READ_GATEWAYS = (import.meta.env.VITE_IPFS_READ_GATEWAYS as string | undefined)
  ?.split(',')
  .map(gateway => gateway.trim())
  .filter(Boolean);
const FALLBACK_GATEWAYS = ['https://paseo-ipfs.polkadot.io', 'https://ipfs.io', 'https://dweb.link'];

const PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PIN_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const PIN_LIST_URL = 'https://api.pinata.cloud/data/pinList';

export type AccessMode = 'human-free' | 'classic';
export type PersonhoodLevel = 'DIM1' | 'DIM2';

export interface DotifyTrackManifest {
  schema: 'dotify.track.v1';
  createdAt: string;
  assets: {
    audioCID: string;
    coverCID: string;
    encrypted?: boolean; // audio bytes are AES-256-GCM encrypted before upload
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
  const gateways = [GATEWAY, ...(READ_GATEWAYS ?? []), ...FALLBACK_GATEWAYS];
  return Array.from(new Set(gateways.map(gateway => `${gateway.replace(/\/$/, '')}/ipfs/${cid}`)));
}

export async function fetchIpfsCid(cid: string): Promise<Response> {
  let lastError: unknown;

  for (const url of getGatewayUrls(cid)) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`Gateway ${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Unable to fetch IPFS CID ${cid}`);
}

// ---------------------------------------------------------------------------
// Backend upload helpers
// ---------------------------------------------------------------------------

async function parseBackendError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Upload a raw (unencrypted) audio file through the backend.
 * The backend derives a per-track key, encrypts server-side, and pins to Pinata.
 *
 * @param rawFile     The original audio file as selected by the artist.
 * @param contentHash 0x-prefixed blake2b-256 hash of the raw audio bytes.
 * @returns           Full Dotify audio ref: "dotify:enc:ipfs://<CID>"
 */
export async function uploadAudioToBackend(rawFile: File, contentHash: string): Promise<string> {
  if (!API_URL) throw new Error('Backend API is not configured (VITE_DOTIFY_API_URL).');

  const form = new FormData();
  form.append('audio', rawFile, rawFile.name);
  form.append('contentHash', contentHash);

  const res = await fetch(`${API_URL}/api/uploads/audio`, { method: 'POST', body: form });

  if (!res.ok) {
    const msg = await parseBackendError(res, `Audio upload failed (${res.status})`);
    throw new Error(msg);
  }

  const data = (await res.json()) as { ref: string };
  return data.ref; // "dotify:enc:ipfs://<CID>"
}

/**
 * Upload a cover image through the backend.
 *
 * @returns CID string (without ipfs:// prefix) — matches the return format of
 *          uploadFileToPinata so callers are interchangeable.
 */
export async function uploadCoverToBackend(file: File): Promise<string> {
  if (!API_URL) throw new Error('Backend API is not configured (VITE_DOTIFY_API_URL).');

  const form = new FormData();
  form.append('cover', file, file.name);

  const res = await fetch(`${API_URL}/api/uploads/cover`, { method: 'POST', body: form });

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
export async function uploadMetadataToBackend(manifest: DotifyTrackManifest): Promise<string> {
  if (!API_URL) throw new Error('Backend API is not configured (VITE_DOTIFY_API_URL).');

  const res = await fetch(`${API_URL}/api/uploads/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(manifest)
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

/**
 * Upload protected audio for publication and return the encrypted-asset CID.
 *
 * Production (backend configured): the RAW audio goes to the backend, which
 * derives the per-track key server-side, encrypts, and pins. The content key
 * never exists in the browser at publish time; listeners obtain it later via
 * the wallet-signed key request (services/keyService.ts).
 *
 * Demo/local: bytes are encrypted in the browser with the bundle-derived
 * demo key (best-effort, not a production boundary) and pinned directly.
 */
export async function uploadProtectedAudio(audio: ProtectedAudioSource, contentHash: string): Promise<string> {
  if (isArtistPublishE2e) {
    void audio;
    void contentHash;
    return getArtistPublishE2eCid('audio');
  }

  if (API_URL) {
    const rawFile = new File([audio.bytes as BlobPart], audio.name, { type: audio.mime || 'audio/mpeg' });
    const ref = await uploadAudioToBackend(rawFile, contentHash);
    return ref.startsWith('dotify:enc:ipfs://') ? ref.slice('dotify:enc:ipfs://'.length) : ref;
  }

  const { encryptTrackAudio } = await import('../shared/utils/protectedAudio');
  const encrypted = await encryptTrackAudio(audio.bytes, contentHash);
  const encFile = new File([encrypted as BlobPart], `${audio.name}.enc`, { type: 'application/octet-stream' });
  return uploadFileToPinata(encFile, encFile.name, { app: 'dotify', type: 'audio', encrypted: 'true' });
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

export async function uploadFileToPinata(file: File, name: string, keyvalues: Record<string, string> = {}): Promise<string> {
  if (isArtistPublishE2e && keyvalues.type === 'cover') {
    void file;
    void name;
    return getArtistPublishE2eCid('cover');
  }

  // Cover images: route through backend when API is configured.
  if (API_URL && keyvalues.type === 'cover') {
    return uploadCoverToBackend(file);
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

export async function uploadJsonToPinata(json: unknown, name: string, keyvalues: Record<string, string> = {}): Promise<string> {
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
    return uploadMetadataToBackend(json as DotifyTrackManifest);
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
