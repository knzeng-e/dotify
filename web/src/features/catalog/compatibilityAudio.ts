import type { StreamingObject } from './streamingFormat';

const MAX_COMPATIBILITY_AUDIO_BYTES = 40 * 1024 * 1024;
const MAX_COMPATIBILITY_READS = 4;
export type CompatibilityAudioProgress = { completedBytes: number; totalBytes: number };

/** Collect a complete authenticated rendition into ordered output, with at most four reads in flight. */
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
  const parts: Uint8Array[] = new Array(objects.length);
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  let size = 0;
  let next = 0;
  // This collector already retains the complete bounded rendition. Refill a
  // read when any object finishes, then keep its indexed place for assembly.
  // Ordered append windows remain appropriate for progressive SourceBuffers,
  // but would leave spare transport capacity idle behind a slow early object.
  const prepare = async () => {
    try {
      while (next < objects.length) {
        controller.signal.throwIfAborted();
        const index = next++;
        const bytes = await read(objects[index], controller.signal);
        controller.signal.throwIfAborted();
        size += bytes.length;
        if (size > MAX_COMPATIBILITY_AUDIO_BYTES) throw new Error('Audio compatibility buffer exceeds budget');
        parts[index] = bytes;
        onProgress?.({ completedBytes: size, totalBytes });
      }
    } catch (error) {
      controller.abort(error);
      throw error;
    }
  };
  try {
    signal.throwIfAborted();
    onProgress?.({ completedBytes: 0, totalBytes });
    await Promise.all(Array.from({ length: Math.min(MAX_COMPATIBILITY_READS, objects.length) }, prepare));
    controller.signal.throwIfAborted();
    return parts;
  } catch (error) {
    controller.abort(error);
    parts.length = 0;
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
