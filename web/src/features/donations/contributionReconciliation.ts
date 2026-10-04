export const contributionReconciliationDelaysMs = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000] as const;

type VisibilitySource = {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: EventListener): void;
  removeEventListener(type: 'visibilitychange', listener: EventListener): void;
};

export function contributionReconciliationDelay(retry: number): number | undefined {
  return contributionReconciliationDelaysMs[retry];
}

function waitForDelay(milliseconds: number, signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => finish(true), milliseconds);
    const abort = () => finish(false);
    function finish(completed: boolean) {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      resolve(completed);
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}

function waitUntilVisible(signal: AbortSignal, visibility: VisibilitySource): Promise<boolean> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    if (visibility.visibilityState !== 'hidden') {
      resolve(true);
      return;
    }
    const changed: EventListener = () => {
      if (visibility.visibilityState !== 'hidden') finish(true);
    };
    const abort = () => finish(false);
    function finish(visible: boolean) {
      visibility.removeEventListener('visibilitychange', changed);
      signal.removeEventListener('abort', abort);
      resolve(visible);
    }
    visibility.addEventListener('visibilitychange', changed);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function waitForContributionReconciliation(milliseconds: number, signal: AbortSignal, visibility: VisibilitySource = document): Promise<boolean> {
  while (!signal.aborted) {
    if (!(await waitUntilVisible(signal, visibility))) return false;
    if (!(await waitForDelay(milliseconds, signal))) return false;
    if (visibility.visibilityState !== 'hidden') return true;
  }
  return false;
}
