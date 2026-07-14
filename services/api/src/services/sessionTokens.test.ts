import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// The token HMAC key derives from CONTENT_KEY_MASTER_SECRET, which the config
// module reads at import time - so set the env BEFORE dynamically importing.
process.env.CONTENT_KEY_MASTER_SECRET = 'ab'.repeat(32);

const { config } = await import('../config.js');
const { issueSessionToken, verifySessionToken, revokeSessionToken, SESSION_TTL_MS } = await import('./sessionTokens.js');

const ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const CHAIN_ID = 420420417;

describe('sessionTokens', () => {
  it('issues and verifies a token bound to the address and chain', () => {
    const issued = issueSessionToken(ADDRESS, CHAIN_ID);
    assert.equal(issued.ok, true);
    if (!issued.ok) return;

    const verified = verifySessionToken(issued.token);
    assert.equal(verified.valid, true);
    if (!verified.valid) return;
    assert.equal(verified.address, ADDRESS);
    assert.equal(verified.chainId, CHAIN_ID);
  });

  it('expires after the TTL', () => {
    const now = 1_000_000;
    const issued = issueSessionToken(ADDRESS, CHAIN_ID, now);
    assert.equal(issued.ok, true);
    if (!issued.ok) return;

    const stillValid = verifySessionToken(issued.token, now + SESSION_TTL_MS - 1);
    assert.equal(stillValid.valid, true);

    const expired = verifySessionToken(issued.token, now + SESSION_TTL_MS + 1);
    assert.equal(expired.valid, false);
    if (expired.valid) return;
    assert.equal(expired.code, 'SESSION_EXPIRED');
  });

  it('rejects a tampered payload (signature no longer matches)', () => {
    const issued = issueSessionToken(ADDRESS, CHAIN_ID);
    assert.equal(issued.ok, true);
    if (!issued.ok) return;

    const [payloadB64, sig] = issued.token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    payload.address = '0x2222222222222222222222222222222222222222';
    const forged = `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${sig}`;

    const verified = verifySessionToken(forged);
    assert.equal(verified.valid, false);
    if (verified.valid) return;
    assert.equal(verified.code, 'SESSION_INVALID');
  });

  it('rejects malformed tokens without throwing', () => {
    for (const garbage of ['', 'abc', 'a.b.c', `${Buffer.from('not-json').toString('base64url')}.deadbeef`]) {
      const verified = verifySessionToken(garbage);
      assert.equal(verified.valid, false);
    }
  });

  it('revocation invalidates a live token; garbage cannot be revoked', () => {
    const issued = issueSessionToken(ADDRESS, CHAIN_ID);
    assert.equal(issued.ok, true);
    if (!issued.ok) return;

    assert.equal(revokeSessionToken('garbage-token'), false);
    assert.equal(revokeSessionToken(issued.token), true);

    const verified = verifySessionToken(issued.token);
    assert.equal(verified.valid, false);
    if (verified.valid) return;
    assert.equal(verified.code, 'SESSION_REVOKED');
  });

  it('refuses to issue a session for a different chain', () => {
    const issued = issueSessionToken(ADDRESS, CHAIN_ID + 1);
    assert.equal(issued.ok, false);
    assert.equal(!issued.ok && issued.code, 'CHAIN_ID_MISMATCH');
  });

  it('rejects an otherwise valid session token issued for a different chain', () => {
    const expectedChainId = config.DOTIFY_CHAIN_ID;
    config.DOTIFY_CHAIN_ID = CHAIN_ID + 1;
    try {
      const issued = issueSessionToken(ADDRESS, CHAIN_ID + 1);
      assert.equal(issued.ok, true);
      if (!issued.ok) return;

      config.DOTIFY_CHAIN_ID = expectedChainId;
      const verified = verifySessionToken(issued.token);
      assert.equal(verified.valid, false);
      assert.equal(!verified.valid && verified.code, 'CHAIN_ID_MISMATCH');
    } finally {
      config.DOTIFY_CHAIN_ID = expectedChainId;
    }
  });
});
