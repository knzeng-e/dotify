const AUDIO_BODY_IDLE_TIMEOUT_MS = 15_000;

/** Header arrival is not download completion. Bound lack of body progress too. */
export async function readAudioBody(response: Response, signal?: AbortSignal, idleTimeoutMs = AUDIO_BODY_IDLE_TIMEOUT_MS): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
        const abort = () => reject(new DOMException('Audio download cancelled', 'AbortError'));
        if (signal?.aborted) {
          abort();
          return;
        }
        const timer = setTimeout(() => reject(new Error('Audio download stopped making progress. Please try again.')), idleTimeoutMs);
        signal?.addEventListener('abort', abort, { once: true });
        reader
          .read()
          .then(resolve, reject)
          .finally(() => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
          });
      });
      if (next.done) break;
      if (next.value.byteLength) {
        chunks.push(next.value);
        size += next.value.byteLength;
      }
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
