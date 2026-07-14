import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { consumeNonce, issueNonce, resetNonceStore } from './replayProtection.js';

const ADDRESS = '0x1111111111111111111111111111111111111111';

describe('replayProtection', () => {
  beforeEach(() => {
    resetNonceStore();
  });

  it('accepts a freshly issued nonce exactly once', () => {
    const issued = issueNonce(ADDRESS, 420420417);

    const first = consumeNonce(issued.nonce, ADDRESS, 420420417);
    assert.equal(first.ok, true);

    const second = consumeNonce(issued.nonce, ADDRESS, 420420417);
    assert.equal(second.ok, false);
    assert.equal(!second.ok && second.code, 'NONCE_REUSED');
  });

  it('rejects a nonce that was never issued', () => {
    const result = consumeNonce('deadbeefdeadbeefdeadbeef', ADDRESS, 420420417);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, 'NONCE_UNKNOWN');
  });

  it('rejects a nonce issued to a different address', () => {
    const issued = issueNonce(ADDRESS, 420420417);
    const result = consumeNonce(issued.nonce, '0x2222222222222222222222222222222222222222', 420420417);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, 'NONCE_ADDRESS_MISMATCH');
  });

  it('is case-insensitive on the bound address', () => {
    const issued = issueNonce(ADDRESS.toUpperCase().replace('0X', '0x'), 420420417);
    const result = consumeNonce(issued.nonce, ADDRESS, 420420417);
    assert.equal(result.ok, true);
  });

  it('rejects a nonce on a different chain without consuming it', () => {
    const issued = issueNonce(ADDRESS, 420420417);

    const wrongChain = consumeNonce(issued.nonce, ADDRESS, 420420418);
    assert.equal(wrongChain.ok, false);
    assert.equal(!wrongChain.ok && wrongChain.code, 'NONCE_CHAIN_MISMATCH');

    const expectedChain = consumeNonce(issued.nonce, ADDRESS, 420420417);
    assert.equal(expectedChain.ok, true);
  });
});
