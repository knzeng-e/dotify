import { expect, it } from 'vitest';
import { PlaybackContinuity } from './playbackContinuity';
it('measures transition and rebuffer time separately from intentional pause', () => {
  let now = 0;
  const metrics = new PlaybackContinuity(() => now);
  metrics.event('playing');
  now = 900;
  metrics.event('waiting');
  now = 1000;
  metrics.event('playing');
  now = 2000;
  metrics.event('paused');
  now = 5000;
  metrics.transition();
  now = 5020;
  metrics.event('playing');
  expect(metrics.snapshot()).toEqual({ nextLatencyMs: [20], playingMs: 1900, waitingMs: 100, rebufferRatio: 0.05 });
});
