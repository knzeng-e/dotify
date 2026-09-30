export type CelerityMetric = {
  at: number;
  channel?: 'private';
  kind?: 'reaction' | 'chat' | 'request';
  event:
    | 'starting'
    | 'ready'
    | 'unsupported'
    | 'unavailable'
    | 'interrupted'
    | 'timeout'
    | 'stopped'
    | 'submitted'
    | 'rejected'
    | 'budget'
    | 'invalid'
    | 'accepted'
    | 'self-echo'
    | 'duplicate'
    | 'reordered'
    | 'capacity';
  bytes?: number;
  durationMs?: number;
  gap?: number;
  ageMs?: number;
};

const events: CelerityMetric[] = [];

export function recordCelerityMetric(metric: CelerityMetric) {
  events.push(metric);
  if (events.length > 200) events.shift();
}

export function celeritySnapshot() {
  return {
    version: 1,
    authority: 'socket.io' as const,
    buildSha: import.meta.env.VITE_DOTIFY_BUILD_SHA || null,
    productAppVersion: import.meta.env.VITE_DOTIFY_PRODUCT_APP_VERSION || null,
    mode: import.meta.env.VITE_DOTIFY_ROOM_REALTIME || 'off',
    observations: events.map(event => ({ ...event }))
  };
}

declare global {
  interface Window {
    __DOTIFY_ROOM_REALTIME__?: { snapshot: typeof celeritySnapshot; clear: () => void };
  }
}

export function installCelerityDiagnostics() {
  if (typeof window !== 'undefined')
    window.__DOTIFY_ROOM_REALTIME__ = {
      snapshot: celeritySnapshot,
      clear: () => {
        events.length = 0;
      }
    };
}
