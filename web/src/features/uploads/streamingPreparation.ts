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
export type AudioPreparationPhase = 'queued' | 'encoding' | 'encrypting' | 'publishing' | 'ready' | 'failed';
type Job = {
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
  onProgress?: (phase: AudioPreparationPhase) => void;
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
  let previous: AudioPreparationPhase | undefined;
  for (;;) {
    if (!job || typeof job.id !== 'string' || !/^[0-9a-f-]{36}$/.test(job.id) || !phases.includes(job.state) || (id && job.id !== id))
      throw new Error('Invalid audio preparation response.');
    id = job.id;
    try {
      localStorage.setItem(input.storageKey, id);
    } catch {
      /* Server job remains durable when local storage is unavailable. */
    }
    if (job.state !== previous) {
      input.onProgress?.(job.state);
      previous = job.state;
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
      const canRetry = job.attempts === undefined || job.attempts < 3;
      if (input.retryFailed && canRetry) {
        input.retryFailed = false;
        try {
          job = (await input.request(id, true)) as Job;
        } catch (error) {
          throw new AudioPreparationError(
            error instanceof Error ? error.message : 'Preparation could not resume.',
            input.discard ? () => input.discard!(id!) : undefined,
            (error as { code?: string })?.code !== 'STREAMING_RETRY_LIMIT'
          );
        }
        continue;
      }
      throw new AudioPreparationError(
        !canRetry
          ? 'This preparation has reached its retry limit. Your draft is safe. Please contact the Dotify operator to recover it.'
          : job.failure?.stage === 'storage' && job.failure.storageStatus === 403
            ? 'The storage service is refusing new uploads. Your prepared music is saved. Please try again after the service is restored.'
            : job.failure?.stage === 'storage'
              ? 'The storage service could not save your prepared audio. Your upload is saved. Try publishing again to resume.'
              : 'Audio preparation could not finish. Your upload is saved. Try publishing again to resume.',
        input.discard ? () => input.discard!(id!) : undefined,
        canRetry
      );
    }
    if (now() - started > 15 * 60_000) throw new Error('Your music is still being prepared. You can return and resume without uploading it again.');
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
    if (failure) throw failure;
  }
}
