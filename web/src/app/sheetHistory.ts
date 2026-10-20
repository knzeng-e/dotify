import { historyStateObject, SHEET_HISTORY_KEY } from './routing';

type HistoryPort = Pick<History, 'state' | 'pushState' | 'replaceState' | 'back'>;

// One transient entry belongs to the visible contextual sheet. Replacement
// sheets and React effect replay reuse it; they must not add another Back step.
export function createSheetHistory(history: HistoryPort, href: () => string, schedule: (task: () => void) => void = queueMicrotask) {
  let sequence = 0;
  let entry: number | null = null;
  let owner: { close: () => void } | null = null;
  let returning = false;
  const marker = () => (history.state as Record<string, unknown> | null)?.[SHEET_HISTORY_KEY];

  function attach() {
    if (returning || (entry !== null && marker() === entry)) return;
    entry = ++sequence;
    try {
      history.pushState({ ...historyStateObject(history.state), [SHEET_HISTORY_KEY]: entry }, '', href());
    } catch {
      // Some embedded hosts restrict history. Close/Escape remain available.
      entry = null;
    }
  }

  return {
    open(close: () => void) {
      const lease = { close };
      owner = lease;
      attach();
      return () => {
        if (owner !== lease) return;
        owner = null;
        schedule(() => {
          if (owner || returning || entry === null || marker() !== entry) return;
          returning = true;
          history.back();
        });
      };
    },
    onPop() {
      if (returning) {
        returning = false;
        entry = null;
        schedule(() => {
          if (owner) attach();
        });
        return;
      }
      if (owner && marker() !== entry) {
        const previous = owner;
        owner = null;
        entry = null;
        previous.close();
      }
      if (!owner && marker() !== undefined) {
        // Forward must not revive a dismissed sheet or carry its marker into
        // a later navigation. Its underlying page remains a valid destination.
        history.replaceState(historyStateObject(history.state), '', href());
      }
    }
  };
}

let browserSheets: ReturnType<typeof createSheetHistory> | undefined;
export function openSheetHistory(close: () => void) {
  if (!browserSheets) {
    browserSheets = createSheetHistory(window.history, () => window.location.href);
    window.addEventListener('popstate', browserSheets.onPop);
  }
  return browserSheets.open(close);
}
