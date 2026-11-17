import { encryptedRefToCID, isEncryptedAudioV3Ref, streamingReference } from '../../shared/utils/protectedAudio';
import { fetchStreamingObject } from './streamingPlayback';

/** Only public ciphertext is warmed. Access checks and authentication stay in playback. */
export async function prefetchStreamingAudio(ref: string, signal = AbortSignal.timeout(5000)): Promise<void> {
  if (!isEncryptedAudioV3Ref(ref)) return;
  const cid = encryptedRefToCID(ref);
  const transport = { layout: streamingReference(ref)!.layout };
  await fetchStreamingObject(cid, 'manifest.json', 256 * 1024, signal, undefined, false, transport);
  // Compact offsets require an authenticated manifest; prefetch never requests a key.
  if (transport.layout === 'rendition-pack-v1') return;
  await fetchStreamingObject(cid, '96/init.bin', 1024 * 1024 + 16, signal, undefined, false);
}
export function startStreamingNeighborPrefetch(refs: readonly string[]): () => void {
  const controller = new AbortController();
  for (const ref of [...new Set(refs)].slice(0, 2)) {
    void prefetchStreamingAudio(ref, AbortSignal.any([controller.signal, AbortSignal.timeout(5000)])).catch(() => undefined);
  }
  return () => controller.abort();
}
