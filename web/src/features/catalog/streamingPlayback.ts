import { readStreamingManifest, decryptStreamingMedia, type StreamingScope } from './streamingFormat';
import { readAudioBody } from './readAudioBody';
import { getAudioGatewayUrls } from '../../services/pinata';
import { pumpStreamingReadAhead } from './streamingPipeline';
import { streamingObjectUrls } from './streamingTransport';
import type { StreamingStartupMetric } from './audioStartupTelemetry';
type ReaderMetric = Pick<
  StreamingStartupMetric,
  'phase' | 'objectPath' | 'objectBytes' | 'segmentIndex' | 'gatewayUrl' | 'gatewayRecovered' | 'fromCache' | 'errorKind'
>;
type TransportObservation = Pick<ReaderMetric, 'gatewayUrl' | 'gatewayRecovered' | 'fromCache'>;
const api = (import.meta.env.VITE_DOTIFY_API_URL as string | undefined)?.replace(/\/$/, '').replace(/\/api$/, '');
const MIME = 'audio/mp4; codecs="mp4a.40.2"';
type MediaSourceCtor = typeof MediaSource;
// Small, short-lived ciphertext cache shared by intent and actual playback.
// No key, clear audio, archival master or mutable response is retained here.
const warmObjects = new Map<string, { bytes: Uint8Array; until: number }>();
let warmBytes = 0;
function storeWarmObject(key: string, bytes: Uint8Array) {
  const previous = warmObjects.get(key);
  if (previous) warmBytes -= previous.bytes.length;
  warmObjects.delete(key);
  warmObjects.set(key, { bytes, until: Date.now() + 30_000 });
  warmBytes += bytes.length;
  while (warmBytes > 4 * 1024 * 1024 || warmObjects.size > 16) {
    const oldest = warmObjects.keys().next().value!;
    warmBytes -= warmObjects.get(oldest)!.bytes.length;
    warmObjects.delete(oldest);
  }
}

export async function fetchStreamingObject(
  cid: string,
  path: string,
  maxBytes: number,
  signal: AbortSignal,
  observe?: (metric: TransportObservation) => void,
  exactLength = true
): Promise<Uint8Array> {
  if (!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,110})$/.test(cid) || !/^(manifest\.json|(?:96|160|320)\/(init|segment-[0-9]{3})\.bin)$/.test(path))
    throw new Error('Invalid streaming media path');
  const cacheKey = `${cid}/${path}`;
  const cached = warmObjects.get(cacheKey);
  signal.throwIfAborted();
  if (cached) {
    if (cached.until > Date.now() && cached.bytes.length <= maxBytes && (!exactLength || path === 'manifest.json' || cached.bytes.length === maxBytes)) {
      observe?.({ fromCache: true });
      return cached.bytes;
    }
    warmBytes -= cached.bytes.length;
    warmObjects.delete(cacheKey);
  }
  const urls = streamingObjectUrls(cid, path, {
    edge: import.meta.env.VITE_DOTIFY_MEDIA_EDGE_URL,
    api,
    gateways: getAudioGatewayUrls(`${cid}/${path}`)
  });
  for (let attempt = 0; attempt < 2; attempt++)
    for (const [index, url] of urls.entries()) {
      signal.throwIfAborted();
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), import.meta.env.VITE_DOTIFY_MEDIA_EDGE_URL && index === 0 ? 3000 : 12_000);
      try {
        const response = await fetch(url, { signal: AbortSignal.any([signal, controller.signal]), credentials: 'omit' });
        if (response.status !== 200) {
          await response.body?.cancel();
          continue;
        }
        const bytes = await readAudioBody(response, AbortSignal.any([signal, controller.signal]), 12_000, maxBytes);
        if (exactLength && path !== 'manifest.json' && bytes.length !== maxBytes) throw new Error('Incomplete streaming object');
        if (path === 'manifest.json' || path === '160/init.bin') storeWarmObject(cacheKey, bytes);
        observe?.({ gatewayUrl: url, gatewayRecovered: attempt > 0 || index > 0, fromCache: false });
        return bytes;
      } catch {
        signal.throwIfAborted();
      } finally {
        clearTimeout(deadline);
        controller.abort();
      }
    }
  throw new Error('The audio connection could not recover. Please try again.');
}
function event(target: EventTarget, success: string, signal: AbortSignal, timeout = 20_000, run?: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener(success, done);
      target.removeEventListener('error', failed);
      signal.removeEventListener('abort', failed);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(signal.aborted ? signal.reason : new Error('Audio preparation failed'));
    };
    const timer = setTimeout(failed, timeout);
    target.addEventListener(success, done, { once: true });
    target.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', failed, { once: true });
    if (signal.aborted) failed();
    else if (run) {
      try {
        run();
      } catch {
        failed();
      }
    }
  });
}
async function append(buffer: SourceBuffer, bytes: Uint8Array, signal: AbortSignal) {
  await event(buffer, 'updateend', signal, 20_000, () => buffer.appendBuffer(bytes));
}
async function pause(ms: number, signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const done = () => {
      signal.removeEventListener('abort', abort);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}
export async function createStreamingPlayback(input: {
  cid: string;
  key: Uint8Array;
  scope: StreamingScope;
  signal: AbortSignal;
  audio: () => HTMLAudioElement | null;
  onError: (error: unknown) => void;
  fetchObject?: typeof fetchStreamingObject;
  onMetric?: (metric: ReaderMetric) => void;
}): Promise<{ url: string; gainDb: number; progressive: boolean }> {
  const emit = (metric: ReaderMetric) => {
    if (!input.signal.aborted) input.onMetric?.(metric);
  };
  const reportedErrors = new Set<unknown>();
  const failure = (error: unknown, authentication = false) => {
    if (reportedErrors.has(error)) return;
    reportedErrors.add(error);
    emit({ phase: 'error', errorKind: authentication ? 'authentication' : 'transport' });
  };
  const get = async (cid: string, path: string, maxBytes: number, signal: AbortSignal) => {
    const bytes = await (input.fetchObject ?? fetchStreamingObject)(cid, path, maxBytes, signal, metric =>
      emit({ phase: 'gateway-selected', objectPath: path, ...metric })
    );
    if (path === '160/segment-000.bin') emit({ phase: 'first-object-ready', objectPath: path, objectBytes: bytes.length, segmentIndex: 0 });
    return bytes;
  };
  let context;
  try {
    const bytes = await get(input.cid, 'manifest.json', 256 * 1024, input.signal);
    try {
      context = await readStreamingManifest(bytes, input.key, input.scope);
    } catch (error) {
      failure(error, true);
      throw error;
    }
    emit({ phase: 'manifest-ready', objectPath: 'manifest.json', objectBytes: bytes.length });
  } catch (error) {
    failure(error);
    throw error;
  }
  input.signal.throwIfAborted();
  const rendition = context.manifest.renditions[1]; // Fixed 160 kb/s first activation; ABR is W35.
  const read = async (object: typeof rendition.init, signal: AbortSignal) => {
    const bytes = await get(input.cid, object.path, object.encryptedLength, signal);
    let clear;
    try {
      clear = await decryptStreamingMedia(context, object, bytes);
    } catch (error) {
      failure(error, true);
      throw error;
    }
    if (object.kind === 'media' && object.index === 0) emit({ phase: 'first-segment-decrypted', segmentIndex: 0 });
    return clear;
  };
  const ctor: MediaSourceCtor | undefined = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(MIME) ? MediaSource : undefined;
  if (!ctor?.isTypeSupported(MIME)) {
    emit({ phase: 'compatibility-reader' });
    // Same authenticated rendition, never the archival master or a different key.
    const parts: Uint8Array[] = [];
    let size = 0;
    for (const object of [rendition.init, ...rendition.segments]) {
      const bytes = await read(object, input.signal).catch(error => {
        failure(error);
        throw error;
      });
      size += bytes.length;
      if (size > 40 * 1024 * 1024) throw new Error('Audio compatibility buffer exceeds budget');
      parts.push(bytes);
    }
    input.signal.throwIfAborted();
    return { url: URL.createObjectURL(new Blob(parts, { type: 'audio/mp4' })), gainDb: context.manifest.gainDb, progressive: false };
  }
  const source = new ctor();
  const url = URL.createObjectURL(source);
  const abort = () => {
    URL.revokeObjectURL(url);
    if (source.readyState === 'open') {
      try {
        source.endOfStream();
      } catch {
        /* Retiring a source is best effort. */
      }
    }
  };
  input.signal.addEventListener('abort', abort, { once: true });
  // Install before the URL is attached to the persistent audio element.
  void event(source, 'sourceopen', input.signal)
    .then(async () => {
      source.duration = context.manifest.durationSeconds;
      const buffer = source.addSourceBuffer(MIME);
      await append(buffer, await read(rendition.init, input.signal), input.signal);
      await pumpStreamingReadAhead({
        chunks: rendition.segments,
        signal: input.signal,
        readAheadChunks: 1,
        prepareChunk: (object, signal) => read(object, signal),
        appendChunk: async (object, bytes, signal) => {
          // Keep network work close to playback while paused/slow; total media is
          // bounded to 15 minutes and remains seekable backwards in this slice.
          while (object.index * 4 > (input.audio()?.currentTime ?? 0) + 24) await pause(150, signal);
          await append(buffer, bytes, signal);
          if (object.index === 0) emit({ phase: 'first-segment-appended', segmentIndex: 0 });
        }
      });
      if (source.readyState === 'open') source.endOfStream();
    })
    .catch(error => {
      if (input.signal.aborted) return;
      failure(error);
      input.onError(error);
      if (source.readyState === 'open') {
        try {
          source.endOfStream('decode');
        } catch {
          /* The persistent player reports the error. */
        }
      }
    });
  return { url, gainDb: context.manifest.gainDb, progressive: true };
}
