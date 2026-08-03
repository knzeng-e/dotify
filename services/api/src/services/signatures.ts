// Wallet-signed request verification.
//
// The signed payload is a structured, domain-bound text message that binds:
// app, action, purpose, content hash, requester address, chain ID, nonce,
// and expiry. The same canonical format is reproduced by the frontend client
// (web/src/services/keyService.ts); any drift between the two breaks
// verification, which fails closed.
//
// Security boundary: standalone wallets use EIP-191 instead of EIP-712 for
// the first production spine because it is supported uniformly across the
// wallets we target. Product-host requests sign the same canonical message
// bytes with the app-scoped Product account and must prove that account's
// public key derives to the requester H160 used by runtime access checks.
// The message is structured and domain-bound, so it cannot be replayed
// against another app, chain, purpose, or track.

import { keccak_256 } from '@noble/hashes/sha3';
import { verify as verifySr25519Signature } from '@scure/sr25519';
import { verifyMessage } from 'viem';
import { config } from '../config.js';
import { checkDotifyChainId } from './chainDomain.js';
import { consumeNonce, issueNonce } from './replayProtection.js';

// 'room_listener' deliberately does not exist: room listeners never receive
// content keys, they only receive the host's ephemeral WebRTC stream.
export type KeyRequestPurpose = 'individual' | 'room_host';
export type SignedAction = 'REQUEST_CONTENT_KEY' | 'SIGN_IN';
export const EIP191_SIGNATURE_SCHEME = 'eip191';
export const PRODUCT_SR25519_SIGNATURE_SCHEME = 'product-sr25519-v1';
export type SignatureScheme = typeof EIP191_SIGNATURE_SCHEME | typeof PRODUCT_SR25519_SIGNATURE_SCHEME;

const PRODUCT_PUBLIC_KEY_BYTES = 32;
const PRODUCT_SR25519_SIGNATURE_BYTES = 64;
const H160_BYTES = 20;
const EVM_DERIVED_MARKER = 0xee;

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

export type Eip191SignatureFields = {
  signatureScheme?: typeof EIP191_SIGNATURE_SCHEME;
  signature: string;
};

export type ProductSr25519SignatureFields = {
  signatureScheme: typeof PRODUCT_SR25519_SIGNATURE_SCHEME;
  signature: string;
  productPublicKey: string;
};

export type SignatureFields = Eip191SignatureFields | ProductSr25519SignatureFields;
export type KeySignatureRequest = SignedRequestPayload & SignatureFields;
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

export type SignInRequest = SignInPayload & SignatureFields;

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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function fixedHexToBytes(hex: string, expectedBytes: number): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length !== expectedBytes * 2 || !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error(`Expected ${expectedBytes} bytes of hex`);
  }
  return new Uint8Array(Buffer.from(clean, 'hex'));
}

/**
 * Match Product SDK / pallet-revive AccountId32 -> H160 derivation:
 * native Substrate accounts use keccak256(publicKey), last 20 bytes; accounts
 * already derived from H160 strip the trailing 0xee padding.
 */
export function deriveProductAccountH160(publicKey: Uint8Array): `0x${string}` {
  if (publicKey.length !== PRODUCT_PUBLIC_KEY_BYTES) {
    throw new Error(`Expected ${PRODUCT_PUBLIC_KEY_BYTES}-byte Product public key`);
  }

  const evmDerived = publicKey.slice(H160_BYTES).every(byte => byte === EVM_DERIVED_MARKER);
  const addressBytes = evmDerived
    ? publicKey.slice(0, H160_BYTES)
    : keccak_256(publicKey).slice(PRODUCT_PUBLIC_KEY_BYTES - H160_BYTES);
  return `0x${bytesToHex(addressBytes)}`;
}

function verifyProductSr25519Payload(args: {
  requester: string;
  message: string;
  signature: string;
  productPublicKey: string | undefined;
  invalidSignatureReason: string;
}): SignatureVerification {
  if (!args.productPublicKey) {
    return {
      valid: false,
      code: 'PRODUCT_PUBLIC_KEY_REQUIRED',
      reason: 'Product signed requests must include the Product account public key.'
    };
  }

  let publicKey: Uint8Array;
  let signature: Uint8Array;
  try {
    publicKey = fixedHexToBytes(args.productPublicKey, PRODUCT_PUBLIC_KEY_BYTES);
    signature = fixedHexToBytes(args.signature, PRODUCT_SR25519_SIGNATURE_BYTES);
  } catch {
    return {
      valid: false,
      code: 'PRODUCT_SIGNATURE_INVALID',
      reason: 'Product signature payload is malformed.'
    };
  }

  const derivedRequester = deriveProductAccountH160(publicKey);
  if (derivedRequester.toLowerCase() !== args.requester.toLowerCase()) {
    return {
      valid: false,
      code: 'PRODUCT_ADDRESS_MISMATCH',
      reason: 'Product account public key does not derive to the requester H160 address.'
    };
  }

  let signatureValid = false;
  try {
    signatureValid = verifySr25519Signature(new TextEncoder().encode(args.message), signature, publicKey);
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    return { valid: false, code: 'SIGNATURE_INVALID', reason: args.invalidSignatureReason };
  }

  return { valid: true };
}

async function verifySignatureEnvelope(
  request: SignatureFields & { requester: string },
  message: string,
  invalidSignatureReason: string
): Promise<SignatureVerification> {
  const signatureScheme = request.signatureScheme ?? EIP191_SIGNATURE_SCHEME;

  if (signatureScheme === EIP191_SIGNATURE_SCHEME) {
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
      return { valid: false, code: 'SIGNATURE_INVALID', reason: invalidSignatureReason };
    }

    return { valid: true };
  }

  if (signatureScheme === PRODUCT_SR25519_SIGNATURE_SCHEME) {
    return verifyProductSr25519Payload({
      requester: request.requester,
      message,
      signature: request.signature,
      productPublicKey: 'productPublicKey' in request ? request.productPublicKey : undefined,
      invalidSignatureReason
    });
  }

  return {
    valid: false,
    code: 'SIGNATURE_SCHEME_UNSUPPORTED',
    reason: 'Signature scheme is not supported for Dotify key delivery.'
  };
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

  const signature = await verifySignatureEnvelope(
    request,
    buildSignInMessage(request),
    'Wallet signature does not match the sign-in payload.'
  );
  if (!signature.valid) {
    return signature;
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

  const signature = await verifySignatureEnvelope(
    request,
    buildSignedRequestMessage(request),
    'Wallet signature does not match the request payload.'
  );
  if (!signature.valid) {
    return signature;
  }

  const nonce = consumeNonce(request.nonce, request.requester, request.chainId);
  if (!nonce.ok) {
    return { valid: false, code: nonce.code, reason: nonce.reason };
  }

  return { valid: true };
}
