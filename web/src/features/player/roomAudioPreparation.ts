/** One offscreen Room preparation. It never owns or retires the audible source. */
export class RoomAudioPreparation {
  private controller: AbortController | null = null;

  cancel() {
    this.controller?.abort();
    this.controller = null;
  }

  async run<T>(input: {
    signals: AbortSignal[];
    isCurrent: () => boolean;
    prepare: (signal: AbortSignal, authorized: () => void) => Promise<T>;
    timeoutMs: number;
  }): Promise<T> {
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    const cancel = () => controller.abort();
    const check = () => {
      controller.signal.throwIfAborted();
      if (!input.isCurrent()) throw new DOMException('Listening changed', 'AbortError');
    };
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const authorized = () => {
      check();
      timeout ??= setTimeout(() => controller.abort(new DOMException('Room audio preparation timed out', 'TimeoutError')), input.timeoutMs);
    };
    for (const signal of input.signals) {
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    }
    let onAbort: () => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
      check();
      const result = await Promise.race([input.prepare(controller.signal, authorized), aborted]);
      check();
      return result;
    } finally {
      clearTimeout(timeout);
      for (const signal of input.signals) signal.removeEventListener('abort', cancel);
      controller.signal.removeEventListener('abort', onAbort);
      if (this.controller === controller) this.controller = null;
    }
  }
}
