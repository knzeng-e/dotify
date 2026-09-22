import {
  AudioV2HeaderIncompleteError,
  audioV2ChunkBodyOffset,
  initialAudioV2HeaderRangeEnd,
  parseAudioV2HeaderPrefix,
  type ParsedAudioV2
} from '../../shared/utils/audioV2';
import { encryptedRefToCID, isEncryptedAudioV2Ref } from '../../shared/utils/protectedAudio';
import { evictAudioV2IntentRange, prefetchAudioV2RangeThroughGateways, retainAudioV2IntentRanges, type AudioV2RangeResult } from './audioV2Gateway';

type PrefetchRange = (
  cid: string,
  start: number,
  end: number,
  options: { phase: 'header' | 'first-chunk'; signal: AbortSignal }
) => Promise<AudioV2RangeResult>;

type IntentPrefetchOptions = {
  fetchRange?: PrefetchRange;
  evictRange?: (cid: string, start: number, end: number) => void;
};

const AUDIO_V2_INTENT_MAX_HEADER_BYTES = 256 * 1024;
const AUDIO_V2_INTENT_MAX_FIRST_CHUNK_BYTES = 768 * 1024;

type PrefetchJob = { audioRef: string; controller: AbortController; request: Promise<void> };
let activeIntent: PrefetchJob | null = null;
let activeNeighbors: { stop: () => void; promote: (audioRef: string) => PrefetchJob | null } | null = null;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function prefetchHeader(
  cid: string,
  signal: AbortSignal,
  fetchRange: PrefetchRange,
  evictRange: (cid: string, start: number, end: number) => void
): Promise<ParsedAudioV2 | null> {
  let rangeEnd = initialAudioV2HeaderRangeEnd();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const range = await fetchRange(cid, 0, rangeEnd, { phase: 'header', signal });
    try {
      return parseAudioV2HeaderPrefix(range.bytes);
    } catch (error) {
      if (error instanceof AudioV2HeaderIncompleteError && error.neededBytes - 1 > rangeEnd) {
        if (error.neededBytes > AUDIO_V2_INTENT_MAX_HEADER_BYTES) return null;
        rangeEnd = error.neededBytes - 1;
        continue;
      }
      evictRange(cid, 0, rangeEnd);
      throw error;
    }
  }
  throw new Error('Unable to prefetch DAV2 header');
}

async function runIntentPrefetch(
  audioRef: string,
  signal: AbortSignal,
  fetchRange: PrefetchRange,
  evictRange: (cid: string, start: number, end: number) => void
): Promise<void> {
  const cid = encryptedRefToCID(audioRef);
  const parsed = await prefetchHeader(cid, signal, fetchRange, evictRange);
  if (!parsed || signal.aborted) return;
  const firstChunk = parsed.header.chunks[0];
  if (!firstChunk || firstChunk.encryptedLength > AUDIO_V2_INTENT_MAX_FIRST_CHUNK_BYTES) return;
  const start = parsed.bodyOffset + audioV2ChunkBodyOffset(parsed.header, firstChunk.index);
  await fetchRange(cid, start, start + firstChunk.encryptedLength - 1, { phase: 'first-chunk', signal });
}

function createPrefetchJob(audioRef: string, options: IntentPrefetchOptions): PrefetchJob {
  const controller = new AbortController();
  const request = runIntentPrefetch(
    audioRef,
    controller.signal,
    options.fetchRange ?? prefetchAudioV2RangeThroughGateways,
    options.evictRange ?? evictAudioV2IntentRange
  ).catch(error => {
    if (!isAbortError(error)) throw error;
  });
  return { audioRef, controller, request };
}

/**
 * Warm only public encrypted DAV2 bytes after a deliberate hover, focus, touch,
 * or room-track choice. No wallet, access read, signature, content key, clear
 * media, or autoplay action is involved.
 */
export function prefetchAudioV2TrackIntent(audioRef: string, options: IntentPrefetchOptions = {}): Promise<void> {
  if (!isEncryptedAudioV2Ref(audioRef)) return Promise.resolve();
  if (activeIntent?.audioRef === audioRef) return activeIntent.request;

  activeIntent?.controller.abort();
  const release = retainAudioV2IntentRanges([encryptedRefToCID(audioRef)]);
  // Take ownership before cancelling the background batch: a click on the
  // neighbor already being fetched must reuse, rather than abort, that request.
  const promoted = activeNeighbors?.promote(audioRef);
  activeNeighbors?.stop();
  const job = promoted ?? createPrefetchJob(audioRef, options);
  activeIntent = job;
  return job.request.finally(() => {
    release();
    if (activeIntent === job) activeIntent = null;
  });
}

export function cancelAudioV2TrackIntentPrefetch(): void {
  activeIntent?.controller.abort();
  activeIntent = null;
  activeNeighbors?.stop();
}

/** Serial, cancellable preparation of Next and Previous. A deliberate intent
 * always takes priority. No key/access/signature path is reachable here. */
export function startAudioV2NeighborPrefetch(audioRefs: readonly string[], options: IntentPrefetchOptions = {}): () => void {
  activeNeighbors?.stop();
  const refs = [...new Set(audioRefs.filter(isEncryptedAudioV2Ref))].slice(0, 2);
  const release = retainAudioV2IntentRanges(refs.map(encryptedRefToCID));
  let stopped = false;
  let current: PrefetchJob | null = null;
  const batch = {
    stop() {
      stopped = true;
      current?.controller.abort();
      current = null;
      release();
      if (activeNeighbors === batch) activeNeighbors = null;
    },
    promote(audioRef: string): PrefetchJob | null {
      if (current?.audioRef !== audioRef) return null;
      const job = current;
      current = null;
      batch.stop();
      return job;
    }
  };
  activeNeighbors = batch;
  void (async () => {
    // Don't compete with an intentional card/transport gesture already running.
    await activeIntent?.request.catch(() => undefined);
    for (const audioRef of refs) {
      if (stopped || activeIntent) return;
      current = createPrefetchJob(audioRef, options);
      await current.request.catch(() => undefined);
      current = null;
    }
  })();
  return batch.stop;
}
