/** A replacement source for the same selection must keep the listener's clock. */
export type AudioContinuation = {
  source: string;
  currentTime: number;
  duration: number;
};

export function captureAudioContinuation(audio: HTMLAudioElement | null, source: string): AudioContinuation | null {
  if (!audio || !Number.isFinite(audio.currentTime)) return null;
  return {
    source,
    currentTime: Math.max(0, audio.currentTime),
    duration: Number.isFinite(audio.duration) ? audio.duration : 0
  };
}

/** Call after metadata, before play. A failed seek must never silently restart. */
export function restoreAudioContinuation(audio: HTMLAudioElement, continuation: AudioContinuation): void {
  const end = Number.isFinite(audio.duration) ? Math.max(0, audio.duration) : continuation.currentTime;
  audio.currentTime = Math.min(continuation.currentTime, end);
}
