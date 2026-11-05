import type { StreamingObject } from './streamingFormat';
import { pumpStreamingReadAhead } from './streamingPipeline';

const MAX_COMPATIBILITY_AUDIO_BYTES = 40 * 1024 * 1024;
export type CompatibilityAudioProgress = { completedBytes: number; totalBytes: number };

/** Collect one authenticated rendition in order, with at most four reads in flight. */
export async function readCompatibilityAudio(
  objects: readonly StreamingObject[],
  read: (object: StreamingObject, signal: AbortSignal) => Promise<Uint8Array>,
  signal: AbortSignal,
  onProgress?: (progress: CompatibilityAudioProgress) => void
): Promise<Uint8Array[]> {
  signal.throwIfAborted();
  const totalBytes = objects.reduce((sum, object) => sum + object.plainLength, 0);
  if (!Number.isSafeInteger(totalBytes) || totalBytes < 0 || totalBytes > MAX_COMPATIBILITY_AUDIO_BYTES)
    throw new Error('Audio compatibility buffer exceeds budget');
  const parts: Uint8Array[] = [];
  let size = 0;
  onProgress?.({ completedBytes: 0, totalBytes });
  // Init and segments authenticate independently. Bound the window instead of
  // serializing every round trip or retaining an unbounded Promise.all queue.
  await pumpStreamingReadAhead({
    chunks: objects.map((object, index) => ({ object, index })),
    readAheadChunks: 3,
    signal,
    prepareChunk: (chunk, childSignal) => read(chunk.object, childSignal),
    appendChunk: async (_chunk, bytes) => {
      size += bytes.length;
      if (size > MAX_COMPATIBILITY_AUDIO_BYTES) throw new Error('Audio compatibility buffer exceeds budget');
      parts.push(bytes);
      onProgress?.({ completedBytes: size, totalBytes });
    }
  });
  signal.throwIfAborted();
  return parts;
}
