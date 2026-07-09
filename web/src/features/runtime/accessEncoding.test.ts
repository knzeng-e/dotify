import { describe, expect, it } from 'vitest';
import { decodeAccessMode, decodePersonhood, encodeAccessMode, encodePersonhood, encodeRequiredPersonhood, manifestRequiredPersonhood } from './accessEncoding';

describe('access mode codec', () => {
  it('encodes and decodes round-trip', () => {
    expect(encodeAccessMode('human-free')).toBe(0);
    expect(encodeAccessMode('classic')).toBe(1);
    expect(encodeAccessMode('free')).toBe(2);
    expect(decodeAccessMode(0)).toBe('human-free');
    expect(decodeAccessMode(1)).toBe('classic');
    expect(decodeAccessMode(2)).toBe('free');
  });

  it('decodes unknown values as human-free', () => {
    expect(decodeAccessMode(7)).toBe('human-free');
  });
});

describe('personhood codec', () => {
  it('encodes and decodes round-trip', () => {
    expect(encodePersonhood('DIM1')).toBe(1);
    expect(encodePersonhood('DIM2')).toBe(2);
    expect(decodePersonhood(1)).toBe('DIM1');
    expect(decodePersonhood(2)).toBe('DIM2');
  });

  it('decodes unknown values as DIM1', () => {
    expect(decodePersonhood(0)).toBe('DIM1');
  });
});

describe('encodeRequiredPersonhood', () => {
  it('carries the personhood level only for human-free tracks', () => {
    expect(encodeRequiredPersonhood('human-free', 'DIM2')).toBe(2);
    expect(encodeRequiredPersonhood('human-free', 'DIM1')).toBe(1);
    expect(encodeRequiredPersonhood('classic', 'DIM2')).toBe(0);
    expect(encodeRequiredPersonhood('free', 'DIM2')).toBe(0);
  });
});

describe('manifestRequiredPersonhood', () => {
  it('uses the level for human-free and None for classic', () => {
    expect(manifestRequiredPersonhood('human-free', 'DIM2')).toBe('DIM2');
    expect(manifestRequiredPersonhood('classic', 'DIM2')).toBe('None');
    expect(manifestRequiredPersonhood('free', 'DIM2')).toBe('None');
  });
});
