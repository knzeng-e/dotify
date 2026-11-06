/** Local, bounded diagnostics: no URLs, keys, accounts or room identifiers. */
export type AudioOutputObservation = {
  generation: number;
  event: string;
  timestamp: number;
  contextState: string;
  contextSeconds: number;
  mediaSeconds: number;
  paused: boolean;
  readyState: number;
  visibility: string;
  sessionType?: string;
  sessionState?: string;
};
type AudioSession = { type: string; readonly state?: string };
let observations: AudioOutputObservation[] = [];
let nextGeneration = 0;
const leases = new Set<object>();
let session: AudioSession | undefined;
let originalType: string | undefined;
export const audioOutputObservations = () => observations.map(item => ({ ...item }));
export const clearAudioOutputObservations = () => {
  observations = [];
};

function acquirePlaybackSession() {
  const lease = {};
  if (!leases.size) {
    try {
      session = (navigator as Navigator & { audioSession?: AudioSession }).audioSession;
      originalType = session?.type;
      if (session) session.type = 'playback';
    } catch {
      /* Optional native policy: ordinary playback must still work. */
    }
  }
  leases.add(lease);
  return () => {
    leases.delete(lease);
    if (!leases.size) {
      try {
        // Do not overwrite a policy installed by another owner in the meantime.
        if (session?.type === 'playback' && originalType !== undefined) session.type = originalType;
      } catch {
        /* Optional policy restoration. */
      }
      session = undefined;
      originalType = undefined;
    }
  };
}

/** Observe the real graph, not only HTMLMediaElement.playing. No keepalive or microphone. */
export function bindAudioOutputLifecycle(audio: HTMLMediaElement, context: AudioContext, silence: () => void) {
  const releaseSession = acquirePlaybackSession();
  const generation = ++nextGeneration;
  let released = false;
  let hasRun = context.state === 'running';
  const observe = (event: string) => {
    if (released) return;
    let sessionInfo = {};
    try {
      sessionInfo = { sessionType: session?.type, sessionState: session?.state };
    } catch {
      /* Optional SDK surface. */
    }
    observations = [
      ...observations.slice(-95),
      {
        generation,
        event,
        timestamp: Date.now(),
        contextState: context.state,
        contextSeconds: context.currentTime,
        mediaSeconds: audio.currentTime,
        paused: audio.paused,
        readyState: audio.readyState,
        visibility: document.visibilityState,
        ...sessionInfo
      }
    ];
  };
  const interrupted = () => {
    if (released || audio.paused || audio.ended) return;
    observe('output-interrupted');
    // Do not let a silent graph consume the rest of a track. Explicit Play is
    // the only recovery: foreground/OS events cannot override Pause or access loss.
    silence();
    audio.pause();
    audio.dispatchEvent(new Event('dotify:output-interrupted'));
  };
  const stateChanged = () => {
    observe('context-state');
    if (context.state === 'running') hasRun = true;
    else if (hasRun) interrupted();
  };
  const visible = () => {
    observe('visibility');
    if (document.visibilityState === 'visible') stateChanged();
  };
  const pageshow = () => observe('pageshow');
  const mediaEvents = ['loadedmetadata', 'canplay', 'playing', 'pause', 'waiting', 'ended'];
  const media = (event: Event) => observe(event.type);
  context.addEventListener('statechange', stateChanged);
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('pageshow', pageshow);
  mediaEvents.forEach(event => audio.addEventListener(event, media));
  observe('attached');
  return {
    async resume() {
      if (released) throw new Error('Audio output has retired.');
      observe('resume-requested');
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          context.resume(),
          new Promise<void>((resolve, reject) => {
            timer = setTimeout(() => {
              if (context.state === 'running') resolve();
              else reject(new Error('Audio output did not resume. Tap Play to try again.'));
            }, 3000);
          })
        ]);
        if (released) return;
        if (context.state !== 'running') throw new Error('Audio output is interrupted. Tap Play to try again.');
        hasRun = true;
        observe('resume-ready');
      } catch (error) {
        if (!released) {
          observe('resume-failed');
          interrupted();
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
    release() {
      observe('retired');
      released = true;
      context.removeEventListener('statechange', stateChanged);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('pageshow', pageshow);
      mediaEvents.forEach(event => audio.removeEventListener(event, media));
      releaseSession();
    }
  };
}
