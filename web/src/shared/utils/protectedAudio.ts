/** Protected streaming references. Keys are delivered only by the authorized API. */
export const RELEASE_BOUND_CONTENT_KEY_VERSION = 'dotify-content-key-v2';
export type ContentKeyVersion = `dotify-content-key-v${number}`;
const REF = /^dotify:enc:v3:key-v((?:[2-9]|[1-9][0-9]+)):ipfs:\/\/((?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,110}))$/;
export function isEncryptedAudioV3Ref(ref: string): boolean {
  return REF.test(ref);
}
export function isEncryptedAudioRef(ref: string): boolean {
  return isEncryptedAudioV3Ref(ref);
}
export function normalizeEncryptedAudioRef(ref: string): string {
  if (!REF.test(ref)) throw new Error('The prepared audio reference is invalid. Publish the track again.');
  return ref;
}
export function encryptedRefToCID(ref: string): string {
  const match = REF.exec(ref);
  if (!match) throw new Error('Invalid streaming audio reference');
  return match[2];
}
export function contentKeyVersionForAudioRef(ref: string): ContentKeyVersion | null {
  const version = REF.exec(ref)?.[1];
  return version ? (`dotify-content-key-v${version}` as ContentKeyVersion) : null;
}
