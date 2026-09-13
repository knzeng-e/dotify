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
  deriveContentKey,
  deriveContentKeyBytes,
  getActiveContentKeyVersion,
  getContentKeyVaultStatus,
  makeReleaseBoundEncryptedAudioV2Ref
} = await import('./keyVault.js');
const { decryptAudioV2Container, encryptAudioV2Container } = await import('./audioV2.js');

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
    assert.equal(contentKeyVersionForAudioRef(makeReleaseBoundEncryptedAudioV2Ref('rotated-cid', 'dotify-content-key-v3')), 'dotify-content-key-v3');
    assert.equal(contentKeyVersionForAudioRef('ipfs://clear'), null);
  });

  it('keeps legacy ciphertext readable after adding a new active key version', () => {
    const legacySecret = '11'.repeat(32);
    const rotatedSecret = '22'.repeat(32);
    const activeV3 = 'dotify-content-key-v3';
    const restoredConfig = {
      contentKeyMasterSecret: legacySecret,
      contentKeyMasterSecrets: JSON.stringify({ [activeV3]: rotatedSecret }),
      contentKeyActiveVersion: activeV3,
      chainId: CHAIN_ID
    };

    const plaintext = Buffer.from('synthetic W07 recovery audio');
    const legacyKey = deriveContentKeyBytes(HASH, { contentKeyMasterSecret: legacySecret });
    assert.ok(legacyKey);
    const legacyCiphertext = encryptAudioV2Container(plaintext, legacyKey, { contentHash: HASH, mediaMime: 'audio/mpeg', chunkSize: 8 });

    const restoredLegacyKey = deriveContentKeyBytes({ contentHash: HASH, keyVersion: LEGACY_CONTENT_KEY_VERSION }, restoredConfig);
    assert.ok(restoredLegacyKey);
    assert.deepEqual(decryptAudioV2Container(legacyCiphertext, restoredLegacyKey), plaintext);

    const newKey = deriveContentKeyBytes({
      contentHash: HASH,
      keyVersion: activeV3,
      chainId: CHAIN_ID,
      runtimeAddress: RUNTIME_A
    }, restoredConfig);
    const oldReleaseBoundKey = deriveContentKeyBytes({
      contentHash: HASH,
      keyVersion: RELEASE_BOUND_CONTENT_KEY_VERSION,
      chainId: CHAIN_ID,
      runtimeAddress: RUNTIME_A
    }, restoredConfig);
    assert.ok(newKey);
    assert.ok(oldReleaseBoundKey);
    assert.notDeepEqual(newKey, oldReleaseBoundKey);

    const newCiphertext = encryptAudioV2Container(plaintext, newKey, { contentHash: HASH, mediaMime: 'audio/mpeg', chunkSize: 8 });
    assert.deepEqual(decryptAudioV2Container(newCiphertext, newKey), plaintext);
    assert.throws(() => decryptAudioV2Container(newCiphertext, oldReleaseBoundKey));
    assert.equal(getActiveContentKeyVersion(restoredConfig), activeV3);
    assert.equal(makeReleaseBoundEncryptedAudioV2Ref('new-cid', getActiveContentKeyVersion(restoredConfig)), 'dotify:enc:v2:key-v3:ipfs://new-cid');
  });

  it('fails clearly when a requested retained key version is missing', () => {
    const result = deriveContentKey(
      {
        contentHash: HASH,
        keyVersion: 'dotify-content-key-v3',
        chainId: CHAIN_ID,
        runtimeAddress: RUNTIME_A
      },
      { contentKeyMasterSecret: '33'.repeat(32) }
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'KEY_VERSION_NOT_CONFIGURED');
      assert.match(result.reason, /dotify-content-key-v3/);
    }
  });

  it('reports key vault status without exposing secret material', () => {
    const secretV1V2 = '44'.repeat(32);
    const secretV3 = '55'.repeat(32);
    const status = getContentKeyVaultStatus({
      contentKeyMasterSecret: secretV1V2,
      contentKeyMasterSecrets: JSON.stringify({ 'dotify-content-key-v3': secretV3 }),
      contentKeyActiveVersion: 'dotify-content-key-v3'
    });

    assert.equal(status.configured, true);
    assert.deepEqual(status.configuredVersions, [
      LEGACY_CONTENT_KEY_VERSION,
      RELEASE_BOUND_CONTENT_KEY_VERSION,
      'dotify-content-key-v3'
    ]);
    const serialized = JSON.stringify(status);
    assert.equal(serialized.includes(secretV1V2), false);
    assert.equal(serialized.includes(secretV3), false);
  });

  it('marks retained-version configuration errors as unhealthy even when the active secret is valid', () => {
    const status = getContentKeyVaultStatus({
      contentKeyMasterSecrets: JSON.stringify({
        'dotify-content-key-v3': 'not-hex',
        'dotify-content-key-v4': '66'.repeat(32)
      }),
      contentKeyActiveVersion: 'dotify-content-key-v4'
    });

    assert.equal(status.configured, false);
    assert.deepEqual(status.configuredVersions, [
      LEGACY_CONTENT_KEY_VERSION,
      RELEASE_BOUND_CONTENT_KEY_VERSION,
      'dotify-content-key-v4'
    ]);
    assert.match(status.errors.join('\n'), /dotify-content-key-v3/);
  });
});
