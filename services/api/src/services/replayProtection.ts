// Replay protection for wallet-signed content-key requests.
//
// Every nonce is single-use, bound to the requesting address and chain ID,
// and expires after NONCE_TTL_MS. A signature over a consumed or expired
// nonce is rejected, which is what makes captured signatures worthless.
//
// Security boundary: this store is in-memory. A process restart invalidates
// outstanding nonces (clients simply request a new one), and a multi-instance
// deployment needs a shared store (Redis or similar) before horizontal
// scaling. Both limitations fail closed: an unknown nonce is always rejected.

import { randomBytes } from 'node:crypto';

export const NONCE_TTL_MS = 5 * 60 * 1000;

type NonceRecord = {
  address: string;
  chainId: number;
  expiresAtMs: number;
  used: boolean;
};

export type IssuedNonce = {
  nonce: string;
  expiresAt: string;
};

export type NonceConsumption =
  | { ok: true }
  | {
      ok: false;
      code: 'NONCE_UNKNOWN' | 'NONCE_REUSED' | 'NONCE_EXPIRED' | 'NONCE_ADDRESS_MISMATCH' | 'NONCE_CHAIN_MISMATCH';
      reason: string;
    };

const nonces = new Map<string, NonceRecord>();

function sweepExpired(now: number): void {
  for (const [nonce, record] of nonces) {
    if (record.expiresAtMs <= now) nonces.delete(nonce);
  }
}

/** Issue a fresh single-use nonce bound to `address` and `chainId`. */
export function issueNonce(address: string, chainId: number): IssuedNonce {
  const now = Date.now();
  sweepExpired(now);

  const nonce = randomBytes(24).toString('hex');
  const expiresAtMs = now + NONCE_TTL_MS;
  nonces.set(nonce, {
    address: address.toLowerCase(),
    chainId,
    expiresAtMs,
    used: false
  });

  return { nonce, expiresAt: new Date(expiresAtMs).toISOString() };
}

/**
 * Consume a nonce for `address` and `chainId`. Succeeds at most once per
 * nonce. Unknown, expired, reused, address-mismatched, or chain-mismatched
 * nonces are rejected.
 */
export function consumeNonce(nonce: string, address: string, chainId: number): NonceConsumption {
  const now = Date.now();
  const record = nonces.get(nonce);

  if (!record) {
    return { ok: false, code: 'NONCE_UNKNOWN', reason: 'Nonce was never issued or has been pruned. Request a new challenge.' };
  }
  if (record.expiresAtMs <= now) {
    nonces.delete(nonce);
    return { ok: false, code: 'NONCE_EXPIRED', reason: 'Nonce has expired. Request a new challenge.' };
  }
  if (record.used) {
    return { ok: false, code: 'NONCE_REUSED', reason: 'Nonce has already been used. Request a new challenge.' };
  }
  if (record.address !== address.toLowerCase()) {
    return { ok: false, code: 'NONCE_ADDRESS_MISMATCH', reason: 'Nonce was issued to a different address.' };
  }
  if (record.chainId !== chainId) {
    return { ok: false, code: 'NONCE_CHAIN_MISMATCH', reason: 'Nonce was issued for a different network. Request a new challenge.' };
  }

  record.used = true;
  return { ok: true };
}

/** Test hook: drop all nonce state. */
export function resetNonceStore(): void {
  nonces.clear();
}
