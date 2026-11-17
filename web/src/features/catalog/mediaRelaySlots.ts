// The ciphertext relay accepts two distinct downloads per process. Keep a
// client's read-ahead/prefetch work from exhausting it by itself. A slot covers
// the complete response body, not just its headers; queued work is cancellable.
const MAX_ACTIVE_RELAY_READS = 2;
type Priority = 'playback' | 'preparation';
const waiting: Array<{ start: () => void; priority: Priority }> = [];
let active = 0;

function drain() {
  while (active < MAX_ACTIVE_RELAY_READS && waiting.length) waiting.shift()!.start();
}

export function acquireMediaRelaySlot(signal: AbortSignal, priority: Priority = 'playback'): Promise<() => void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      const index = waiting.findIndex(item => item.start === start);
      if (index >= 0) waiting.splice(index, 1);
      reject(signal.reason);
    };
    const start = () => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      active++;
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        active--;
        drain();
      });
    };
    // Audible playback must not queue behind a full-file Room preparation.
    // Active bodies still finish normally; priority never increases capacity.
    const background = waiting.findIndex(item => item.priority === 'preparation');
    if (priority === 'playback' && background >= 0) waiting.splice(background, 0, { start, priority });
    else waiting.push({ start, priority });
    signal.addEventListener('abort', abort, { once: true });
    drain();
  });
}
