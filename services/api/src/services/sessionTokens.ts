// Session tokens: sign once, listen freely (ticket 24 P2).
//
// A user signs one SIWE-style message; this module then issues a short-lived
// bearer token bound to their address. Later key requests carry the token
// instead of a fresh wallet signature, and the key route re-checks the
// on-chain access policy on every request - the token only proves "this is
// the address that signed in", never "this address has access".
//
// Format: base64url(JSON payload) . base64url(HMAC-SHA256(payload))
// The HMAC key is derived from CONTENT_KEY_MASTER_SECRET via HKDF with a
// dedicated info label, so content keys and token keys never share bytes and
// no new secret has to be provisioned. No JWT library: the shape is a strict
// two-part token with exactly the claims below, verified with a
// constant-time comparison.
//
// Boundaries, stated plainly:
// - A stolen token can fetch keys only for tracks its address already has
//   access to, and only until expiry or revocation.
// - Revocation is an in-memory jti blocklist: it survives for the process
//   lifetime, which matches the single-instance deployment of this service.
//   A multi-instance deployment needs a shared store before P2 scales out.
// - If the master secret is not configured, session auth is unavailable and
//   callers must use the per-request signed path (fail closed, not open).

import { createHmac, hkdfSync, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { checkDotifyChainId } from './chainDomain.js';

const HKDF_INFO = 'dotify-session-token-v1';
const MIN_MASTER_SECRET_BYTES = 32;
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type SessionTokenPayload = {
  address: `0x${string}`;
  chainId: number;
  jti: string;
  iat: number; // unix ms
  exp: number; // unix ms
};

export type IssuedSession =
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; code: 'SESSION_NOT_CONFIGURED' | 'CHAIN_ID_MISMATCH'; reason: string };

export type SessionVerification =
  | { valid: true; address: `0x${string}`; chainId: number; jti: string }
  | {
      valid: false;
      code: 'SESSION_NOT_CONFIGURED' | 'SESSION_INVALID' | 'SESSION_EXPIRED' | 'SESSION_REVOKED' | 'CHAIN_ID_MISMATCH';
      reason: string;
    };

// jti -> exp (ms). Pruned lazily on writes so it cannot grow past the set of
// still-live revoked sessions.
const revokedJtis = new Map<string, number>();

function tokenHmacKey(): Buffer | null {
  const secret = config.CONTENT_KEY_MASTER_SECRET;
  if (!secret) return null;
  const hex = secret.trim().replace(/^0x/, '');
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const ikm = Buffer.from(hex, 'hex');
  if (ikm.length < MIN_MASTER_SECRET_BYTES) return null;
  return Buffer.from(hkdfSync('sha256', ikm, Buffer.alloc(0), HKDF_INFO, 32));
}

export function isSessionAuthConfigured(): boolean {
  return tokenHmacKey() !== null;
}

function b64url(data: Buffer | string): string {
  return Buffer.from(data).toString('base64url');
}

function sign(payloadB64: string, key: Buffer): string {
  return createHmac('sha256', key).update(payloadB64).digest('base64url');
}

function pruneRevoked(now: number): void {
  for (const [jti, exp] of revokedJtis) {
    if (exp <= now) revokedJtis.delete(jti);
  }
}

/** Issue a session token for a signed-in address. */
export function issueSessionToken(address: `0x${string}`, chainId: number, now = Date.now()): IssuedSession {
  const domain = checkDotifyChainId(chainId);
  if (!domain.ok) return domain;

  const key = tokenHmacKey();
  if (!key) {
    return { ok: false, code: 'SESSION_NOT_CONFIGURED', reason: 'Session auth is unavailable: the key service master secret is not configured.' };
  }

  const payload: SessionTokenPayload = {
    address: address.toLowerCase() as `0x${string}`,
    chainId,
    jti: randomUUID(),
    iat: now,
    exp: now + SESSION_TTL_MS
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return { ok: true, token: `${payloadB64}.${sign(payloadB64, key)}`, expiresAt: new Date(payload.exp).toISOString() };
}

/** Verify a session token: shape, HMAC (constant-time), expiry, revocation. */
export function verifySessionToken(token: string, now = Date.now()): SessionVerification {
  const key = tokenHmacKey();
  if (!key) {
    return { valid: false, code: 'SESSION_NOT_CONFIGURED', reason: 'Session auth is unavailable: the key service master secret is not configured.' };
  }

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, code: 'SESSION_INVALID', reason: 'Malformed session token.' };
  }

  const expected = Buffer.from(sign(parts[0], key), 'utf8');
  const provided = Buffer.from(parts[1], 'utf8');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return { valid: false, code: 'SESSION_INVALID', reason: 'Session token signature does not verify.' };
  }

  let payload: SessionTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as SessionTokenPayload;
  } catch {
    return { valid: false, code: 'SESSION_INVALID', reason: 'Session token payload is not valid JSON.' };
  }

  if (
    typeof payload.address !== 'string' ||
    !/^0x[0-9a-f]{40}$/.test(payload.address) ||
    typeof payload.chainId !== 'number' ||
    typeof payload.jti !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    return { valid: false, code: 'SESSION_INVALID', reason: 'Session token payload is missing required claims.' };
  }

  const domain = checkDotifyChainId(payload.chainId);
  if (!domain.ok) {
    return { valid: false, code: domain.code, reason: domain.reason };
  }

  if (payload.exp <= now) {
    return { valid: false, code: 'SESSION_EXPIRED', reason: 'Session has expired. Sign in again.' };
  }

  if (revokedJtis.has(payload.jti)) {
    return { valid: false, code: 'SESSION_REVOKED', reason: 'Session has been signed out.' };
  }

  return { valid: true, address: payload.address, chainId: payload.chainId, jti: payload.jti };
}

/** Revoke a session (logout). Verifies first so garbage cannot fill the blocklist. */
export function revokeSessionToken(token: string, now = Date.now()): boolean {
  const verified = verifySessionToken(token, now);
  if (!verified.valid) return false;
  pruneRevoked(now);
  // Keep the jti until its natural expiry; after that verify rejects on exp.
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as SessionTokenPayload;
  revokedJtis.set(verified.jti, payload.exp);
  return true;
}
