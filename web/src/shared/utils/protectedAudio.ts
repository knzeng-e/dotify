import { CID } from 'multiformats/cid';
import { parseStreamingReference } from '../../../../services/api/src/services/streamingReference';
/** Protected streaming references. Keys are delivered only by the authorized API. */
export const RELEASE_BOUND_CONTENT_KEY_VERSION = 'dotify-content-key-v2';
export type ContentKeyVersion = `dotify-content-key-v${number}`;
export const streamingReference = (ref: string) => parseStreamingReference(ref, value => CID.parse(value));
export function isEncryptedAudioV3Ref(ref: string): boolean {
  return streamingReference(ref) !== null;
}
export function isEncryptedAudioRef(ref: string): boolean {
  return isEncryptedAudioV3Ref(ref);
}
export function normalizeEncryptedAudioRef(ref: string): string {
  if (!streamingReference(ref)) throw new Error('The prepared audio reference is invalid. Publish the track again.');
  return ref;
}
export function encryptedRefToCID(ref: string): string {
  const match = streamingReference(ref);
  if (!match) throw new Error('Invalid streaming audio reference');
  return match.root;
}
export function contentKeyVersionForAudioRef(ref: string): ContentKeyVersion | null {
  return streamingReference(ref)?.keyVersion ?? null;
}

/** Preserve the explicit physical layout in saved details for compact releases. */
export function audioReferenceForMetadata(ref: string, root: string): string {
  const parsed = streamingReference(ref);
  if (!parsed || parsed.root !== root) throw new Error('Prepared audio identity mismatch');
  return parsed.layout === 'rendition-pack-v1' ? ref : root;
}
