export class AudioPreparationError extends Error {
  constructor(
    message: string,
    readonly discard?: () => Promise<void>,
    readonly canRetry = true
  ) {
    super(message);
    this.name = 'AudioPreparationError';
  }
}
// A pending job or unconfirmed upload is resumable work, not a failed release.
export class AudioPreparationPending extends Error {
  constructor(message = 'Your music is still being prepared. You can return and check preparation without starting a new release.') {
    super(message);
    this.name = 'AudioPreparationPending';
  }
}
export type AudioPreparationProgress = { storedBlocks: number; totalBlocks: number };
export type AudioPreparationPhase = 'queued' | 'encoding' | 'encrypting' | 'publishing' | 'ready' | 'failed';
type Job = {
  progress?: AudioPreparationProgress;
  reason?: string;
  attempts?: number;
  failure?: { stage?: string; storageStatus?: number };
  id: string;
  state: AudioPreparationPhase;
  result?: { ref: string; runtimeAddress: string; contentHash: string; keyVersion: string };
};
const phases: AudioPreparationPhase[] = ['queued', 'encoding', 'encrypting', 'publishing', 'ready', 'failed'];
export const AUDIO_PREPARATION_LABELS: Record<AudioPreparationPhase, string> = {
  queued: 'Your music is queued',
  encoding: 'Preparing streaming audio',
  encrypting: 'Protecting your music',
  publishing: 'Saving your prepared music',
  ready: 'Your music is ready',
  failed: 'Audio preparation needs another try'
};
export function audioPreparationLabel(phase: AudioPreparationPhase, progress?: AudioPreparationProgress) {
  if (phase !== 'publishing' || !progress) return AUDIO_PREPARATION_LABELS[phase];
  return progress.storedBlocks === progress.totalBlocks
    ? 'Checking your saved music'
    : `Saving your music: ${Math.floor((100 * progress.storedBlocks) / progress.totalBlocks)}% confirmed`;
}
export function readPreparationId(key: string): string | null {
  try {
    const id = localStorage.getItem(key);
    return id && /^[0-9a-f-]{36}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export async function waitForAudioPreparation(input: {
  job: unknown;
  storageKey: string;
  request: (id: string, retry?: boolean) => Promise<unknown>;
  onProgress?: (phase: AudioPreparationPhase, progress?: AudioPreparationProgress) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  retryFailed?: boolean;
  discard?: (id: string) => Promise<void>;
}) {
  const now = input.now ?? Date.now;
  const started = now();
  const sleep = input.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  let job = input.job as Job;
  let id: string | null = null;
  let previous: string | undefined;
  let lastChange = started;
  for (;;) {
    if (!job || typeof job.id !== 'string' || !/^[0-9a-f-]{36}$/.test(job.id) || !phases.includes(job.state) || (id && job.id !== id))
      throw new Error('Invalid audio preparation response.');
    id = job.id;
    try {
      localStorage.setItem(input.storageKey, id);
    } catch {
      /* Server job remains durable when local storage is unavailable. */
    }
    const progress = job.progress;
    if (
      progress &&
      (!Number.isSafeInteger(progress.storedBlocks) ||
        !Number.isSafeInteger(progress.totalBlocks) ||
        progress.storedBlocks < 0 ||
        progress.totalBlocks < 1 ||
        progress.totalBlocks > 2048 ||
        progress.storedBlocks > progress.totalBlocks)
    )
      throw new Error('Invalid audio preparation progress.');
    const checkpoint = `${job.state}:${progress?.storedBlocks ?? ''}:${progress?.totalBlocks ?? ''}`;
    if (checkpoint !== previous) {
      input.onProgress?.(job.state, progress);
      previous = checkpoint;
      lastChange = now();
    }
    if (job.state === 'ready') {
      if (!job.result || !job.result.ref.startsWith('dotify:enc:v3:key-v')) throw new Error('The prepared audio reference is missing.');
      try {
        localStorage.removeItem(input.storageKey);
      } catch {
        /* No sensitive material is stored. */
      }
      return job.result;
    }
    if (job.state === 'failed') {
      const needsAdmission = job.reason === 'PUBLICATION_NOT_ADMITTED';
      const canRetry = !needsAdmission && (job.attempts === undefined || job.attempts < 3);
      if (input.retryFailed && canRetry) {
        input.retryFailed = false;
        try {
          job = (await input.request(id, true)) as Job;
        } catch (error) {
          const code = (error as { code?: string })?.code ?? '';
          throw new AudioPreparationError(
            error instanceof Error ? error.message : 'Preparation could not resume.',
            code !== 'STREAMING_PUBLICATION_NOT_ADMITTED' && input.discard ? () => input.discard!(id!) : undefined,
            !['STREAMING_RETRY_LIMIT', 'STREAMING_PUBLICATION_NOT_ADMITTED'].includes(code)
          );
        }
        continue;
      }
      throw new AudioPreparationError(
        needsAdmission
          ? 'New release publishing is not enabled for this audio yet. Your draft is safe. Please contact the Dotify operator before trying again.'
          : !canRetry
            ? 'This preparation has reached its retry limit. Your draft is safe. Please contact the Dotify operator to recover it.'
            : job.failure?.stage === 'storage' && job.failure.storageStatus === 403
              ? 'The storage service is refusing new uploads. Your prepared music is saved. Please try again after the service is restored.'
              : job.failure?.stage === 'storage'
                ? 'The storage service could not save your prepared audio. Your upload is saved. Try publishing again to resume.'
                : 'Audio preparation could not finish. Your upload is saved. Try publishing again to resume.',
        !needsAdmission && input.discard ? () => input.discard!(id!) : undefined,
        canRetry
      );
    }
    // A healthy stream of confirmed receipts can outlive the former 15-minute
    // foreground limit. An idle or very long wait hands back the saved job;
    // it never retries, discards it, or labels it a storage failure.
    if (now() - lastChange > 15 * 60_000 || now() - started > 2 * 60 * 60_000) throw new AudioPreparationPending();
    await sleep(2500);
    let failure: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        job = (await input.request(id)) as Job;
        failure = undefined;
        break;
      } catch (error) {
        failure = error;
        if (attempt < 2) await sleep(1000 * (attempt + 1));
      }
    }
    if (failure) {
      if (failure instanceof Error && ['TimeoutError', 'AbortError', 'TypeError'].includes(failure.name))
        throw new AudioPreparationPending(
          'Preparation could not be checked over this connection. Your saved job can be checked again without starting a new release.'
        );
      throw failure;
    }
  }
}
