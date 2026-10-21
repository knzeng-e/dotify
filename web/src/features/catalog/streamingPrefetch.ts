import { encryptedRefToCID, isEncryptedAudioV3Ref } from '../../shared/utils/protectedAudio';
import { fetchStreamingObject } from './streamingPlayback';

/** Only public ciphertext is warmed. Access checks and authentication stay in playback. */
export async function prefetchStreamingAudio(ref: string, signal = AbortSignal.timeout(5000)): Promise<void> {
  if (!isEncryptedAudioV3Ref(ref)) return;
  const cid = encryptedRefToCID(ref);
  await fetchStreamingObject(cid, 'manifest.json', 256 * 1024, signal, undefined, false);
  await fetchStreamingObject(cid, '160/init.bin', 1024 * 1024 + 16, signal, undefined, false);
}
export function startStreamingNeighborPrefetch(refs: readonly string[]): () => void {
  const controller = new AbortController();
  for (const ref of [...new Set(refs)].slice(0, 2)) {
    void prefetchStreamingAudio(ref, AbortSignal.any([controller.signal, AbortSignal.timeout(5000)])).catch(() => undefined);
  }
  return () => controller.abort();
}
