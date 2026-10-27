/** Session-local aggregate evidence. No release/account/room identifiers. */
export class PlaybackContinuity {
  private since: number | null = null;
  private state: 'playing' | 'waiting' | 'paused' = 'paused';
  private playingMs = 0;
  private waitingMs = 0;
  private intent: number | null = null;
  private nextMs: number[] = [];
  constructor(private now = () => performance.now()) {}
  transition() {
    this.event('paused');
    this.intent = this.now();
  }
  event(next: 'playing' | 'waiting' | 'paused') {
    const now = this.now();
    if (this.since !== null) {
      const elapsed = Math.max(0, now - this.since);
      if (this.state === 'playing') this.playingMs += elapsed;
      if (this.state === 'waiting') this.waitingMs += elapsed;
    }
    this.state = next;
    this.since = now;
    if (next === 'playing' && this.intent !== null) {
      this.nextMs = [...this.nextMs.slice(-39), Math.max(0, now - this.intent)];
      this.intent = null;
    }
    if (next === 'paused') this.intent = null;
  }
  reset() {
    this.playingMs = 0;
    this.waitingMs = 0;
    this.nextMs = [];
    this.intent = null;
    this.since = this.now();
  }
  snapshot() {
    const elapsed = this.since === null ? 0 : Math.max(0, this.now() - this.since);
    const playingMs = this.playingMs + (this.state === 'playing' ? elapsed : 0);
    const waitingMs = this.waitingMs + (this.state === 'waiting' ? elapsed : 0);
    return { nextLatencyMs: [...this.nextMs], playingMs, waitingMs, rebufferRatio: playingMs + waitingMs > 0 ? waitingMs / (playingMs + waitingMs) : 0 };
  }
}
export const playbackContinuity = new PlaybackContinuity();
