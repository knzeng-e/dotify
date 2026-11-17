import { STREAM_BUNDLE_MAX, unpackStreamingBundle } from './streamingBundle.js';
import type { EncodedStreamingAudio } from './streamingTranscoder.js';
export function createStreamingWorkerClient(url: string, token: string, fetchImpl: typeof fetch = fetch) {
  const endpoint = new URL(url);
  // HTTP is restricted to the encrypted Fly private network or loopback tests.
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/' ||
    !(
      endpoint.protocol === 'https:' ||
      (endpoint.protocol === 'http:' && (endpoint.hostname.endsWith('.internal') || ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)))
    )
  )
    throw new Error('Invalid isolated worker endpoint');
  if (token.length < 32) throw new Error('A dedicated worker token is required');
  return async (master: Buffer, signal?: AbortSignal): Promise<EncodedStreamingAudio> => {
    const response = await fetchImpl(new URL('/encode', endpoint), {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(master),
      signal: AbortSignal.any([AbortSignal.timeout(10 * 60_000), ...(signal ? [signal] : [])])
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('The isolated audio encoder is unavailable. Retry preparation.');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No encoded audio received');
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      if (Number(response.headers.get('content-length')) > STREAM_BUNDLE_MAX) throw new Error('Encoder response exceeds budget');
      while (true) {
        signal?.throwIfAborted();
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > STREAM_BUNDLE_MAX) throw new Error('Encoder response exceeds budget');
        chunks.push(Buffer.from(part.value));
      }
      return unpackStreamingBundle(Buffer.concat(chunks, size));
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  };
}
