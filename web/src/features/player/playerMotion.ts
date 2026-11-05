import { flushSync } from 'react-dom';

type Transition = { finished: Promise<void>; updateCallbackDone: Promise<void>; ready?: Promise<void>; skipTransition(): void };
type MotionPort = {
  available(): boolean;
  immediate(): boolean;
  direction(value: 'open' | 'close' | null): void;
  start(update: () => void): Transition;
};

/** Explicit UI navigation only. Reversed gestures cannot replay an older route. */
export function createPlayerMotion(port: MotionPort) {
  let pending: { token: symbol; commit(): void; transition: Transition } | null = null;
  return (direction: 'open' | 'close', update: () => void) => {
    if (pending) {
      // The platform still calls an update after skipTransition. Complete it
      // once before the newer intent, then make its delayed callback harmless.
      pending.commit();
      try {
        pending.transition.skipTransition();
      } catch {
        /* A partial Host must not prevent the newer intent. */
      }
      pending = null;
    }
    let committed = false;
    const commit = () => {
      if (!committed) {
        committed = true;
        update();
      }
    };
    if (!port.available() || port.immediate()) {
      port.direction(null);
      commit();
      return;
    }
    const token = Symbol('player navigation');
    port.direction(direction);
    try {
      const transition = port.start(commit);
      pending = { token, commit, transition };
      void transition.ready?.catch(() => {});
      void transition.updateCallbackDone.catch(commit);
      void transition.finished
        .catch(() => {})
        .finally(() => {
          if (pending?.token === token) {
            pending = null;
            port.direction(null);
          }
        });
    } catch {
      if (pending?.token === token) pending = null;
      port.direction(null);
      commit();
    }
  };
}

const navigate = createPlayerMotion({
  available: () => typeof document.startViewTransition === 'function',
  immediate: () => document.visibilityState === 'hidden' || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  direction: value => {
    if (value) document.documentElement.dataset.playerMotion = value;
    else delete document.documentElement.dataset.playerMotion;
  },
  start: update => document.startViewTransition(update)
});

export function animatePlayerNavigation(direction: 'open' | 'close', update: () => void) {
  navigate(direction, () => flushSync(update));
}
