import { flushSync } from 'react-dom';

type Transition = { finished: Promise<void>; updateCallbackDone: Promise<void>; ready?: Promise<void>; skipTransition(): void };
type MotionPort = {
  available(): boolean;
  immediate(): boolean;
  direction(value: 'open' | 'close' | null): void;
  start(update: () => void): Transition;
};

/** Explicit UI navigation only. New route intent retires delayed captures. */
export function createPlayerMotion(port: MotionPort) {
  let pending: { token: symbol; commit(): void; cancel(): void; transition: Transition } | null = null;
  let applying = false;
  const invalidate = () => {
    // The animated callback goes through the same ordinary navigation provider.
    // It must not cancel itself while synchronously applying its own route.
    if (applying || !pending) return;
    const retired = pending;
    pending = null;
    retired.cancel();
    port.direction(null);
    try {
      retired.transition.skipTransition();
    } catch {
      /* A partial Host must not prevent the newer intent. */
    }
  };
  const navigate = (direction: 'open' | 'close', update: () => void) => {
    if (pending) {
      // The platform still calls an update after skipTransition. Complete it
      // once before the newer intent, then make its delayed callback harmless.
      pending.commit();
      invalidate();
    }
    let committed = false;
    let cancelled = false;
    const commit = () => {
      if (committed || cancelled) return;
      committed = true;
      applying = true;
      try {
        update();
      } finally {
        applying = false;
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
      pending = {
        token,
        commit,
        cancel: () => {
          cancelled = true;
        },
        transition
      };
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
  return Object.assign(navigate, { invalidate });
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

/** Called before every ordinary route intent, including browser Back/Forward. */
export function invalidatePlayerNavigation() {
  navigate.invalidate();
}
