// Session tokens prove a signed-in identity, never track access. Every key or
// upload authorization route performs its own authoritative policy check.
//
// Tokens are deliberately bound to a random process epoch. Dotify currently
// deploys one API instance, so a restart safely invalidates every session from
// the previous process. This gives logout durable meaning without pretending
// that an in-memory revoked-JTI map is shared across replicas. Horizontal
// scaling requires a shared session/revocation store first.

import { createHmac, hkdfSync, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { checkDotifyChainId } from './chainDomain.js';

const HKDF_INFO = 'dotify-session-token-v1';
const MIN_MASTER_SECRET_BYTES = 32;
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type SessionTokenPayload = {
  address: `0x${string}`;
  chainId: number;
  jti: string;
  epoch: string;
  iat: number;
  exp: number;
};

export type IssuedSession =
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; code: 'SESSION_NOT_CONFIGURED' | 'CHAIN_ID_MISMATCH'; reason: string };

export type SessionVerification =
  | { valid: true; address: `0x${string}`; chainId: number; jti: string }
  | {
      valid: false;
      code: 'SESSION_NOT_CONFIGURED' | 'SESSION_INVALID' | 'SESSION_EXPIRED' | 'SESSION_REVOKED' | 'SESSION_RESTARTED' | 'CHAIN_ID_MISMATCH';
      reason: string;
    };

export type SessionTokenServiceOptions = {
  epoch?: string;
  masterSecret?: () => string | undefined;
  randomId?: () => string;
};

export type SessionTokenService = {
  isConfigured: () => boolean;
  issue: (address: `0x${string}`, chainId: number, now?: number) => IssuedSession;
  verify: (token: string, now?: number) => SessionVerification;
  revoke: (token: string, now?: number) => boolean;
};

function deriveHmacKey(secretValue: string | undefined): Buffer | null {
  if (!secretValue) return null;
  const hex = secretValue.trim().replace(/^0x/, '');
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const ikm = Buffer.from(hex, 'hex');
  if (ikm.length < MIN_MASTER_SECRET_BYTES) return null;
  return Buffer.from(hkdfSync('sha256', ikm, Buffer.alloc(0), HKDF_INFO, 32));
}

function b64url(data: Buffer | string): string {
  return Buffer.from(data).toString('base64url');
}

function sign(payloadB64: string, key: Buffer): string {
  return createHmac('sha256', key).update(payloadB64).digest('base64url');
}

export function createSessionTokenService(options: SessionTokenServiceOptions = {}): SessionTokenService {
  const epoch = options.epoch ?? randomUUID();
  const masterSecret = options.masterSecret ?? (() => config.CONTENT_KEY_MASTER_SECRET);
  const randomId = options.randomId ?? randomUUID;
  const revokedJtis = new Map<string, number>();

  function tokenHmacKey(): Buffer | null {
    return deriveHmacKey(masterSecret());
  }

  function pruneRevoked(now: number): void {
    for (const [jti, exp] of revokedJtis) {
      if (exp <= now) revokedJtis.delete(jti);
    }
  }

  function verify(token: string, now = Date.now()): SessionVerification {
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
      typeof payload.epoch !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return { valid: false, code: 'SESSION_INVALID', reason: 'Session token payload is missing required claims.' };
    }

    const domain = checkDotifyChainId(payload.chainId);
    if (!domain.ok) return { valid: false, code: domain.code, reason: domain.reason };
    if (payload.exp <= now) return { valid: false, code: 'SESSION_EXPIRED', reason: 'Session has expired. Sign in again.' };
    if (payload.epoch !== epoch) {
      return { valid: false, code: 'SESSION_RESTARTED', reason: 'The API restarted and invalidated earlier sessions. Sign in again.' };
    }
    if (revokedJtis.has(payload.jti)) return { valid: false, code: 'SESSION_REVOKED', reason: 'Session has been signed out.' };
    return { valid: true, address: payload.address, chainId: payload.chainId, jti: payload.jti };
  }

  return {
    isConfigured: () => tokenHmacKey() !== null,
    issue(address, chainId, now = Date.now()) {
      const domain = checkDotifyChainId(chainId);
      if (!domain.ok) return domain;
      const key = tokenHmacKey();
      if (!key) {
        return { ok: false, code: 'SESSION_NOT_CONFIGURED', reason: 'Session auth is unavailable: the key service master secret is not configured.' };
      }

      const payload: SessionTokenPayload = {
        address: address.toLowerCase() as `0x${string}`,
        chainId,
        jti: randomId(),
        epoch,
        iat: now,
        exp: now + SESSION_TTL_MS
      };
      const payloadB64 = b64url(JSON.stringify(payload));
      return { ok: true, token: `${payloadB64}.${sign(payloadB64, key)}`, expiresAt: new Date(payload.exp).toISOString() };
    },
    verify,
    revoke(token, now = Date.now()) {
      const verified = verify(token, now);
      if (!verified.valid) return false;
      pruneRevoked(now);
      const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')) as SessionTokenPayload;
      revokedJtis.set(verified.jti, payload.exp);
      return true;
    }
  };
}

const sessionTokenService = createSessionTokenService();

export function isSessionAuthConfigured(): boolean {
  return sessionTokenService.isConfigured();
}

export function issueSessionToken(address: `0x${string}`, chainId: number, now = Date.now()): IssuedSession {
  return sessionTokenService.issue(address, chainId, now);
}

export function verifySessionToken(token: string, now = Date.now()): SessionVerification {
  return sessionTokenService.verify(token, now);
}

export function revokeSessionToken(token: string, now = Date.now()): boolean {
  return sessionTokenService.revoke(token, now);
}
