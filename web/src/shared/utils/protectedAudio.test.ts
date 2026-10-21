import { describe, it, expect } from 'vitest';
import { isEncryptedAudioRef, isEncryptedAudioV3Ref, normalizeEncryptedAudioRef, encryptedRefToCID, contentKeyVersionForAudioRef } from './protectedAudio';
const cid = `Qm${'a'.repeat(44)}`;
describe('streaming audio references', () => {
  it('accepts only explicit scoped streaming references and retains key rotation', () => {
    for (const version of [2, 3, 12]) {
      const ref = `dotify:enc:v3:key-v${version}:ipfs://${cid}`;
      expect(isEncryptedAudioRef(ref)).toBe(true);
      expect(isEncryptedAudioV3Ref(ref)).toBe(true);
      expect(normalizeEncryptedAudioRef(ref)).toBe(ref);
      expect(encryptedRefToCID(ref)).toBe(cid);
      expect(contentKeyVersionForAudioRef(ref)).toBe(`dotify-content-key-v${version}`);
    }
  });
  it('rejects old formats, bare CIDs, archive paths and malformed scope', () => {
    for (const ref of [
      cid,
      `ipfs://${cid}`,
      `dotify:enc:ipfs://${cid}`,
      `dotify:enc:v2:key-v2:ipfs://${cid}`,
      `dotify:enc:v3:key-v1:ipfs://${cid}`,
      `dotify:enc:v3:key-v2:ipfs://${cid}/archive/master.bin`
    ]) {
      expect(isEncryptedAudioRef(ref)).toBe(false);
      expect(contentKeyVersionForAudioRef(ref)).toBeNull();
      expect(() => encryptedRefToCID(ref)).toThrow();
      expect(() => normalizeEncryptedAudioRef(ref)).toThrow();
    }
  });
});
