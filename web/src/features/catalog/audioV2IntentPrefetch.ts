import {
  AudioV2HeaderIncompleteError,
  audioV2ChunkBodyOffset,
  initialAudioV2HeaderRangeEnd,
  parseAudioV2HeaderPrefix,
  type ParsedAudioV2
} from '../../shared/utils/audioV2';
import { encryptedRefToCID, isEncryptedAudioV2Ref } from '../../shared/utils/protectedAudio';
import { prefetchAudioV2RangeThroughGateways, type AudioV2RangeResult } from './audioV2Gateway';

type PrefetchRange = (
  cid: string,
  start: number,
  end: number,
  options: { phase: 'header' | 'first-chunk'; signal: AbortSignal }
) => Promise<AudioV2RangeResult>;

type IntentPrefetchOptions = {
  fetchRange?: PrefetchRange;
};

const AUDIO_V2_INTENT_MAX_HEADER_BYTES = 256 * 1024;
const AUDIO_V2_INTENT_MAX_FIRST_CHUNK_BYTES = 768 * 1024;

let activeIntent: { audioRef: string; controller: AbortController; request: Promise<void> } | null = null;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function prefetchHeader(cid: string, signal: AbortSignal, fetchRange: PrefetchRange): Promise<ParsedAudioV2 | null> {
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
      throw error;
    }
  }
  throw new Error('Unable to prefetch DAV2 header');
}

async function runIntentPrefetch(audioRef: string, signal: AbortSignal, fetchRange: PrefetchRange): Promise<void> {
  const cid = encryptedRefToCID(audioRef);
  const parsed = await prefetchHeader(cid, signal, fetchRange);
  if (!parsed) return;
  const firstChunk = parsed.header.chunks[0];
  if (!firstChunk || firstChunk.encryptedLength > AUDIO_V2_INTENT_MAX_FIRST_CHUNK_BYTES) return;
  const start = parsed.bodyOffset + audioV2ChunkBodyOffset(parsed.header, firstChunk.index);
  await fetchRange(cid, start, start + firstChunk.encryptedLength - 1, { phase: 'first-chunk', signal });
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
  const controller = new AbortController();
  const fetchRange = options.fetchRange ?? prefetchAudioV2RangeThroughGateways;
  const request = runIntentPrefetch(audioRef, controller.signal, fetchRange)
    .catch(error => {
      if (!isAbortError(error)) throw error;
    })
    .finally(() => {
      if (activeIntent?.request === request) activeIntent = null;
    });
  activeIntent = { audioRef, controller, request };
  return request;
}

export function cancelAudioV2TrackIntentPrefetch(): void {
  activeIntent?.controller.abort();
  activeIntent = null;
}
