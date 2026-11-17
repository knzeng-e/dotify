/** Conservative per-playback estimator. Cached bytes never count as throughput. */
export class AdaptiveStreaming {
  private kbps: number | null = null;
  private current: 96 | 160 | 320 = 96;
  private lastChange = 0;

  observe(bytes: number, milliseconds: number, cached: boolean) {
    if (cached || bytes <= 0 || milliseconds < 10 || !Number.isFinite(milliseconds)) return;
    const sample = (bytes * 8) / milliseconds;
    this.kbps = this.kbps === null || sample < this.kbps ? sample : 0.35 * sample + 0.65 * this.kbps;
  }

  choose(index: number, bufferedSeconds: number, saveData = false): 96 | 160 | 320 {
    if (!index || saveData || this.kbps === null) return (this.current = 96);
    const budget = this.kbps * 0.55;
    const desired = budget >= 320 ? 320 : budget >= 160 ? 160 : 96;
    // Downshift promptly; upgrade only with headroom and two stable segments.
    if (desired < this.current || (desired > this.current && bufferedSeconds >= 8 && index - this.lastChange >= 2)) {
      this.current = desired;
      this.lastChange = index;
    }
    return this.current;
  }

  get throughputKbps() {
    return this.kbps;
  }
}
