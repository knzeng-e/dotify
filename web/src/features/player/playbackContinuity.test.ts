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

it('excludes native paused time, retains a handoff intent and drops it for explicit replay', () => {
  let now = 0;
  const metrics = new PlaybackContinuity(() => now);
  metrics.event('playing');
  now = 900;
  metrics.nativePause();
  now = 5000;
  expect(metrics.snapshot().playingMs).toBe(900);
  metrics.transition();
  now = 5100;
  metrics.nativePause();
  now = 5200;
  metrics.event('playing');
  expect(metrics.snapshot().nextLatencyMs).toEqual([200]);
  metrics.transition();
  metrics.clearIntent();
  now = 9000;
  metrics.event('playing');
  expect(metrics.snapshot().nextLatencyMs).toEqual([200]);
});
