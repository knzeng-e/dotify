// Wallet-signed content-key client (Sprint 0, Ticket 03).
//
// Flow: sign one SIGN_IN challenge to establish an identity session, then send
// its token for per-track content-key requests. The backend independently
// re-checks the access policy on every key request. Session-service failures
// never switch playback to per-track wallet signatures.

import type { WalletClient } from 'viem';
import { createSessionCache, type SessionScope } from './sessionCache';

import { publishProductHostKeySmokeMetric, type ProductHostKeySmokeMetric } from '../features/productHost/productCdmHostSmokeEvidence';

const API_URL = (import.meta.env.VITE_DOTIFY_API_URL as string | undefined)?.replace(/\/$/, '');
const keyServiceTimeout = () => AbortSignal.timeout(15_000);

export type KeyRequestPurpose = 'individual' | 'room_host';
export const PRODUCT_SR25519_SIGNATURE_SCHEME = 'product-sr25519-v1';
export const LEGACY_CONTENT_KEY_VERSION = 'dotify-content-key-v1';
export const RELEASE_BOUND_CONTENT_KEY_VERSION = 'dotify-content-key-v2';
export type ContentKeyVersion = `dotify-content-key-v${number}`;

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

export type DotifySignatureHex = `0x${string}`;

export type Eip191KeyRequestSigner = {
  signatureScheme?: 'eip191';
  address: `0x${string}`;
  signMessage: (message: string) => Promise<DotifySignatureHex>;
};

export type ProductKeyRequestSigner = {
  signatureScheme: typeof PRODUCT_SR25519_SIGNATURE_SCHEME;
  address: `0x${string}`;
  productPublicKey: `0x${string}`;
  signMessage: (message: string) => Promise<DotifySignatureHex>;
};

export type KeyRequestSigner = Eip191KeyRequestSigner | ProductKeyRequestSigner;
export type DotifySessionIdentity =
  | Pick<Eip191KeyRequestSigner, 'address' | 'signatureScheme'>
  | Pick<ProductKeyRequestSigner, 'address' | 'signatureScheme' | 'productPublicKey'>;

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
    signal: keyServiceTimeout(),
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
  walletClient?: WalletClient;
  signer?: KeyRequestSigner;
  chainId: number;
  release?: ContentKeyReleaseIdentity;
};

export type ContentKeyReleaseIdentity = {
  releaseId: string;
  runtimeAddress: `0x${string}`;
  artistAddress: `0x${string}`;
  audioRef: string;
  keyVersion: ContentKeyVersion;
};

// ---------------------------------------------------------------------------
// Session: sign once, listen freely (ticket 24 P2).
//
// One SIWE-style signature opens a ~24h session; the token (identity only,
// never access) then rides every key request instead of a fresh signature.
// The backend re-checks the on-chain policy per track on every request.
// ---------------------------------------------------------------------------

const sessionCache = createSessionCache(API_URL ?? '');
let sessionCapability: { available: boolean; expiresAt: number } | null = null;
const sessionRequests = new Map<string, Promise<string | null>>();
const sessionEpochs = new Map<string, number>();
// An exchange failure after wallet approval must not turn playback retries
// into repeated prompts. Explicit sign-in or disconnect clears this latch.
const interruptedSignIns = new Map<string, { address: string; error: KeyServiceError }>();
const RENEWABLE_SESSION_CODES = new Set(['SESSION_EXPIRED', 'SESSION_REVOKED', 'SESSION_RESTARTED']);
function sessionUnavailable(): KeyServiceError {
  return new KeyServiceError('Listening sessions are temporarily unavailable. Please try again shortly.', 'SESSION_UNAVAILABLE');
}
function sessionScope(signer: DotifySessionIdentity, chainId: number): SessionScope {
  return {
    address: signer.address,
    chainId,
    identity: signer.signatureScheme === PRODUCT_SR25519_SIGNATURE_SCHEME ? `${signer.signatureScheme}:${signer.productPublicKey}` : 'eip191'
  };
}

function toWalletSigner(walletClient: WalletClient): KeyRequestSigner | null {
  const account = walletClient.account;
  if (!account) return null;

  return {
    address: account.address,
    signMessage: message => walletClient.signMessage({ account, message })
  };
}

function resolveRequestSigner(request: ContentKeyRequest): KeyRequestSigner | null {
  if (request.signer) return request.signer;
  if (request.walletClient) return toWalletSigner(request.walletClient);
  return null;
}

type ProductSignatureRequestFields = {
  signatureScheme: typeof PRODUCT_SR25519_SIGNATURE_SCHEME;
  productPublicKey: `0x${string}`;
};

function productSignatureFields(signer: KeyRequestSigner): Partial<ProductSignatureRequestFields> {
  if (signer.signatureScheme !== PRODUCT_SR25519_SIGNATURE_SCHEME) return {};
  return {
    signatureScheme: PRODUCT_SR25519_SIGNATURE_SCHEME,
    productPublicKey: signer.productPublicKey
  };
}

function isProductKeyRequestSigner(signer: KeyRequestSigner): signer is ProductKeyRequestSigner {
  return signer.signatureScheme === PRODUCT_SR25519_SIGNATURE_SCHEME;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function keyRequestSmokeFields(
  signer: KeyRequestSigner,
  chainId: number,
  input: Omit<ProductHostKeySmokeMetric, 'signatureScheme' | 'address' | 'productPublicKey' | 'chainId' | 'timestamp'>
): void {
  if (!isProductKeyRequestSigner(signer)) return;
  publishProductHostKeySmokeMetric({
    signatureScheme: PRODUCT_SR25519_SIGNATURE_SCHEME,
    address: signer.address,
    productPublicKey: signer.productPublicKey,
    chainId,
    timestamp: Date.now(),
    ...input
  });
}

function publishProductKeyResponseSmoke(input: {
  signer: KeyRequestSigner;
  chainId: number;
  contentHash: `0x${string}`;
  purpose: KeyRequestPurpose;
  path: ProductHostKeySmokeMetric['path'];
  response: ContentKeyResponse;
}): void {
  keyRequestSmokeFields(input.signer, input.chainId, {
    phase: input.response.access === 'allowed' ? 'key-allowed' : 'key-denied',
    path: input.path,
    contentHash: input.contentHash,
    purpose: input.purpose,
    access: input.response.access,
    ...(input.response.access === 'allowed' ? { playbackMode: input.response.playbackMode, runtime: input.response.runtime } : { code: input.response.reason })
  });
}

export function clearStoredSession(address: string, expectedToken?: string): void {
  sessionCache.clear(address, expectedToken);
}

/** Reuse only the session for this exact account, chain, and signing identity. */
export function existingDotifySession(identity: DotifySessionIdentity, chainId: number): string | null {
  return sessionCache.read(sessionScope(identity, chainId))?.token ?? null;
}

async function isDotifySessionAvailable(): Promise<boolean> {
  if (!API_URL) return false;
  if (sessionCapability && sessionCapability.expiresAt > Date.now()) return sessionCapability.available;

  const res = await fetch(`${API_URL}/api/auth/session`, { method: 'GET', signal: keyServiceTimeout() });
  if (res.ok) {
    sessionCapability = { available: true, expiresAt: Date.now() + 60_000 };
    return true;
  }
  const { message, code } = await parseError(res, 'Listening is temporarily unavailable. Please try again shortly.');
  if (res.status === 404 || (res.status === 503 && code === 'SESSION_NOT_CONFIGURED')) {
    sessionCapability = { available: false, expiresAt: Date.now() + 30_000 };
    return false;
  }
  // A proxy/network 503 is not evidence that sessions are unsupported. Do not
  // turn an outage into wallet prompts; the next explicit attempt rechecks.
  sessionCapability = null;
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
 * A configured backend must support sessions. Missing/unavailable session
 * auth fails closed without a per-track signature.
 */
async function openDotifySessionForSigner(signer: KeyRequestSigner, chainId: number, epoch: number): Promise<string | null> {
  if (!API_URL) return null;

  const isCurrent = () => (sessionEpochs.get(signer.address.toLowerCase()) ?? 0) === epoch;
  const assertCurrent = () => {
    if (!isCurrent()) throw new KeyServiceError('Listening session cancelled after disconnect.', 'SESSION_CANCELLED');
  };
  const scope = sessionScope(signer, chainId);
  const stored = sessionCache.read(scope);
  if (stored) return stored.token;
  try {
    if (!(await isDotifySessionAvailable())) {
      keyRequestSmokeFields(signer, chainId, { phase: 'session-unavailable', path: 'session' });
      throw sessionUnavailable();
    }
  } catch (error) {
    keyRequestSmokeFields(signer, chainId, {
      phase: 'session-error',
      path: 'session',
      code: error instanceof KeyServiceError ? error.code : 'SESSION_CAPABILITY_ERROR',
      error: errorText(error)
    });
    throw error;
  }

  let smokePublished = false;
  let approved = false;
  try {
    const { nonce, expiresAt } = await requestNonce(signer.address, chainId);
    assertCurrent();
    const signature = await signer.signMessage(buildSignInMessage({ requester: signer.address, chainId, nonce, expiresAt }));
    approved = true;
    assertCurrent();

    const res = await fetch(`${API_URL}/api/auth/session`, {
      method: 'POST',
      signal: keyServiceTimeout(),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: signer.address,
        signature,
        nonce,
        chainId,
        expiresAt,
        ...productSignatureFields(signer)
      })
    });

    // A missing session route fails closed. Never replace SIGN_IN with a
    // second, per-track signature.
    if (res.status === 404) {
      sessionCapability = { available: false, expiresAt: Date.now() + 30_000 };
      smokePublished = true;
      keyRequestSmokeFields(signer, chainId, { phase: 'session-unavailable', path: 'session', status: res.status });
      throw sessionUnavailable();
    }
    if (!res.ok) {
      sessionCapability = null;
      const { message, code } = await parseError(res, `Sign-in failed (${res.status})`);
      smokePublished = true;
      keyRequestSmokeFields(signer, chainId, { phase: 'session-rejected', path: 'session', status: res.status, code, error: message });
      throw new KeyServiceError(message, code);
    }

    const body = (await res.json()) as { sessionToken: string; expiresAt: string };
    if (!isCurrent()) {
      await revokeSession(body.sessionToken);
      assertCurrent();
    }
    sessionCache.store(scope, { token: body.sessionToken, expiresAt: body.expiresAt });
    interruptedSignIns.delete(sessionCache.keyFor(scope));
    keyRequestSmokeFields(signer, chainId, { phase: 'session-created', path: 'session' });
    return body.sessionToken;
  } catch (error) {
    if (approved && isCurrent()) {
      interruptedSignIns.set(sessionCache.keyFor(scope), {
        address: signer.address.toLowerCase(),
        error: new KeyServiceError(
          'Your listening sign-in could not be completed. Reconnect your account to confirm a new session.',
          'SESSION_SIGN_IN_INTERRUPTED'
        )
      });
    }
    if (!smokePublished) {
      keyRequestSmokeFields(signer, chainId, {
        phase: 'session-error',
        path: 'session',
        code: error instanceof KeyServiceError ? error.code : 'SESSION_SIGNING_ERROR',
        error: errorText(error)
      });
    }
    throw error;
  }
}

/** Reuse one in-flight SIGN_IN request across simultaneous artist uploads. */
export async function ensureDotifySessionForSigner(signer: KeyRequestSigner, chainId: number): Promise<string | null> {
  interruptedSignIns.delete(sessionCache.keyFor(sessionScope(signer, chainId)));
  return getOrCreateDotifySession(signer, chainId);
}

async function getOrCreateDotifySession(signer: KeyRequestSigner, chainId: number): Promise<string | null> {
  const interrupted = interruptedSignIns.get(sessionCache.keyFor(sessionScope(signer, chainId)));
  if (interrupted) throw interrupted.error;
  const epoch = sessionEpochs.get(signer.address.toLowerCase()) ?? 0;
  const key = `${sessionCache.keyFor(sessionScope(signer, chainId))}:${epoch}`;
  const pending = sessionRequests.get(key);
  if (pending) return pending;

  const request = openDotifySessionForSigner(signer, chainId, epoch).then(token => {
    if ((sessionEpochs.get(signer.address.toLowerCase()) ?? 0) !== epoch) {
      throw new KeyServiceError('Listening session cancelled after disconnect.', 'SESSION_CANCELLED');
    }
    return token;
  });
  sessionRequests.set(key, request);
  try {
    return await request;
  } finally {
    if (sessionRequests.get(key) === request) sessionRequests.delete(key);
  }
}

export async function ensureDotifySession(walletClient: WalletClient, chainId: number): Promise<string | null> {
  const signer = toWalletSigner(walletClient);
  return signer ? ensureDotifySessionForSigner(signer, chainId) : null;
}

/** Sign out: revoke the session server-side and forget the stored token. */
export async function signOutOfDotifySession(address: string): Promise<void> {
  const key = address.toLowerCase();
  sessionEpochs.set(key, (sessionEpochs.get(key) ?? 0) + 1);
  for (const [scope, interrupted] of interruptedSignIns) {
    if (interrupted.address === key) interruptedSignIns.delete(scope);
  }
  const stored = sessionCache.clear(address);
  await Promise.all(stored.map(session => revokeSession(session.token)));
}

async function revokeSession(token: string): Promise<void> {
  if (!API_URL) return;
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      signal: keyServiceTimeout(),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: token })
    });
  } catch {
    // Best-effort: the local token is already gone and the server token expires.
  }
}

function releaseIdentityRequestFields(release: ContentKeyReleaseIdentity | undefined): Record<string, string> {
  if (!release) return {};
  return {
    releaseId: release.releaseId,
    runtimeAddress: release.runtimeAddress,
    artistAddress: release.artistAddress,
    audioRef: release.audioRef,
    keyVersion: release.keyVersion
  };
}

async function requestKeyWithSession(
  contentHash: `0x${string}`,
  purpose: KeyRequestPurpose,
  sessionToken: string,
  release: ContentKeyReleaseIdentity | undefined
): Promise<Response> {
  return fetch(`${API_URL}/api/tracks/${contentHash}/key-request`, {
    method: 'POST',
    signal: keyServiceTimeout(),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken, purpose, ...releaseIdentityRequestFields(release) })
  });
}

/** Session tokens only: per-track requests never sign an authorization. */
export async function requestContentKey(request: ContentKeyRequest): Promise<ContentKeyResponse> {
  if (!API_URL) throw new KeyServiceError('Backend key service is not configured.', 'KEY_SERVICE_NOT_CONFIGURED');
  const signer = resolveRequestSigner(request);
  if (!signer) throw new KeyServiceError('Connect an account before requesting protected playback.', 'WALLET_REQUIRED');
  let token = await getOrCreateDotifySession(signer, request.chainId);
  if (!token) throw sessionUnavailable();
  try {
    let res = await requestKeyWithSession(request.contentHash, request.purpose, token, request.release);
    if (res.status === 401) {
      const failure = await parseError(res.clone(), 'Listening is temporarily unavailable.');
      // Service/proxy failures are not proof that the cached identity expired.
      if (RENEWABLE_SESSION_CODES.has(failure.code)) {
        clearStoredSession(signer.address, token);
        token = await getOrCreateDotifySession(signer, request.chainId);
        if (!token) throw sessionUnavailable();
        res = await requestKeyWithSession(request.contentHash, request.purpose, token, request.release);
      }
    }
    if (!res.ok) {
      const { message, code } = await parseError(res, 'Protected listening is temporarily unavailable. Please try again.');
      if (res.status === 401 && RENEWABLE_SESSION_CODES.has(code)) {
        clearStoredSession(signer.address, token);
        const failure = new KeyServiceError('Your listening session could not be renewed. Reconnect your account to try again.', 'SESSION_SIGN_IN_INTERRUPTED');
        interruptedSignIns.set(sessionCache.keyFor(sessionScope(signer, request.chainId)), { address: signer.address.toLowerCase(), error: failure });
        throw failure;
      }
      keyRequestSmokeFields(signer, request.chainId, {
        phase: 'key-error',
        path: 'session',
        contentHash: request.contentHash,
        purpose: request.purpose,
        status: res.status,
        code,
        error: message
      });
      throw new KeyServiceError(message, code);
    }
    const body = (await res.json()) as ContentKeyResponse;
    publishProductKeyResponseSmoke({
      signer,
      chainId: request.chainId,
      contentHash: request.contentHash,
      purpose: request.purpose,
      path: 'session',
      response: body
    });
    return body;
  } catch (error) {
    if (!(error instanceof KeyServiceError))
      keyRequestSmokeFields(signer, request.chainId, {
        phase: 'key-error',
        path: 'session',
        contentHash: request.contentHash,
        purpose: request.purpose,
        code: 'SESSION_KEY_REQUEST_ERROR',
        error: errorText(error)
      });
    throw error;
  }
}

/**
 * Request the content key for a Free track. No wallet, no signature, no
 * session: the backend verifies on-chain that the track's current access mode
 * grants access to everyone, and only then releases the key. Free must feel
 * free - a guest without a wallet can play a Free track.
 */
export async function requestFreeContentKey(contentHash: `0x${string}`, release?: ContentKeyReleaseIdentity): Promise<ContentKeyResponse> {
  if (!API_URL) {
    throw new KeyServiceError('Backend key service is not configured (VITE_DOTIFY_API_URL).', 'KEY_SERVICE_NOT_CONFIGURED');
  }

  const res = await fetch(`${API_URL}/api/tracks/${contentHash}/free-key`, {
    method: 'POST',
    signal: keyServiceTimeout(),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(releaseIdentityRequestFields(release))
  });

  if (!res.ok) {
    const { message, code } = await parseError(res, `Free key request failed (${res.status})`);
    throw new KeyServiceError(message, code);
  }

  return (await res.json()) as ContentKeyResponse;
}
