import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { getPublicKey, secretFromSeed, sign as signSr25519 } from '@scure/sr25519';
import { privateKeyToAccount } from 'viem/accounts';
import { resetNonceStore } from './replayProtection.js';
import {
  PRODUCT_SR25519_SIGNATURE_SCHEME,
  buildSignedRequestMessage,
  buildSignInMessage,
  createWalletNonceChallenge,
  deriveProductAccountH160,
  verifySignInRequest,
  verifySignedRequest,
  type SignInPayload,
  type SignedRequestPayload
} from './signatures.js';

// Hardhat dev key 0; test-only, publicly known.
const signer = privateKeyToAccount('0xac0974bec39a37e36980911eda47a06fcd4ee8d3a8c4f5e1f3e4c4ce4e1c4ce4'.slice(0, 66) as `0x${string}`);

const CONTENT_HASH = `0x${'ab'.repeat(32)}` as const;
const CHAIN_ID = 420420417;
const productSecretKey = secretFromSeed(new Uint8Array(32).fill(7));
const productPublicKey = getPublicKey(productSecretKey);
const productPublicKeyHex = `0x${bytesToHex(productPublicKey)}` as const;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function signedPayload(overrides: Partial<SignedRequestPayload> = {}) {
  const challenge = createWalletNonceChallenge({ address: signer.address, chainId: CHAIN_ID });
  const payload: SignedRequestPayload = {
    action: 'REQUEST_CONTENT_KEY',
    purpose: 'individual',
    contentHash: CONTENT_HASH,
    requester: signer.address,
    chainId: CHAIN_ID,
    nonce: challenge.nonce,
    expiresAt: challenge.expiresAt,
    ...overrides
  };
  const signature = await signer.signMessage({ message: buildSignedRequestMessage(payload) });
  return { payload, signature };
}

async function productSignedPayload(overrides: Partial<SignedRequestPayload> = {}) {
  const requester = overrides.requester ?? deriveProductAccountH160(productPublicKey);
  const challenge = createWalletNonceChallenge({ address: requester, chainId: CHAIN_ID });
  const payload: SignedRequestPayload = {
    action: 'REQUEST_CONTENT_KEY',
    purpose: 'individual',
    contentHash: CONTENT_HASH,
    requester,
    chainId: CHAIN_ID,
    nonce: challenge.nonce,
    expiresAt: challenge.expiresAt,
    ...overrides
  };
  const signature = `0x${bytesToHex(signSr25519(productSecretKey, new TextEncoder().encode(buildSignedRequestMessage(payload))))}`;
  return { payload, signature, productPublicKey: productPublicKeyHex };
}

describe('verifySignedRequest', () => {
  beforeEach(() => {
    resetNonceStore();
  });

  it('accepts a correctly signed request', async () => {
    const { payload, signature } = await signedPayload();
    const result = await verifySignedRequest({ ...payload, signature });
    assert.equal(result.valid, true);
  });

  it('accepts a Product sr25519 request bound to the derived H160 requester', async () => {
    const { payload, signature, productPublicKey } = await productSignedPayload();
    const result = await verifySignedRequest({
      ...payload,
      signatureScheme: PRODUCT_SR25519_SIGNATURE_SCHEME,
      signature,
      productPublicKey
    });
    assert.equal(result.valid, true);
  });

  it('rejects a replayed nonce', async () => {
    const { payload, signature } = await signedPayload();
    const first = await verifySignedRequest({ ...payload, signature });
    assert.equal(first.valid, true);

    const second = await verifySignedRequest({ ...payload, signature });
    assert.equal(second.valid, false);
    assert.equal(!second.valid && second.code, 'NONCE_REUSED');
  });

  it('rejects a signature over a different content hash', async () => {
    const { payload, signature } = await signedPayload();
    const tampered = { ...payload, contentHash: `0x${'cd'.repeat(32)}`, signature };
    const result = await verifySignedRequest(tampered);
    assert.equal(result.valid, false);
    assert.equal(!result.valid && result.code, 'SIGNATURE_INVALID');
  });

  it('rejects a Product signature when the payload changes', async () => {
    const { payload, signature, productPublicKey } = await productSignedPayload();
    const result = await verifySignedRequest({
      ...payload,
      contentHash: `0x${'cd'.repeat(32)}`,
      signatureScheme: PRODUCT_SR25519_SIGNATURE_SCHEME,
      signature,
      productPublicKey
    });
    assert.equal(result.valid, false);
    assert.equal(!result.valid && result.code, 'SIGNATURE_INVALID');
  });

  it('rejects a Product public key that does not derive to the requester H160', async () => {
    const { payload, signature, productPublicKey } = await productSignedPayload({
      requester: '0x1111111111111111111111111111111111111111'
    });
    const result = await verifySignedRequest({
      ...payload,
      signatureScheme: PRODUCT_SR25519_SIGNATURE_SCHEME,
      signature,
      productPublicKey
    });
    assert.equal(result.valid, false);
    assert.equal(!result.valid && result.code, 'PRODUCT_ADDRESS_MISMATCH');
  });

  it('rejects malformed Product proof bytes before nonce consumption', async () => {
    const { payload, signature } = await productSignedPayload();
    const result = await verifySignedRequest({
      ...payload,
      signatureScheme: PRODUCT_SR25519_SIGNATURE_SCHEME,
      signature,
      productPublicKey: '0x1234'
    });
    assert.equal(result.valid, false);
    assert.equal(!result.valid && result.code, 'PRODUCT_SIGNATURE_INVALID');
  });

  it('rejects a signature over a different purpose', async () => {
    const { payload, signature } = await signedPayload({ purpose: 'individual' });
    const result = await verifySignedRequest({ ...payload, purpose: 'room_host', signature });
    assert.equal(result.valid, false);
    assert.equal(!result.valid && result.code, 'SIGNATURE_INVALID');
  });

  it('rejects a signature from a different wallet claiming the requester address', async () => {
    const other = privateKeyToAccount(`0x${'11'.repeat(32)}`);
    const challenge = createWalletNonceChallenge({ address: signer.address, chainId: CHAIN_ID });
    const payload: SignedRequestPayload = {
      action: 'REQUEST_CONTENT_KEY',
      purpose: 'individual',
      contentHash: CONTENT_HASH,
      requester: signer.address,
      chainId: CHAIN_ID,
      nonce: challenge.nonce,
      expiresAt: challenge.expiresAt
    };
    const signature = await other.signMessage({ message: buildSignedRequestMessage(payload) });
    const result = await verifySignedRequest({ ...payload, signature });
    assert.equal(result.valid, false);
    assert.equal(!result.valid && result.code, 'SIGNATURE_INVALID');
  });

  it('rejects an expired request without consuming the nonce', async () => {
    const { payload, signature } = await signedPayload({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    const result = await verifySignedRequest({ ...payload, signature });
    assert.equal(result.valid, false);
    assert.equal(!result.valid && result.code, 'EXPIRED_SESSION');
  });

  it('rejects garbage signatures without throwing', async () => {
    const { payload } = await signedPayload();
    const result = await verifySignedRequest({ ...payload, signature: '0x1234' });
    assert.equal(result.valid, false);
    assert.equal(!result.valid && result.code, 'SIGNATURE_INVALID');
  });

  it('rejects a correctly signed key request for a different chain', async () => {
    const { payload, signature } = await signedPayload({ chainId: CHAIN_ID + 1 });
    const result = await verifySignedRequest({ ...payload, signature });

    assert.equal(result.valid, false);
    assert.equal(!result.valid && result.code, 'CHAIN_ID_MISMATCH');
  });

  it('rejects a correctly signed sign-in for a different chain', async () => {
    const challenge = createWalletNonceChallenge({ address: signer.address, chainId: CHAIN_ID });
    const payload: SignInPayload = {
      requester: signer.address,
      chainId: CHAIN_ID + 1,
      nonce: challenge.nonce,
      expiresAt: challenge.expiresAt
    };
    const signature = await signer.signMessage({ message: buildSignInMessage(payload) });
    const result = await verifySignInRequest({ ...payload, signature });

    assert.equal(result.valid, false);
    assert.equal(!result.valid && result.code, 'CHAIN_ID_MISMATCH');
  });

  it('accepts a Product sr25519 sign-in bound to the derived H160 requester', async () => {
    const requester = deriveProductAccountH160(productPublicKey);
    const challenge = createWalletNonceChallenge({ address: requester, chainId: CHAIN_ID });
    const payload: SignInPayload = {
      requester,
      chainId: CHAIN_ID,
      nonce: challenge.nonce,
      expiresAt: challenge.expiresAt
    };
    const signature = `0x${bytesToHex(signSr25519(productSecretKey, new TextEncoder().encode(buildSignInMessage(payload))))}`;
    const result = await verifySignInRequest({
      ...payload,
      signatureScheme: PRODUCT_SR25519_SIGNATURE_SCHEME,
      signature,
      productPublicKey: productPublicKeyHex
    });

    assert.equal(result.valid, true);
  });

  it('matches the Product SDK H160 derivation vector for a native Substrate public key', () => {
    const alicePublicKey = new Uint8Array([
      0xd4, 0x35, 0x93, 0xc7, 0x15, 0xfd, 0xd3, 0x1c, 0x61, 0x14, 0x1a, 0xbd, 0x04, 0xa9, 0x9f,
      0xd6, 0x82, 0x2c, 0x85, 0x58, 0x85, 0x4c, 0xcd, 0xe3, 0x9a, 0x56, 0x84, 0xe7, 0xa5, 0x6d,
      0xa2, 0x7d
    ]);

    assert.equal(deriveProductAccountH160(alicePublicKey), '0x9621dde636de098b43efb0fa9b61facfe328f99d');
  });
});
