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
//
// The Product Host `signRaw` wire format is not pinned by the SDK: the
// response signature is untagged, and a Substrate host may sign a raw payload
// verbatim or inside the conventional `<Bytes>` envelope. Rather than guess
// one shape and fail every request on a wrong guess, verification accepts the
// bounded set of shapes below. Each still carries the identical domain-bound
// message, so tolerance costs no security - it only removes an unverifiable
// assumption. See docs/explanation/product-devnet-architecture.md.

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
// Substrate MultiSignature enum tag for sr25519 (0 = ed25519, 1 = sr25519).
const MULTISIGNATURE_SR25519_TAG = 0x01;

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
  release?: SignedReleaseIdentity;
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

export type SignedReleaseIdentity = {
  releaseId: string;
  runtimeAddress: string;
  artistAddress: string;
  audioRef: string;
  keyVersion: string;
};

/**
 * Canonical EIP-191 message for a Dotify signed request.
 * Must stay byte-identical with the frontend builder.
 */
export function buildSignedRequestMessage(payload: SignedRequestPayload): string {
  const lines = [
    'Dotify signed request',
    'App: Dotify',
    `Action: ${payload.action}`,
    `Purpose: ${payload.purpose}`,
    `Content Hash: ${payload.contentHash.toLowerCase()}`,
    `Requester: ${payload.requester.toLowerCase()}`,
    `Chain ID: ${payload.chainId}`,
    `Nonce: ${payload.nonce}`,
    `Expires At: ${payload.expiresAt}`
  ];
  if (payload.release) {
    lines.push(
      `Release ID: ${payload.release.releaseId.toLowerCase()}`,
      `Runtime Address: ${payload.release.runtimeAddress.toLowerCase()}`,
      `Artist Address: ${payload.release.artistAddress.toLowerCase()}`,
      `Audio Ref: ${payload.release.audioRef}`,
      `Key Version: ${payload.release.keyVersion}`
    );
  }
  return lines.join('\n');
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

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error('Expected an even-length hex string');
  }
  return new Uint8Array(Buffer.from(clean, 'hex'));
}

/**
 * The Host `signRaw` response carries an opaque signature with no scheme tag
 * (truapi `HostSignPayloadResponse.signature`). Accept the two shapes a
 * Substrate signer can return for sr25519 - a bare 64-byte signature, or a
 * 65-byte MultiSignature-tagged value - and reject everything else. The tag is
 * checked, not skipped, so an ed25519 or ECDSA signature still fails closed.
 */
function parseProductSignatureBytes(hex: string): Uint8Array {
  const bytes = hexToBytes(hex);
  if (bytes.length === PRODUCT_SR25519_SIGNATURE_BYTES) {
    return bytes;
  }
  if (bytes.length === PRODUCT_SR25519_SIGNATURE_BYTES + 1 && bytes[0] === MULTISIGNATURE_SR25519_TAG) {
    return bytes.slice(1);
  }
  throw new Error('Unsupported Product signature length');
}

/**
 * A Substrate host may sign a raw payload either verbatim or wrapped in the
 * conventional `<Bytes>...</Bytes>` envelope. Both variants carry the same
 * canonical Dotify message, which is already bound to app, action, purpose,
 * content hash, requester, chain, nonce, and expiry - so accepting either
 * envelope adds no replay surface, it only removes a guess about host
 * behaviour. Nothing outside these two shapes is accepted.
 */
function productSignedMessageVariants(message: string): Uint8Array[] {
  const encoder = new TextEncoder();
  return [encoder.encode(message), encoder.encode(`<Bytes>${message}</Bytes>`)];
}

/**
 * True when the 32-byte account id is a pallet-revive EVM-derived account
 * (a 20-byte H160 padded with 0xee). Such an account is not a native
 * sr25519 keypair, so it can never legitimately produce a Product signature.
 */
function isEvmDerivedAccountId(publicKey: Uint8Array): boolean {
  return publicKey.slice(H160_BYTES).every(byte => byte === EVM_DERIVED_MARKER);
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

  const addressBytes = isEvmDerivedAccountId(publicKey)
    ? publicKey.slice(0, H160_BYTES)
    : keccak_256(publicKey).slice(PRODUCT_PUBLIC_KEY_BYTES - H160_BYTES);
  return `0x${bytesToHex(addressBytes)}`;
}

function verifyProductSr25519Payload(args: {
  requester: string;
  message: string;
  signature: string;
  productPublicKey: string | undefined;
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
    signature = parseProductSignatureBytes(args.signature);
  } catch {
    return {
      valid: false,
      code: 'PRODUCT_SIGNATURE_INVALID',
      reason: 'Product signature payload is malformed.'
    };
  }

  // An EVM-derived account id would let a caller name any H160 as the
  // requester and lean entirely on the curve check to stop the takeover.
  // A real Product account is a native AccountId32, so reject that shape
  // before deriving anything from it.
  if (isEvmDerivedAccountId(publicKey)) {
    return {
      valid: false,
      code: 'PRODUCT_KEY_NOT_NATIVE',
      reason: 'Product signed requests require a native Product account key, not an EVM-derived account id.'
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

  const signatureValid = productSignedMessageVariants(args.message).some(payload => {
    try {
      return verifySr25519Signature(payload, signature, publicKey);
    } catch {
      return false;
    }
  });

  if (!signatureValid) {
    // Deliberately distinct from SIGNATURE_INVALID: the key parsed and derives
    // to the requester, so this is a signing-envelope or wrong-account problem,
    // not a malformed request. Operators need those apart in Fly logs.
    return {
      valid: false,
      code: 'PRODUCT_SIGNATURE_REJECTED',
      reason: 'Product host signature did not verify against the Dotify request payload in any supported signing envelope.'
    };
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
      productPublicKey: 'productPublicKey' in request ? request.productPublicKey : undefined
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
