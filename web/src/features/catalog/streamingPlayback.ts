import { readStreamingManifest, decryptStreamingMedia, type StreamingScope } from './streamingFormat';
import { readAudioBody } from './readAudioBody';
import { getAudioGatewayUrls } from '../../services/pinata';
import { pumpAudioV2ReadAhead } from './audioV2Pipeline';
const api = (import.meta.env.VITE_DOTIFY_API_URL as string | undefined)?.replace(/\/$/, '').replace(/\/api$/, '');
const MIME = 'audio/mp4; codecs="mp4a.40.2"';
type MediaSourceCtor = typeof MediaSource;
export async function fetchStreamingObject(cid: string, path: string, maxBytes: number, signal: AbortSignal): Promise<Uint8Array> {
  if (!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,110})$/.test(cid) || !/^(manifest\.json|(?:96|160|320)\/(init|segment-[0-9]{3})\.bin)$/.test(path))
    throw new Error('Invalid streaming media path');
  const urls = [...(api ? [`${api}/api/media/${cid}/stream/${path}`] : []), ...getAudioGatewayUrls(`${cid}/${path}`)];
  for (let attempt = 0; attempt < 2; attempt++)
    for (const url of urls) {
      signal.throwIfAborted();
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(url, { signal: AbortSignal.any([signal, controller.signal]) });
        if (!response.ok) {
          await response.body?.cancel();
          continue;
        }
        return await readAudioBody(response, AbortSignal.any([signal, controller.signal]), 12_000, maxBytes);
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
}): Promise<{ url: string; gainDb: number; progressive: boolean }> {
  const get = input.fetchObject ?? fetchStreamingObject;
  const context = await readStreamingManifest(await get(input.cid, 'manifest.json', 256 * 1024, input.signal), input.key, input.scope);
  input.signal.throwIfAborted();
  const rendition = context.manifest.renditions[1]; // Fixed 160 kb/s first activation; ABR is W35.
  const read = async (object: typeof rendition.init, signal: AbortSignal) =>
    decryptStreamingMedia(context, object, await get(input.cid, object.path, object.encryptedLength, signal));
  const ctor: MediaSourceCtor | undefined = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(MIME) ? MediaSource : undefined;
  if (!ctor?.isTypeSupported(MIME)) {
    // Same authenticated rendition, never the archival master or a different key.
    const parts: Uint8Array[] = [];
    let size = 0;
    for (const object of [rendition.init, ...rendition.segments]) {
      const bytes = await read(object, input.signal);
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
      await pumpAudioV2ReadAhead({
        chunks: rendition.segments,
        signal: input.signal,
        readAheadChunks: 1,
        prepareChunk: (object, signal) => read(object, signal),
        appendChunk: async (object, bytes, signal) => {
          // Keep network work close to playback while paused/slow; total media is
          // bounded to 15 minutes and remains seekable backwards in this slice.
          while (object.index * 4 > (input.audio()?.currentTime ?? 0) + 24) await pause(150, signal);
          await append(buffer, bytes, signal);
        }
      });
      if (source.readyState === 'open') source.endOfStream();
    })
    .catch(error => {
      if (input.signal.aborted) return;
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
