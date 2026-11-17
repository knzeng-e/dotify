const AUDIO_BODY_IDLE_TIMEOUT_MS = 15_000;
// Current media objects are bounded independently of the uploaded master.
const AUDIO_BODY_MAX_BYTES = 1024 * 1024 + 16;

/** Header arrival is not download completion. Bound lack of body progress too. */
export async function readAudioBody(
  response: Response,
  signal?: AbortSignal,
  idleTimeoutMs = AUDIO_BODY_IDLE_TIMEOUT_MS,
  maxBytes = AUDIO_BODY_MAX_BYTES
): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Audio download returned no content.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > maxBytes) throw new Error('Audio download exceeds the supported size.');
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
        size += next.value.byteLength;
        if (size > maxBytes) throw new Error('Audio download exceeds the supported size.');
        chunks.push(next.value);
      }
    }
    if (size === 0) throw new Error('Audio download returned no content.');
    // Do not compare decoded bytes to Content-Length: cross-origin readers
    // may expose the compressed length without exposing Content-Encoding.
    // Fetch reports a broken transfer; the streaming reader additionally validates its own
    // complete chunk table before a recovery download can win.
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
