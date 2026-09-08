import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const CHAIN_ID = 420420417;
const HASH = `0x${'ab'.repeat(32)}` as const;
const RUNTIME_A = '0x1111111111111111111111111111111111111111' as const;
const RUNTIME_B = '0x2222222222222222222222222222222222222222' as const;

process.env.CONTENT_KEY_MASTER_SECRET = 'ef'.repeat(32);

const {
  LEGACY_CONTENT_KEY_VERSION,
  RELEASE_BOUND_CONTENT_KEY_VERSION,
  contentKeyVersionForAudioRef,
  deriveContentKeyBytes,
  makeReleaseBoundEncryptedAudioV2Ref
} = await import('./keyVault.js');

describe('key vault derivation scopes', () => {
  it('keeps legacy contentHash derivation byte-compatible', () => {
    const legacyString = deriveContentKeyBytes(HASH);
    const legacyScope = deriveContentKeyBytes({ contentHash: HASH, keyVersion: LEGACY_CONTENT_KEY_VERSION });

    assert.ok(legacyString);
    assert.ok(legacyScope);
    assert.deepEqual(legacyString, legacyScope);
  });

  it('derives different release-bound keys for equal hashes in different runtimes', () => {
    const keyA = deriveContentKeyBytes({
      contentHash: HASH,
      keyVersion: RELEASE_BOUND_CONTENT_KEY_VERSION,
      chainId: CHAIN_ID,
      runtimeAddress: RUNTIME_A
    });
    const keyB = deriveContentKeyBytes({
      contentHash: HASH,
      keyVersion: RELEASE_BOUND_CONTENT_KEY_VERSION,
      chainId: CHAIN_ID,
      runtimeAddress: RUNTIME_B
    });

    assert.ok(keyA);
    assert.ok(keyB);
    assert.notDeepEqual(keyA, keyB);
  });

  it('maps encrypted audio refs to their key versions', () => {
    assert.equal(contentKeyVersionForAudioRef('dotify:enc:ipfs://legacy'), LEGACY_CONTENT_KEY_VERSION);
    assert.equal(contentKeyVersionForAudioRef('dotify:enc:v2:ipfs://legacy-dav2'), LEGACY_CONTENT_KEY_VERSION);
    assert.equal(contentKeyVersionForAudioRef(makeReleaseBoundEncryptedAudioV2Ref('release-cid')), RELEASE_BOUND_CONTENT_KEY_VERSION);
    assert.equal(contentKeyVersionForAudioRef('ipfs://clear'), null);
  });
});
