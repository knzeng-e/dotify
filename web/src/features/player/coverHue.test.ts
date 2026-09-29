import { describe, expect, it } from 'vitest';
import { dominantCoverHue } from './coverHue';

describe('cover-derived tint', () => {
  it('recognizes saturated artwork colors', () => {
    expect(dominantCoverHue([255, 0, 0, 255])).toBe(0);
    expect(dominantCoverHue([0, 255, 0, 255])).toBe(120);
    expect(dominantCoverHue([0, 0, 255, 255])).toBe(240);
  });
  it('ignores neutral borders and transparent pixels', () => {
    expect(dominantCoverHue([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 0, 0, 255, 0, 255])).toBe(120);
    expect(dominantCoverHue([128, 128, 128, 255])).toBeNull();
    expect(dominantCoverHue([])).toBeNull();
  });
  it('chooses the most represented chromatic family', () => {
    expect(dominantCoverHue([0, 0, 255, 255, 255, 0, 0, 255, 200, 0, 0, 255])).toBe(0);
  });
});
