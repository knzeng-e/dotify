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

describe('explicit compact streaming identity', () => {
  const root = 'bafykbzacec2bpys6cfd23kbnvg4p7fidf6laimhd5afshs32sgilt74gkybhw';
  const ref = `dotify:enc:v3:key-v3:bulletin-pack-v1://${root}`;
  it('preserves layout, key rotation and the canonical Bulletin root', async () => {
    const { streamingReference, audioReferenceForMetadata } = await import('./protectedAudio');
    expect(normalizeEncryptedAudioRef(ref)).toBe(ref);
    expect(encryptedRefToCID(ref)).toBe(root);
    expect(contentKeyVersionForAudioRef(ref)).toBe('dotify-content-key-v3');
    expect(streamingReference(ref)?.layout).toBe('rendition-pack-v1');
    expect(audioReferenceForMetadata(ref, root)).toBe(ref);
    expect(audioReferenceForMetadata(ref.replace('bulletin-pack-v1', 'ipfs'), root)).toBe(root);
    expect(() => audioReferenceForMetadata(ref, cid)).toThrow('identity');
    for (const invalid of [
      ref + '/96/init.bin',
      ref + '?offset=1',
      ref.replace('pack-v1', 'pack-v2'),
      ref.replace(root, cid),
      ref.replace(root, 'b' + 'a'.repeat(58))
    ]) {
      expect(isEncryptedAudioRef(invalid)).toBe(false);
      expect(contentKeyVersionForAudioRef(invalid)).toBeNull();
    }
  });
});
