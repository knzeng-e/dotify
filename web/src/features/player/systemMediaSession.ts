export type SystemMediaControls = {
  play: () => void;
  pause: () => void;
  next?: () => void;
  previous?: () => void;
  seek?: (seconds: number) => void;
  position: () => number;
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
          },
          seekbackward: (event: MediaSessionActionDetails) => controls.seek!(controls.position() - (event.seekOffset ?? 10)),
          seekforward: (event: MediaSessionActionDetails) => controls.seek!(controls.position() + (event.seekOffset ?? 10))
        }
      : {})
  };
  const actions: MediaSessionAction[] = ['play', 'pause', 'nexttrack', 'previoustrack', 'seekto', 'seekbackward', 'seekforward'];
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
