import { streamingMediaSource, ownManagedAudioUrl, STREAMING_AAC_MIME, type ManagedAudioSource } from './streamingMediaSource';
import { pumpManagedAudio } from './managedStreaming';
import { AdaptiveStreaming } from './adaptiveStreaming';
import { readStreamingManifest, decryptStreamingMedia, type StreamingScope } from './streamingFormat';
import { readAudioBody } from './readAudioBody';
import { getAudioGatewayUrls } from '../../services/pinata';
import { pumpStreamingReadAhead } from './streamingPipeline';
import { streamingObjectUrls } from './streamingTransport';
import type { StreamingStartupMetric } from './audioStartupTelemetry';
type ReaderMetric = Pick<
  StreamingStartupMetric,
  | 'phase'
  | 'objectPath'
  | 'objectBytes'
  | 'segmentIndex'
  | 'gatewayUrl'
  | 'gatewayRecovered'
  | 'fromCache'
  | 'errorKind'
  | 'bitrateKbps'
  | 'bufferedSeconds'
  | 'throughputKbps'
>;
type TransportObservation = Pick<ReaderMetric, 'gatewayUrl' | 'gatewayRecovered' | 'fromCache'>;
const api = (import.meta.env.VITE_DOTIFY_API_URL as string | undefined)?.replace(/\/$/, '').replace(/\/api$/, '');
const MIME = STREAMING_AAC_MIME;
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
        storeWarmObject(cacheKey, bytes);
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
  bufferAheadSeconds?: () => number;
  fetchObject?: typeof fetchStreamingObject;
  onMetric?: (metric: ReaderMetric) => void;
  // Research may observe/wrap the same producer; ordinary playback always uses the default.
  managedProducer?: typeof pumpManagedAudio;
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
  const get = async (cid: string, path: string, maxBytes: number, signal: AbortSignal, observe?: (metric: TransportObservation) => void) => {
    const bytes = await (input.fetchObject ?? fetchStreamingObject)(cid, path, maxBytes, signal, metric => {
      emit({ phase: 'gateway-selected', objectPath: path, ...metric });
      observe?.(metric);
    });
    if (path.endsWith('/segment-000.bin')) emit({ phase: 'first-object-ready', objectPath: path, objectBytes: bytes.length, segmentIndex: 0 });
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
  const rendition = context.manifest.renditions[0];
  const adaptive = new AdaptiveStreaming();
  const read = async (object: typeof rendition.init, signal: AbortSignal) => {
    const start = performance.now();
    let cached = true;
    const bytes = await get(input.cid, object.path, object.encryptedLength, signal, metric => {
      cached = metric.fromCache !== false;
    });
    if (object.kind === 'media') adaptive.observe(bytes.length, performance.now() - start, cached);
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
  const capability = streamingMediaSource();
  if (!capability) {
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
  const source = new capability.ctor();
  const url = URL.createObjectURL(source);
  const releaseManagedUrl = capability.kind === 'managed' ? ownManagedAudioUrl(url, input.signal) : () => {};
  const abort = () => {
    releaseManagedUrl();
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
      if (capability.kind === 'managed') {
        const audio = input.audio();
        if (!audio) throw new Error('The audio player is unavailable. Please try again.');
        let init: Uint8Array | undefined;
        // Keep one small authenticated init for reopening after managed eviction.
        // Start at 96 kb/s: native mobile acceptance precedes adapting this path.
        await (input.managedProducer ?? pumpManagedAudio)({
          source: source as ManagedAudioSource,
          buffer,
          audio,
          segmentCount: rendition.segments.length,
          duration: context.manifest.durationSeconds,
          signal: input.signal,
          bufferAheadSeconds: () => input.bufferAheadSeconds?.() ?? 30,
          initialize: async signal => {
            init ??= await read(rendition.init, signal);
            signal.throwIfAborted();
            await append(buffer, init, input.signal);
          },
          appendSegment: async (index, signal) => {
            const bytes = await read(rendition.segments[index], signal);
            signal.throwIfAborted();
            emit({ phase: 'rendition-selected', bitrateKbps: 96, segmentIndex: index });
            // A seek/demand change may cancel downloads, never interrupt an
            // already-started SourceBuffer update and race the next append.
            await append(buffer, bytes, input.signal);
            if (index === 0) emit({ phase: 'first-segment-appended', segmentIndex: 0 });
          }
        });
        return;
      }
      await append(buffer, await read(rendition.init, input.signal), input.signal);
      let appendedBitrate = rendition.bitrateKbps;
      // W32 segments share codec and nominal boundaries. Inconsistent counts
      // cannot be switched safely; retain the authenticated lowest rendition.
      const aligned = context.manifest.renditions.every(item => item.segments.length === rendition.segments.length);
      await pumpStreamingReadAhead({
        chunks: rendition.segments,
        signal: input.signal,
        readAheadChunks: 1,
        prepareChunk: async (object, signal) => {
          while (object.index * 4 > (input.audio()?.currentTime ?? 0) + (input.bufferAheadSeconds?.() ?? 30)) await pause(150, signal);
          const audio = input.audio();
          const end = audio?.buffered.length ? audio.buffered.end(audio.buffered.length - 1) : 0;
          const headroom = Math.max(0, end - (audio?.currentTime ?? 0));
          const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
          const bitrate = aligned ? adaptive.choose(object.index, headroom, connection?.saveData) : 96;
          const chosen = context.manifest.renditions.find(item => item.bitrateKbps === bitrate)!;
          const bytes = await read(chosen.segments[object.index], signal);
          return { chosen, bytes };
        },
        appendChunk: async (object, { chosen, bytes }, signal) => {
          if (chosen.bitrateKbps !== appendedBitrate) {
            // A new authenticated initialization segment precedes its media.
            // The codec is unchanged; no unverified path or alternate key is used.
            await append(buffer, await read(chosen.init, signal), signal);
            appendedBitrate = chosen.bitrateKbps;
          }
          emit({ phase: 'rendition-selected', bitrateKbps: appendedBitrate, throughputKbps: adaptive.throughputKbps ?? undefined, segmentIndex: object.index });
          await append(buffer, bytes, signal);
          if (object.index === 0) emit({ phase: 'first-segment-appended', segmentIndex: 0 });
        }
      });
      if (source.readyState === 'open') source.endOfStream();
    })
    .catch(error => {
      if (input.signal.aborted) return;
      failure(error);
      releaseManagedUrl();
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
