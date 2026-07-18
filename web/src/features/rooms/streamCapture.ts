// Pure decisions for the host audio-capture lifecycle (extracted from
// useSession so they can be unit-tested without a browser or a MediaStream).
//
// The host captures its <audio> element into a MediaStream that feeds every
// listener. Two decisions govern that capture: whether the existing capture can
// be reused for the current source (so play/pause/seek do not rebuild peers),
// and how many trackless attempts to tolerate before surfacing a genuine
// failure instead of retrying silently forever.

// A capture is reusable when it was taken from the exact current source and its
// track is still live. A capture taken while the media element was paused is
// reused only while the element is still paused; once playback starts, recapture
// so listeners are not left on a pre-playback live-but-silent stream.
export function shouldReuseCapture(
  capturedSource: string | null,
  currentSource: string,
  hasLiveAudio: boolean,
  capturedWhilePaused = false,
  currentPaused = false
): boolean {
  return capturedSource === currentSource && hasLiveAudio && (!capturedWhilePaused || currentPaused);
}

export type CaptureAttempt = { source: string | null; count: number };

// How many consecutive trackless capture attempts to tolerate for one source
// before treating it as a real failure. Capture legitimately yields no track
// once or twice (before playback starts), so this is > 1; a genuinely silent or
// unsupported asset never produces a track and trips the ceiling.
export const MAX_CAPTURE_ATTEMPTS = 4;

// Advance the trackless-attempt counter for a source. Resets when the source
// changes. `exhausted` is true once attempts reach the ceiling, so the caller
// can surface "capture unavailable" rather than retry on the next play event.
export function nextCaptureAttempt(
  previous: CaptureAttempt,
  source: string,
  max: number = MAX_CAPTURE_ATTEMPTS
): { attempt: CaptureAttempt; exhausted: boolean } {
  const count = previous.source === source ? previous.count + 1 : 1;
  return { attempt: { source, count }, exhausted: count >= max };
}
