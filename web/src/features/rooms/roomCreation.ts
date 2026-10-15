/** One creation intent spans audio preparation, permission and its server ACK.
 * Completion is terminal: cancelling a later dialog must not leave a live room.
 */
export class RoomCreationController {
  private pending: { controller: AbortController; sent: boolean } | null = null;

  begin(): AbortSignal {
    this.cancel();
    const controller = new AbortController();
    this.pending = { controller, sent: false };
    return controller.signal;
  }

  isCurrent(signal: AbortSignal): boolean {
    return this.pending?.controller.signal === signal && !signal.aborted;
  }

  markSent(signal: AbortSignal): void {
    if (this.isCurrent(signal)) this.pending!.sent = true;
  }

  finish(signal: AbortSignal): boolean {
    if (!this.isCurrent(signal)) return false;
    this.pending = null;
    return true;
  }

  /** True means a room may exist server-side and must be left in wire order. */
  cancel(): boolean {
    const pending = this.pending;
    this.pending = null;
    pending?.controller.abort();
    return pending?.sent ?? false;
  }
}
