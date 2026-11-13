/** Local timing only. Never retain the track, image URL/pixels or account. */
const phases = new Set([
  'requested',
  'prepared-hit',
  'image-load-started',
  'image-ready',
  'decode-started',
  'decoded',
  'composed',
  'fallback',
  'retry-requested',
  'metadata-published',
  'failed',
  'cancelled',
  'retired'
] as const);
export type SystemArtworkPhase = typeof phases extends Set<infer T> ? T : never;
export type SystemArtworkKind = 'png' | 'url' | 'none';
export type SystemArtworkObservation = {
  attempt: number;
  phase: SystemArtworkPhase;
  elapsedMs: number;
  timestamp: number;
  visibility: 'visible' | 'hidden' | 'unknown';
  kind?: SystemArtworkKind;
};
export type SystemArtworkObserver = (phase: SystemArtworkPhase, kind?: SystemArtworkKind) => void;
const MAX_EVENTS = 64;
let events: SystemArtworkObservation[] = [];
let nextAttempt = 0;
let generation = 0;
const now = () => performance.now();

export function beginSystemArtworkObservation(): SystemArtworkObserver {
  const attempt = ++nextAttempt;
  const owner = generation;
  const startedAt = now();
  const observe: SystemArtworkObserver = (phase, kind) => {
    if (owner !== generation || !phases.has(phase)) return;
    const visibility = typeof document === 'undefined' ? 'unknown' : document.visibilityState;
    events.push({
      attempt,
      phase,
      elapsedMs: Math.max(0, now() - startedAt),
      timestamp: Date.now(),
      visibility: visibility === 'visible' || visibility === 'hidden' ? visibility : 'unknown',
      ...(kind === 'png' || kind === 'url' || kind === 'none' ? { kind } : {})
    });
    if (events.length > MAX_EVENTS) events.shift();
  };
  observe('requested');
  return observe;
}

export function systemArtworkObservations(): SystemArtworkObservation[] {
  return events.map(event => ({ ...event }));
}

export function clearSystemArtworkObservations() {
  events = [];
  nextAttempt = 0;
  generation++;
}

/** Export-local attempt numbers; exact fields only, even for supplied snapshots. */
export function serializeSystemArtworkObservations(input: readonly SystemArtworkObservation[]): SystemArtworkObservation[] {
  const attempts = new Map<number, number>();
  return (Array.isArray(input) ? input : []).slice(-MAX_EVENTS).flatMap((event): SystemArtworkObservation[] => {
    if (
      !event ||
      !phases.has(event.phase) ||
      !Number.isSafeInteger(event.attempt) ||
      event.attempt < 1 ||
      !Number.isFinite(event.elapsedMs) ||
      event.elapsedMs < 0 ||
      !Number.isFinite(event.timestamp) ||
      event.timestamp < 0
    )
      return [];
    if (!attempts.has(event.attempt)) attempts.set(event.attempt, attempts.size + 1);
    return [
      {
        attempt: attempts.get(event.attempt)!,
        phase: event.phase,
        elapsedMs: event.elapsedMs,
        timestamp: event.timestamp,
        visibility: event.visibility === 'visible' || event.visibility === 'hidden' ? event.visibility : 'unknown',
        ...(event.kind === 'png' || event.kind === 'url' || event.kind === 'none' ? { kind: event.kind } : {})
      }
    ];
  });
}
