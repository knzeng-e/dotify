import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createUploadAuthorizationService } from './uploadAuthorizations.js';

const ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222' as const;
const CHAIN_ID = 420420417;

function service(overrides: Parameters<typeof createUploadAuthorizationService>[0] = {}) {
  let sequence = 0;
  return createUploadAuthorizationService({
    epoch: 'upload-process-a',
    masterSecret: () => 'ef'.repeat(32),
    randomId: () => `upload-${++sequence}`,
    authorizationTtlMs: 1_000,
    quotaWindowMs: 10_000,
    principalByteLimit: 100,
    globalByteLimit: 150,
    principalConcurrencyLimit: 1,
    globalConcurrencyLimit: 2,
    ...overrides
  });
}

function issueToken(instance: ReturnType<typeof service>, address: `0x${string}` = ADDRESS, purpose: 'audio' | 'cover' | 'metadata' = 'audio', maxBytes = 50) {
  const issued = instance.issue({ address, chainId: CHAIN_ID, purpose, maxBytes });
  if (!issued.ok) throw new Error(`Expected upload authorization, received ${issued.code}`);
  return issued.token;
}

describe('upload authorizations', () => {
  it('binds one authorization to its purpose and rejects replay', () => {
    const authorizations = service();
    const token = issueToken(authorizations);

    const wrongPurpose = authorizations.begin(token, 'cover');
    assert.equal(wrongPurpose.ok, false);
    assert.equal(!wrongPurpose.ok && wrongPurpose.code, 'UPLOAD_PURPOSE_MISMATCH');

    const started = authorizations.begin(token, 'audio');
    assert.equal(started.ok, true);
    if (!started.ok) return;
    assert.equal(started.lease.complete(40), true);

    const replayed = authorizations.begin(token, 'audio');
    assert.equal(replayed.ok, false);
    assert.equal(!replayed.ok && replayed.code, 'UPLOAD_AUTH_REPLAYED');
  });

  it('rejects expired and previous-process authorizations', () => {
    let now = 1_000;
    const first = service({ now: () => now });
    const token = issueToken(first);
    now = 2_001;
    const expired = first.begin(token, 'audio');
    assert.equal(expired.ok, false);
    assert.equal(!expired.ok && expired.code, 'UPLOAD_AUTH_EXPIRED');

    now = 1_500;
    const restarted = service({ epoch: 'upload-process-b', now: () => now });
    const oldProcess = restarted.begin(token, 'audio');
    assert.equal(oldProcess.ok, false);
    assert.equal(!oldProcess.ok && oldProcess.code, 'UPLOAD_AUTH_RESTARTED');
  });

  it('enforces principal and global byte reservations', () => {
    const authorizations = service({ principalConcurrencyLimit: 10, globalConcurrencyLimit: 10 });
    issueToken(authorizations, ADDRESS, 'audio', 80);

    const principalQuota = authorizations.issue({ address: ADDRESS, chainId: CHAIN_ID, purpose: 'cover', maxBytes: 21 });
    assert.equal(principalQuota.ok, false);
    assert.equal(!principalQuota.ok && principalQuota.code, 'UPLOAD_PRINCIPAL_QUOTA_EXCEEDED');

    issueToken(authorizations, OTHER_ADDRESS, 'audio', 70);
    const globalQuota = authorizations.issue({ address: OTHER_ADDRESS, chainId: CHAIN_ID, purpose: 'cover', maxBytes: 1 });
    assert.equal(globalQuota.ok, false);
    assert.equal(!globalQuota.ok && globalQuota.code, 'UPLOAD_GLOBAL_QUOTA_EXCEEDED');
  });

  it('releases a failed lease and enforces outstanding-upload concurrency', () => {
    const authorizations = service();
    const firstToken = issueToken(authorizations, ADDRESS, 'audio', 50);
    const first = authorizations.begin(firstToken, 'audio');
    assert.equal(first.ok, true);
    if (!first.ok) return;

    const concurrent = authorizations.issue({ address: ADDRESS, chainId: CHAIN_ID, purpose: 'cover', maxBytes: 50 });
    assert.equal(concurrent.ok, false);
    assert.equal(!concurrent.ok && concurrent.code, 'UPLOAD_PRINCIPAL_CONCURRENCY_EXCEEDED');

    first.lease.abort();
    const secondToken = issueToken(authorizations, ADDRESS, 'cover', 50);
    const retry = authorizations.begin(secondToken, 'cover');
    assert.equal(retry.ok, true);
    if (retry.ok) retry.lease.abort();
  });

  it('enforces the global outstanding-upload concurrency across artists', () => {
    const authorizations = service({ principalConcurrencyLimit: 2, globalConcurrencyLimit: 1 });
    const firstToken = issueToken(authorizations, ADDRESS, 'audio', 50);
    const first = authorizations.begin(firstToken, 'audio');
    assert.equal(first.ok, true);
    if (!first.ok) return;

    const concurrent = authorizations.issue({ address: OTHER_ADDRESS, chainId: CHAIN_ID, purpose: 'cover', maxBytes: 50 });
    assert.equal(concurrent.ok, false);
    assert.equal(!concurrent.ok && concurrent.code, 'UPLOAD_GLOBAL_CONCURRENCY_EXCEEDED');

    first.lease.abort();
    assert.equal(authorizations.issue({ address: OTHER_ADDRESS, chainId: CHAIN_ID, purpose: 'cover', maxBytes: 50 }).ok, true);
  });
});
