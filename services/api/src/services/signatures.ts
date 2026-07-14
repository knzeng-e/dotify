// Wallet-signed request verification (EIP-191 personal_sign).
//
// The signed payload is a structured, domain-bound text message that binds:
// app, action, purpose, content hash, requester address, chain ID, nonce,
// and expiry. The same canonical format is reproduced by the frontend client
// (web/src/services/keyService.ts); any drift between the two breaks
// verification, which fails closed.
//
// Security boundary: EIP-191 is used instead of EIP-712 for the first
// production spine because it is supported uniformly across the wallets we
// target. The message is structured and domain-bound, so it cannot be
// replayed against another app, chain, purpose, or track.

import { verifyMessage } from 'viem';
import { config } from '../config.js';
import { checkDotifyChainId } from './chainDomain.js';
import { consumeNonce, issueNonce } from './replayProtection.js';

// 'room_listener' deliberately does not exist: room listeners never receive
// content keys, they only receive the host's ephemeral WebRTC stream.
export type KeyRequestPurpose = 'individual' | 'room_host';
export type SignedAction = 'REQUEST_CONTENT_KEY' | 'SIGN_IN';

export type NonceChallengeRequest = {
  address: string;
  chainId?: number;
};

export type NonceChallenge = {
  nonce: string;
  expiresAt: string;
  chainId: number;
};

export type SignedRequestPayload = {
  action: SignedAction;
  purpose: KeyRequestPurpose;
  contentHash: string;
  requester: string;
  chainId: number;
  nonce: string;
  expiresAt: string;
};

export type KeySignatureRequest = SignedRequestPayload & {
  signature: string;
};

export type SignatureVerification = { valid: true } | { valid: false; code: string; reason: string };

/**
 * Canonical EIP-191 message for a Dotify signed request.
 * Must stay byte-identical with the frontend builder.
 */
export function buildSignedRequestMessage(payload: SignedRequestPayload): string {
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

export type SignInPayload = {
  requester: string;
  chainId: number;
  nonce: string;
  expiresAt: string;
};

export type SignInRequest = SignInPayload & {
  signature: string;
};

/**
 * Canonical EIP-191 message for the one-per-session Dotify sign-in
 * (ticket 24 P2). Must stay byte-identical with the frontend builder
 * (web/src/services/keyService.ts). Deliberately track-free: signing in
 * grants nothing by itself - every key request still passes the on-chain
 * access check for its own track.
 */
export function buildSignInMessage(payload: SignInPayload): string {
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
 * Verify a sign-in request: expiry, signature, then nonce consumption -
 * the same fail-closed order as verifySignedRequest.
 */
export async function verifySignInRequest(request: SignInRequest): Promise<SignatureVerification> {
  const domain = checkDotifyChainId(request.chainId);
  if (!domain.ok) {
    return { valid: false, code: domain.code, reason: domain.reason };
  }

  const expiresAtMs = Date.parse(request.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return { valid: false, code: 'EXPIRED_SESSION', reason: 'Sign-in challenge has expired. Request a new one.' };
  }

  let signatureValid = false;
  try {
    signatureValid = await verifyMessage({
      address: request.requester as `0x${string}`,
      message: buildSignInMessage(request),
      signature: request.signature as `0x${string}`
    });
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    return { valid: false, code: 'SIGNATURE_INVALID', reason: 'Wallet signature does not match the sign-in payload.' };
  }

  const nonce = consumeNonce(request.nonce, request.requester, request.chainId);
  if (!nonce.ok) {
    return { valid: false, code: nonce.code, reason: nonce.reason };
  }

  return { valid: true };
}

/** Issue a wallet nonce challenge bound to the address and chain. */
export function createWalletNonceChallenge(request: NonceChallengeRequest): NonceChallenge {
  // The public route rejects an explicitly wrong chain. Always issue the
  // actual challenge for the configured chain so internal callers cannot
  // accidentally mint a cross-domain nonce.
  const chainId = config.DOTIFY_CHAIN_ID;
  const issued = issueNonce(request.address, chainId);
  return { nonce: issued.nonce, expiresAt: issued.expiresAt, chainId };
}

/**
 * Verify a wallet-signed request: expiry, signature, then nonce consumption.
 * The nonce is only consumed after the signature checks out, so an attacker
 * cannot burn a victim's nonce with a garbage signature.
 */
export async function verifySignedRequest(request: KeySignatureRequest): Promise<SignatureVerification> {
  const domain = checkDotifyChainId(request.chainId);
  if (!domain.ok) {
    return { valid: false, code: domain.code, reason: domain.reason };
  }

  const expiresAtMs = Date.parse(request.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return { valid: false, code: 'EXPIRED_SESSION', reason: 'Key request has expired. Request a new challenge.' };
  }

  const message = buildSignedRequestMessage(request);

  let signatureValid = false;
  try {
    signatureValid = await verifyMessage({
      address: request.requester as `0x${string}`,
      message,
      signature: request.signature as `0x${string}`
    });
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    return { valid: false, code: 'SIGNATURE_INVALID', reason: 'Wallet signature does not match the request payload.' };
  }

  const nonce = consumeNonce(request.nonce, request.requester, request.chainId);
  if (!nonce.ok) {
    return { valid: false, code: nonce.code, reason: nonce.reason };
  }

  return { valid: true };
}
