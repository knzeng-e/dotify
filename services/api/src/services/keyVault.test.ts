import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hkdfSync } from 'node:crypto';
import { deriveContentKeyBytes, deriveContentKey, getContentKeyVaultStatus, contentKeyVersionForAudioRef } from './keyVault.js';
const hash = `0x${'ab'.repeat(32)}`,
  runtime = `0x${'11'.repeat(20)}`;
const scope = { contentHash: hash, runtimeAddress: runtime, chainId: 420420417, keyVersion: 'dotify-content-key-v2' };
const secret = 'ef'.repeat(32);
const cfg = { contentKeyMasterSecret: secret, contentKeyMasterSecrets: '', contentKeyActiveVersion: 'dotify-content-key-v2' };
describe('release-bound key custody', () => {
  it('preserves the reviewed HKDF bytes and separates identical masters by runtime and chain', () => {
    const key = deriveContentKeyBytes(scope, cfg)!;
    assert.deepEqual(
      key,
      Buffer.from(hkdfSync('sha256', Buffer.from(secret, 'hex'), Buffer.alloc(0), Buffer.from(`${scope.keyVersion}:${scope.chainId}:${runtime}:${hash}`), 32))
    );
    assert.notDeepEqual(key, deriveContentKeyBytes({ ...scope, runtimeAddress: `0x${'22'.repeat(20)}` }, cfg));
    assert.notDeepEqual(key, deriveContentKeyBytes({ ...scope, chainId: 1 }, cfg));
    assert.equal(deriveContentKeyBytes({ ...scope, runtimeAddress: undefined }, cfg), null);
    assert.equal(deriveContentKeyBytes({ ...scope, keyVersion: 'dotify-content-key-v1' }, cfg), null);
  });
  it('retains release-bound secrets after active-version rotation, without leaking them in status', () => {
    const rotated = {
      ...cfg,
      contentKeyActiveVersion: 'dotify-content-key-v3',
      contentKeyMasterSecrets: JSON.stringify({ 'dotify-content-key-v3': '22'.repeat(32) })
    };
    assert.deepEqual(deriveContentKeyBytes(scope, cfg), deriveContentKeyBytes(scope, rotated));
    assert.notDeepEqual(deriveContentKeyBytes(scope, cfg), deriveContentKeyBytes({ ...scope, keyVersion: 'dotify-content-key-v3' }, rotated));
    const status = getContentKeyVaultStatus(rotated);
    assert.equal(status.configured, true);
    assert.deepEqual(status.configuredVersions, ['dotify-content-key-v2', 'dotify-content-key-v3']);
    assert(!JSON.stringify(status).includes(secret));
    assert.equal(deriveContentKey({ ...scope, keyVersion: 'dotify-content-key-v4' }, rotated).ok, false);
    assert.equal(getContentKeyVaultStatus({ ...rotated, contentKeyMasterSecrets: JSON.stringify({ 'dotify-content-key-v3': 'bad' }) }).configured, false);
  });
  it('recognizes only the streaming format and explicit supported key versions', () => {
    const cid = `Qm${'a'.repeat(44)}`;
    assert.equal(contentKeyVersionForAudioRef(`dotify:enc:v3:key-v2:ipfs://${cid}`), 'dotify-content-key-v2');
    for (const ref of [`dotify:enc:ipfs://${cid}`, `dotify:enc:v2:key-v2:ipfs://${cid}`, `dotify:enc:v3:key-v1:ipfs://${cid}`])
      assert.equal(contentKeyVersionForAudioRef(ref), null);
  });
});
