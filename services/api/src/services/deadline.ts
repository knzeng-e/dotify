/** Keep the controller strongly owned by a live timer until completion. In Node
 * 22, a timeout signal used only through AbortSignal.any can be collected before
 * it fires. Dropping the timer makes a bounded publication silently unbounded. */
export function createDeadline(owner: AbortSignal, milliseconds: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Deadline exceeded', 'TimeoutError')), milliseconds);
  timer.unref();
  return { signal: AbortSignal.any([owner, controller.signal]), dispose: () => clearTimeout(timer) };
}
export async function withDeadline<T>(owner: AbortSignal, milliseconds: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const deadline = createDeadline(owner, milliseconds);
  try {
    deadline.signal.throwIfAborted();
    return await run(deadline.signal);
  } finally {
    deadline.dispose();
  }
}
