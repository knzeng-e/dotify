export type SystemMediaControls = {
  play: () => void;
  pause: () => void;
  next?: () => void;
  previous?: () => void;
  seek?: (seconds: number) => void;
};

/** Unsupported actions are individually optional; no global feature flag. */
export function bindMediaSession(session: MediaSession, controls: SystemMediaControls): () => void {
  const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
    play: controls.play,
    pause: controls.pause,
    ...(controls.next ? { nexttrack: controls.next } : {}),
    ...(controls.previous ? { previoustrack: controls.previous } : {}),
    ...(controls.seek
      ? {
          seekto: (event: MediaSessionActionDetails) => {
            if (Number.isFinite(event.seekTime)) controls.seek!(event.seekTime!);
          }
        }
      : {})
  };
  const actions: MediaSessionAction[] = ['play', 'pause', 'nexttrack', 'previoustrack', 'seekto', 'seekbackward', 'seekforward'];
  // Music navigation uses track boundaries. Clear relative-seek handlers left
  // by an earlier source; foreground/absolute timeline seeking stays available.
  for (const action of actions) {
    try {
      session.setActionHandler(action, handlers[action] ?? null);
    } catch {
      /* Host does not expose this action. */
    }
  }
  return () => {
    for (const action of actions) {
      try {
        session.setActionHandler(action, null);
      } catch {
        /* Optional capability. */
      }
    }
  };
}
