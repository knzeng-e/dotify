import { describe, expect, it } from 'vitest';
import {
  LEGACY_CONTENT_KEY_VERSION,
  RELEASE_BOUND_CONTENT_KEY_VERSION,
  contentKeyVersionForAudioRef,
  encryptedRefToCID,
  isEncryptedAudioRef,
  isEncryptedAudioV2Ref,
  makeReleaseBoundEncryptedAudioV2Ref
} from './protectedAudio';

describe('protected audio refs', () => {
  it('recognizes release-bound DAV2 encrypted refs', () => {
    const ref = makeReleaseBoundEncryptedAudioV2Ref('release-cid');

    expect(ref).toBe('dotify:enc:v2:key-v2:ipfs://release-cid');
    expect(isEncryptedAudioRef(ref)).toBe(true);
    expect(isEncryptedAudioV2Ref(ref)).toBe(true);
    expect(encryptedRefToCID(ref)).toBe('release-cid');
    expect(contentKeyVersionForAudioRef(ref)).toBe(RELEASE_BOUND_CONTENT_KEY_VERSION);
  });

  it('keeps legacy v1 and legacy DAV2 refs on contentHash-derived keys', () => {
    expect(contentKeyVersionForAudioRef('dotify:enc:ipfs://legacy-cid')).toBe(LEGACY_CONTENT_KEY_VERSION);
    expect(contentKeyVersionForAudioRef('dotify:enc:v2:ipfs://legacy-dav2-cid')).toBe(LEGACY_CONTENT_KEY_VERSION);
    expect(contentKeyVersionForAudioRef('ipfs://clear-cid')).toBe(null);
  });
});
