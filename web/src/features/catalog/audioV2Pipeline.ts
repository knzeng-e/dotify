export const DEFAULT_AUDIO_V2_READ_AHEAD_CHUNKS = 2;

const MAX_AUDIO_V2_READ_AHEAD_CHUNKS = 4;

type IndexedChunk = {
  index: number;
};

type PreparedOutcome<TPrepared> = { ok: true; value: TPrepared } | { ok: false; error: unknown };

export type AudioV2ReadAheadPipelineOptions<TChunk extends IndexedChunk, TPrepared> = {
  chunks: readonly TChunk[];
  prepareChunk: (chunk: TChunk, signal: AbortSignal) => Promise<TPrepared>;
  appendChunk: (chunk: TChunk, prepared: TPrepared, signal: AbortSignal) => Promise<void>;
  signal?: AbortSignal;
  readAheadChunks?: number;
};

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') return new DOMException('DAV2 pipeline cancelled', 'AbortError');
  const error = new Error('DAV2 pipeline cancelled');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw createAbortError();
}

function validatePipeline<TChunk extends IndexedChunk>(chunks: readonly TChunk[], readAheadChunks: number): void {
  if (!Number.isSafeInteger(readAheadChunks) || readAheadChunks < 0 || readAheadChunks > MAX_AUDIO_V2_READ_AHEAD_CHUNKS) {
    throw new Error(`DAV2 read-ahead must be between 0 and ${MAX_AUDIO_V2_READ_AHEAD_CHUNKS} chunks`);
  }
  for (let position = 0; position < chunks.length; position += 1) {
    if (chunks[position].index !== position) throw new Error('DAV2 pipeline requires monotonic chunk indexes');
  }
}

/**
 * Prepares a small window of future chunks while appending the current chunk.
 * Preparation may finish out of order, but SourceBuffer appends remain ordered.
 */
export async function pumpAudioV2ReadAhead<TChunk extends IndexedChunk, TPrepared>(options: AudioV2ReadAheadPipelineOptions<TChunk, TPrepared>): Promise<void> {
  const readAheadChunks = options.readAheadChunks ?? DEFAULT_AUDIO_V2_READ_AHEAD_CHUNKS;
  validatePipeline(options.chunks, readAheadChunks);

  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  if (options.signal?.aborted) {
    controller.abort();
  } else {
    options.signal?.addEventListener('abort', abortFromParent, { once: true });
  }

  const preparedByIndex = new Map<number, Promise<PreparedOutcome<TPrepared>>>();
  let nextIndexToPrepare = 0;

  const prepareThrough = (lastIndex: number) => {
    while (nextIndexToPrepare <= lastIndex && nextIndexToPrepare < options.chunks.length) {
      const chunk = options.chunks[nextIndexToPrepare];
      const outcome = Promise.resolve()
        .then(() => {
          throwIfAborted(controller.signal);
          return options.prepareChunk(chunk, controller.signal);
        })
        .then<PreparedOutcome<TPrepared>>(value => ({ ok: true, value }))
        .catch<PreparedOutcome<TPrepared>>(error => ({ ok: false, error }));
      preparedByIndex.set(chunk.index, outcome);
      nextIndexToPrepare += 1;
    }
  };

  try {
    throwIfAborted(controller.signal);
    for (let index = 0; index < options.chunks.length; index += 1) {
      prepareThrough(index + readAheadChunks);
      const outcome = await preparedByIndex.get(index);
      preparedByIndex.delete(index);
      if (!outcome) throw new Error(`DAV2 chunk ${index} was not prepared`);
      if (!outcome.ok) throw outcome.error;

      throwIfAborted(controller.signal);
      await options.appendChunk(options.chunks[index], outcome.value, controller.signal);
      throwIfAborted(controller.signal);
    }
  } catch (error) {
    controller.abort();
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', abortFromParent);
  }
}
