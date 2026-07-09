// Wallet-signed content-key client (Sprint 0, Ticket 03).
//
// Flow: request a single-use nonce, sign a structured EIP-191 message with
// the connected wallet, exchange the signature for the per-track content key.
// The backend independently re-checks the on-chain access policy; nothing the
// frontend sends is trusted as an access decision.
//
// The canonical message format below MUST stay byte-identical with the
// backend builder (services/api/src/services/signatures.ts). Any drift fails
// closed: verification simply rejects.

import type { WalletClient } from 'viem';

const API_URL = (import.meta.env.VITE_DOTIFY_API_URL as string | undefined)?.replace(/\/$/, '');

export type KeyRequestPurpose = 'individual' | 'room_host';

// Access model v2 (ticket 24 P1): a denial names the reason and the action the
// listener can take. There is no degraded playback mode - the preview doctrine
// is retired.
export type ContentKeyResponse =
  | {
      access: 'allowed';
      playbackMode: 'full';
      contentKey: `0x${string}`;
      runtime: `0x${string}`;
    }
  | {
      access: 'denied';
      reason: string;
      message: string;
      hostAction: { type: 'unlock' | 'personhood' | 'none'; label: string };
    };

export class KeyServiceError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'KeyServiceError';
    this.code = code;
  }
}

/** True when the backend key service can be reached (production mode). */
export function isKeyServiceConfigured(): boolean {
  return Boolean(API_URL);
}

type SignedRequestPayload = {
  action: 'REQUEST_CONTENT_KEY';
  purpose: KeyRequestPurpose;
  contentHash: string;
  requester: string;
  chainId: number;
  nonce: string;
  expiresAt: string;
};

function buildSignedRequestMessage(payload: SignedRequestPayload): string {
  return [
    'Dotify signed request',
    'App: Dotify',
    `Action: ${payload.action}`,
    `Purpose: ${payload.purpose}`,
    `Content Hash: ${payload.contentHash.toLowerCase()}`,
    `Requester: ${payload.requester.toLowerCase()}`,
    `Chain ID: ${payload.chainId}`,
    `Nonce: ${payload.nonce}`,
    `Expires At: ${payload.expiresAt}`
  ].join('\n');
}

async function parseError(res: Response, fallback: string): Promise<{ message: string; code: string }> {
  try {
    const body = (await res.json()) as { error?: string; code?: string };
    return { message: body.error ?? fallback, code: body.code ?? 'KEY_SERVICE_ERROR' };
  } catch {
    return { message: fallback, code: 'KEY_SERVICE_ERROR' };
  }
}

async function requestNonce(address: string, chainId: number): Promise<{ nonce: string; expiresAt: string }> {
  const res = await fetch(`${API_URL}/api/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, chainId })
  });
  if (!res.ok) {
    const { message, code } = await parseError(res, `Nonce request failed (${res.status})`);
    throw new KeyServiceError(message, code);
  }
  return (await res.json()) as { nonce: string; expiresAt: string };
}

export type ContentKeyRequest = {
  contentHash: `0x${string}`;
  purpose: KeyRequestPurpose;
  walletClient: WalletClient;
  chainId: number;
};

// ---------------------------------------------------------------------------
// Session: sign once, listen freely (ticket 24 P2).
//
// One SIWE-style signature opens a ~24h session; the token (identity only,
// never access) then rides every key request instead of a fresh signature.
// The backend re-checks the on-chain policy per track on every request.
// ---------------------------------------------------------------------------

type StoredSession = { token: string; expiresAt: string };

// Refresh slightly early so a token never expires mid-request.
const SESSION_REFRESH_MARGIN_MS = 60_000;
let sessionCapability: 'unknown' | 'available' | 'unavailable' = 'unknown';

function sessionStorageKey(address: string): string {
  return `dotify:session:${address.toLowerCase()}`;
}

function readStoredSession(address: string, options: { requireFresh: boolean }): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(sessionStorageKey(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'string') return null;
    const expiresAtMs = Date.parse(parsed.expiresAt);
    if (!Number.isFinite(expiresAtMs)) return null;
    if (options.requireFresh && expiresAtMs - SESSION_REFRESH_MARGIN_MS <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getStoredSession(address: string): StoredSession | null {
  return readStoredSession(address, { requireFresh: true });
}

function storeSession(address: string, session: StoredSession): void {
  try {
    window.localStorage.setItem(sessionStorageKey(address), JSON.stringify(session));
  } catch {
    // Storage unavailable: the session still works for this page lifetime via
    // the per-request fallback; nothing to do.
  }
}

export function clearStoredSession(address: string): void {
  try {
    window.localStorage.removeItem(sessionStorageKey(address));
  } catch {
    // ignore
  }
}

async function isDotifySessionAvailable(): Promise<boolean> {
  if (!API_URL) return false;
  if (sessionCapability === 'available') return true;
  if (sessionCapability === 'unavailable') return false;

  const res = await fetch(`${API_URL}/api/auth/session`, { method: 'GET' });
  if (res.ok) {
    sessionCapability = 'available';
    return true;
  }
  if (res.status === 404 || res.status === 503) {
    sessionCapability = 'unavailable';
    return false;
  }

  const { message, code } = await parseError(res, `Session capability check failed (${res.status})`);
  throw new KeyServiceError(message, code);
}

/**
 * Canonical EIP-191 sign-in message. MUST stay byte-identical with the
 * backend builder (services/api/src/services/signatures.ts).
 */
function buildSignInMessage(payload: { requester: string; chainId: number; nonce: string; expiresAt: string }): string {
  return [
    'Dotify sign-in',
    'App: Dotify',
    'Action: SIGN_IN',
    `Requester: ${payload.requester.toLowerCase()}`,
    `Chain ID: ${payload.chainId}`,
    `Nonce: ${payload.nonce}`,
    `Expires At: ${payload.expiresAt}`
  ].join('\n');
}

/**
 * Ensure a live Dotify session for the connected wallet: reuse the stored
 * token when fresh, otherwise sign the one sign-in message and exchange it.
 * Returns null when the backend does not support sessions (older deployment
 * or unconfigured), so callers fall back to per-request signing.
 */
export async function ensureDotifySession(walletClient: WalletClient, chainId: number): Promise<string | null> {
  if (!API_URL) return null;
  const account = walletClient.account;
  if (!account) return null;

  const stored = getStoredSession(account.address);
  if (stored) return stored.token;
  if (!(await isDotifySessionAvailable())) return null;

  const { nonce, expiresAt } = await requestNonce(account.address, chainId);
  const signature = await walletClient.signMessage({
    account,
    message: buildSignInMessage({ requester: account.address, chainId, nonce, expiresAt })
  });

  const res = await fetch(`${API_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: account.address, signature, nonce, chainId, expiresAt })
  });

  // 404 (older backend) or 503 (session auth unconfigured): fall back to the
  // per-request signed path rather than failing playback.
  if (res.status === 404 || res.status === 503) {
    sessionCapability = 'unavailable';
    return null;
  }
  if (!res.ok) {
    const { message, code } = await parseError(res, `Sign-in failed (${res.status})`);
    throw new KeyServiceError(message, code);
  }

  const body = (await res.json()) as { sessionToken: string; expiresAt: string };
  storeSession(account.address, { token: body.sessionToken, expiresAt: body.expiresAt });
  return body.sessionToken;
}

/** Sign out: revoke the session server-side and forget the stored token. */
export async function signOutOfDotifySession(address: string): Promise<void> {
  const stored = readStoredSession(address, { requireFresh: false });
  clearStoredSession(address);
  if (!API_URL || !stored) return;
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: stored.token })
    });
  } catch {
    // Best-effort: the local token is already gone and the server token expires.
  }
}

async function requestKeyWithSession(contentHash: `0x${string}`, purpose: KeyRequestPurpose, sessionToken: string): Promise<Response> {
  return fetch(`${API_URL}/api/tracks/${contentHash}/key-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken, purpose })
  });
}

/**
 * Request the content key for a track. Preferred path: the one-per-session
 * token (no signature per listen). A stale/revoked session retries once with
 * a fresh sign-in; backends without session support fall back to the
 * per-request signed message.
 */
export async function requestContentKey(request: ContentKeyRequest): Promise<ContentKeyResponse> {
  if (!API_URL) {
    throw new KeyServiceError('Backend key service is not configured (VITE_DOTIFY_API_URL).', 'KEY_SERVICE_NOT_CONFIGURED');
  }

  const account = request.walletClient.account;
  if (!account) {
    throw new KeyServiceError('Wallet client has no active account.', 'WALLET_REQUIRED');
  }

  let sessionToken = await ensureDotifySession(request.walletClient, request.chainId);
  if (sessionToken) {
    let res = await requestKeyWithSession(request.contentHash, request.purpose, sessionToken);
    if (res.status === 401) {
      // Expired or revoked server-side: one fresh sign-in, then retry once.
      clearStoredSession(account.address);
      sessionToken = await ensureDotifySession(request.walletClient, request.chainId);
      if (sessionToken) {
        res = await requestKeyWithSession(request.contentHash, request.purpose, sessionToken);
      }
    }
    if (sessionToken) {
      if (!res.ok) {
        const { message, code } = await parseError(res, `Key request failed (${res.status})`);
        throw new KeyServiceError(message, code);
      }
      return (await res.json()) as ContentKeyResponse;
    }
  }

  // Legacy per-request signed path (backend without session support).
  const { nonce, expiresAt } = await requestNonce(account.address, request.chainId);

  const payload: SignedRequestPayload = {
    action: 'REQUEST_CONTENT_KEY',
    purpose: request.purpose,
    contentHash: request.contentHash,
    requester: account.address,
    chainId: request.chainId,
    nonce,
    expiresAt
  };

  const signature = await request.walletClient.signMessage({
    account,
    message: buildSignedRequestMessage(payload)
  });

  const res = await fetch(`${API_URL}/api/tracks/${request.contentHash}/key-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requester: account.address,
      signature,
      nonce,
      chainId: request.chainId,
      expiresAt,
      purpose: request.purpose
    })
  });

  if (!res.ok) {
    const { message, code } = await parseError(res, `Key request failed (${res.status})`);
    throw new KeyServiceError(message, code);
  }

  return (await res.json()) as ContentKeyResponse;
}

/**
 * Request the content key for a Free track. No wallet, no signature, no
 * session: the backend verifies on-chain that the track's current access mode
 * grants access to everyone, and only then releases the key. Free must feel
 * free - a guest without a wallet can play a Free track.
 */
export async function requestFreeContentKey(contentHash: `0x${string}`): Promise<ContentKeyResponse> {
  if (!API_URL) {
    throw new KeyServiceError('Backend key service is not configured (VITE_DOTIFY_API_URL).', 'KEY_SERVICE_NOT_CONFIGURED');
  }

  const res = await fetch(`${API_URL}/api/tracks/${contentHash}/free-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  if (!res.ok) {
    const { message, code } = await parseError(res, `Free key request failed (${res.status})`);
    throw new KeyServiceError(message, code);
  }

  return (await res.json()) as ContentKeyResponse;
}
