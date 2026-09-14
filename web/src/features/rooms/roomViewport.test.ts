import { expect, it } from 'vitest';
import { keyboardOccludesRoom } from './roomViewport';
it('recognizes the keyboard even when both viewport heights shrink or focus zooms', () => {
  expect(keyboardOccludesRoom(844, 310, 1)).toBe(true);
  expect(keyboardOccludesRoom(844, 310, 1.15)).toBe(true);
});
it('does not mistake pinch zoom or modest browser chrome movement for a keyboard', () => {
  expect(keyboardOccludesRoom(844, 422, 2)).toBe(false);
  expect(keyboardOccludesRoom(844, 780, 1)).toBe(false);
  expect(keyboardOccludesRoom(844, 844, 1)).toBe(false);
  expect(keyboardOccludesRoom(844, NaN, 1)).toBe(false);
});
