export const contributionReconciliationDelaysMs = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000] as const;

type VisibilitySource = {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: EventListener): void;
  removeEventListener(type: 'visibilitychange', listener: EventListener): void;
};

export function contributionReconciliationDelay(retry: number): number | undefined {
  return contributionReconciliationDelaysMs[retry];
}

/** Recheck on foreground return instead of restarting a long backoff after a
 * wallet excursion. Hidden pages never initiate a confirmation read. */
export function waitForContributionReconciliation(milliseconds: number, signal: AbortSignal, visibility: VisibilitySource = document): Promise<boolean> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    let wasHidden = visibility.visibilityState === 'hidden';
    let elapsed = false;
    const timer = setTimeout(() => {
      elapsed = true;
      if (visibility.visibilityState !== 'hidden') finish(true);
    }, milliseconds);
    const changed: EventListener = () => {
      if (visibility.visibilityState === 'hidden') wasHidden = true;
      else if (wasHidden || elapsed) finish(true);
    };
    const abort = () => finish(false);
    function finish(value: boolean) {
      clearTimeout(timer);
      visibility.removeEventListener('visibilitychange', changed);
      signal.removeEventListener('abort', abort);
      resolve(value);
    }
    visibility.addEventListener('visibilitychange', changed);
    signal.addEventListener('abort', abort, { once: true });
  });
}
