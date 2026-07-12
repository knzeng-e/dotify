import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { privateKeyToAccount } from 'viem/accounts';
import { resetNonceStore } from './replayProtection.js';
import {
  buildSignedRequestMessage,
  buildSignInMessage,
  createWalletNonceChallenge,
  verifySignInRequest,
  verifySignedRequest,
  type SignInPayload,
  type SignedRequestPayload
} from './signatures.js';

// Hardhat dev key 0; test-only, publicly known.
const signer = privateKeyToAccount('0xac0974bec39a37e36980911eda47a06fcd4ee8d3a8c4f5e1f3e4c4ce4e1c4ce4'.slice(0, 66) as `0x${string}`);

const CONTENT_HASH = `0x${'ab'.repeat(32)}` as const;
const CHAIN_ID = 420420417;

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

describe('verifySignedRequest', () => {
  beforeEach(() => {
    resetNonceStore();
  });

  it('accepts a correctly signed request', async () => {
    const { payload, signature } = await signedPayload();
    const result = await verifySignedRequest({ ...payload, signature });
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
});
