import { expect, it } from 'vitest';
import { AdaptiveStreaming } from './adaptiveStreaming';

it('starts low, ignores cache and upgrades only after sustained measured headroom', () => {
  const abr = new AdaptiveStreaming();
  abr.observe(1_000_000, 1, true);
  expect(abr.choose(0, 0)).toBe(96);
  expect(abr.choose(2, 20)).toBe(96);
  abr.observe(100_000, 500, false);
  expect(abr.choose(1, 4)).toBe(96);
  expect(abr.choose(2, 8)).toBe(320);
  expect(abr.choose(3, 20, true)).toBe(96);
});

it('downshifts after congestion rather than waiting for the upgrade interval', () => {
  const abr = new AdaptiveStreaming();
  abr.observe(100_000, 500, false);
  expect(abr.choose(2, 16)).toBe(320);
  for (let i = 0; i < 12; i++) abr.observe(1000, 1000, false);
  expect(abr.choose(3, 1)).toBe(96);
});
