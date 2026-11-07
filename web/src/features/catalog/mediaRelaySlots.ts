// The ciphertext relay accepts two distinct downloads per process. Keep a
// client's read-ahead/prefetch work from exhausting it by itself. A slot covers
// the complete response body, not just its headers; queued work is cancellable.
const MAX_ACTIVE_RELAY_READS = 2;
const waiting: Array<() => void> = [];
let active = 0;

function drain() {
  while (active < MAX_ACTIVE_RELAY_READS && waiting.length) waiting.shift()!();
}

export function acquireMediaRelaySlot(signal: AbortSignal): Promise<() => void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      const index = waiting.indexOf(start);
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
    waiting.push(start);
    signal.addEventListener('abort', abort, { once: true });
    drain();
  });
}
