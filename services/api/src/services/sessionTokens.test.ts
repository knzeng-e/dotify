import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

// The token HMAC key derives from SESSION_SECRET, which the config
// module reads at import time - so set the env BEFORE dynamically importing.
process.env.SESSION_SECRET = 'ab'.repeat(32);

const { config } = await import('../config.js');
const { createSessionTokenService, issueSessionToken, verifySessionToken, revokeSessionToken, SESSION_TTL_MS } = await import('./sessionTokens.js');

const ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const CHAIN_ID = 420420417;

describe('sessionTokens', async () => {
  it('issues and verifies a token bound to the address and chain', async () => {
    const issued = await issueSessionToken(ADDRESS, CHAIN_ID);
    assert.equal(issued.ok, true);
    if (!issued.ok) return;

    const verified = await verifySessionToken(issued.token);
    assert.equal(verified.valid, true);
    if (!verified.valid) return;
    assert.equal(verified.address, ADDRESS);
    assert.equal(verified.chainId, CHAIN_ID);
  });

  it('keeps session signing independent from content-key master rotation', async () => {
    const issued = await issueSessionToken(ADDRESS, CHAIN_ID);
    assert.ok(issued.ok);
    const original = config.CONTENT_KEY_MASTER_SECRET;
    try {
      config.CONTENT_KEY_MASTER_SECRET = 'ef'.repeat(32);
      assert.equal((await verifySessionToken(issued.token)).valid, true);
    } finally {
      config.CONTENT_KEY_MASTER_SECRET = original;
    }
  });

  it('never renews a family beyond the original 24-hour sign-in window', () => {
    const service = createSessionTokenService({ masterSecret: () => 'cd'.repeat(32) });
    const start = 1_000_000;
    let current = service.issue(ADDRESS, CHAIN_ID, start);
    assert.ok(current.ok);
    for (let hour = 1; hour <= 23; hour++) {
      const next = service.renew(current.token, start + hour * 3_600_000);
      assert.ok('ok' in next && next.ok);
      current = next;
    }
    assert.equal(Date.parse(current.expiresAt), start + 24 * 3_600_000);
    const ended = service.renew(current.token, start + 24 * 3_600_000);
    assert.ok('valid' in ended && !ended.valid);
  });

  it('expires after the TTL', async () => {
    const now = 1_000_000;
    const issued = await issueSessionToken(ADDRESS, CHAIN_ID, now);
    assert.equal(issued.ok, true);
    if (!issued.ok) return;

    const stillValid = await verifySessionToken(issued.token, now + SESSION_TTL_MS - 1);
    assert.equal(stillValid.valid, true);

    const expired = await verifySessionToken(issued.token, now + SESSION_TTL_MS + 1);
    assert.equal(expired.valid, false);
    if (expired.valid) return;
    assert.equal(expired.code, 'SESSION_EXPIRED');
  });

  it('rejects a tampered payload (signature no longer matches)', async () => {
    const issued = await issueSessionToken(ADDRESS, CHAIN_ID);
    assert.equal(issued.ok, true);
    if (!issued.ok) return;

    const [payloadB64, sig] = issued.token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    payload.address = '0x2222222222222222222222222222222222222222';
    const forged = `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${sig}`;

    const verified = await verifySessionToken(forged);
    assert.equal(verified.valid, false);
    if (verified.valid) return;
    assert.equal(verified.code, 'SESSION_INVALID');
  });

  it('rejects malformed tokens without throwing', async () => {
    for (const garbage of ['', 'abc', 'a.b.c', `${Buffer.from('not-json').toString('base64url')}.deadbeef`]) {
      const verified = await verifySessionToken(garbage);
      assert.equal(verified.valid, false);
    }
  });

  it('revocation invalidates a live token; garbage cannot be revoked', async () => {
    const issued = await issueSessionToken(ADDRESS, CHAIN_ID);
    assert.equal(issued.ok, true);
    if (!issued.ok) return;

    assert.equal(await revokeSessionToken('garbage-token'), false);
    assert.equal(await revokeSessionToken(issued.token), true);

    const verified = await verifySessionToken(issued.token);
    assert.equal(verified.valid, false);
    if (verified.valid) return;
    assert.equal(verified.code, 'SESSION_REVOKED');
  });

  it('invalidates every old session after restart and accepts a fresh login', async () => {
    const masterSecret = () => 'cd'.repeat(32);
    const beforeRestart = createSessionTokenService({ epoch: 'process-a', masterSecret, randomId: () => 'session-a' });
    const issuedBeforeRestart = beforeRestart.issue(ADDRESS, CHAIN_ID, 1_000);
    assert.equal(issuedBeforeRestart.ok, true);
    if (!issuedBeforeRestart.ok) return;
    assert.equal(beforeRestart.revoke(issuedBeforeRestart.token, 2_000), true);

    const afterRestart = createSessionTokenService({ epoch: 'process-b', masterSecret, randomId: () => 'session-b' });
    const oldVerification = afterRestart.verify(issuedBeforeRestart.token, 3_000);
    assert.equal(oldVerification.valid, false);
    assert.equal(!oldVerification.valid && oldVerification.code, 'SESSION_RESTARTED');

    const issuedAfterRestart = afterRestart.issue(ADDRESS, CHAIN_ID, 3_000);
    assert.equal(issuedAfterRestart.ok, true);
    if (!issuedAfterRestart.ok) return;
    assert.equal(afterRestart.verify(issuedAfterRestart.token, 3_001).valid, true);
  });

  it('refuses to issue a session for a different chain', async () => {
    const issued = await issueSessionToken(ADDRESS, CHAIN_ID + 1);
    assert.equal(issued.ok, false);
    assert.equal(!issued.ok && issued.code, 'CHAIN_ID_MISMATCH');
  });

  it('rejects an otherwise valid session token issued for a different chain', async () => {
    const expectedChainId = config.DOTIFY_CHAIN_ID;
    config.DOTIFY_CHAIN_ID = CHAIN_ID + 1;
    try {
      const issued = await issueSessionToken(ADDRESS, CHAIN_ID + 1);
      assert.equal(issued.ok, true);
      if (!issued.ok) return;

      config.DOTIFY_CHAIN_ID = expectedChainId;
      const verified = await verifySessionToken(issued.token);
      assert.equal(verified.valid, false);
      assert.equal(!verified.valid && verified.code, 'CHAIN_ID_MISMATCH');
    } finally {
      config.DOTIFY_CHAIN_ID = expectedChainId;
    }
  });

  it('keeps sessions across a restart with a stable epoch, and keeps revocations revoked', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dotify-sessions-'));
    try {
      const revocationPath = join(directory, 'revocations.json');
      const masterSecret = () => 'cd'.repeat(32);
      const options = { epoch: 'stable-epoch-for-tests', masterSecret, revocationPath, onStorageError: () => {} };
      // Real time: loading prunes revocations that are already expired.
      const now = Date.now();
      const before = createSessionTokenService({ ...options, randomId: () => 'kept' });
      const kept = before.issue(ADDRESS, CHAIN_ID, now);
      const revoked = createSessionTokenService({ ...options, randomId: () => 'signed-out' }).issue(ADDRESS, CHAIN_ID, now);
      assert.equal(kept.ok && revoked.ok, true);
      if (!kept.ok || !revoked.ok) return;
      assert.equal(before.revoke(revoked.token, now + 1), true);

      const after = createSessionTokenService(options);
      assert.equal(after.verify(kept.token, now + 2).valid, true);
      const signedOut = after.verify(revoked.token, now + 2);
      assert.equal(!signedOut.valid && signedOut.code, 'SESSION_REVOKED');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('fails closed to a fresh epoch when the revocation file cannot be trusted', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dotify-sessions-'));
    try {
      const revocationPath = join(directory, 'revocations.json');
      const masterSecret = () => 'cd'.repeat(32);
      const errors: string[] = [];
      const options = { epoch: 'stable-epoch-for-tests', masterSecret, revocationPath, onStorageError: (message: string) => errors.push(message) };
      const issued = createSessionTokenService(options).issue(ADDRESS, CHAIN_ID, 1_000);
      assert.equal(issued.ok, true);
      if (!issued.ok) return;

      writeFileSync(revocationPath, '{not json');
      const verification = createSessionTokenService(options).verify(issued.token, 2_000);
      assert.equal(!verification.valid && verification.code, 'SESSION_RESTARTED');
      assert.equal(errors.length, 1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
