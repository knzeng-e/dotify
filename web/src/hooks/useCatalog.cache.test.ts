import { describe, expect, it } from 'vitest';
import { contentKeyCacheKey } from './useCatalog';
import { RELEASE_BOUND_CONTENT_KEY_VERSION, type ContentKeyReleaseIdentity } from '../services/keyService';

const HASH = `0x${'ab'.repeat(32)}` as const;

function release(runtimeAddress: `0x${string}`): ContentKeyReleaseIdentity {
  return {
    releaseId: `${runtimeAddress}:${HASH}`,
    runtimeAddress,
    artistAddress: '0x3333333333333333333333333333333333333333',
    audioRef: `dotify:enc:v3:key-v2:ipfs://Qm3h8TLcv5mr4YXCEhsckkCjQu4pUVrJpyJe63bp485QjG${runtimeAddress.slice(2, 6)}`,
    keyVersion: RELEASE_BOUND_CONTENT_KEY_VERSION
  };
}

describe('contentKeyCacheKey', () => {
  it('separates release-bound v2 keys for equal hashes in different runtimes', () => {
    const keyA = contentKeyCacheKey(HASH, release('0x1111111111111111111111111111111111111111'));
    const keyB = contentKeyCacheKey(HASH, release('0x2222222222222222222222222222222222222222'));

    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain(RELEASE_BOUND_CONTENT_KEY_VERSION);
    expect(keyA).toContain('0x1111111111111111111111111111111111111111');
  });
});
