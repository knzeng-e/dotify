import { describe, expect, it } from 'vitest';
import { artistSetupState, artistStudioLocked, canReviewRelease, nextReleaseStep, previousReleaseStep, RELEASE_STEPS } from './releaseForm';

describe('release step machine', () => {
  it('advances through the steps and clamps at the end', () => {
    expect(nextReleaseStep('assets')).toBe('metadata');
    expect(nextReleaseStep('metadata')).toBe('access');
    expect(nextReleaseStep('access')).toBe('review');
    expect(nextReleaseStep('review')).toBe('review');
  });

  it('goes back through the steps and clamps at the start', () => {
    expect(previousReleaseStep('review')).toBe('access');
    expect(previousReleaseStep('assets')).toBe('assets');
  });

  it('exposes the four steps in order', () => {
    expect(RELEASE_STEPS.map(step => step.id)).toEqual(['assets', 'metadata', 'access', 'review']);
  });
});

describe('canReviewRelease', () => {
  it('requires a file hash, a non-empty title, and an audio source', () => {
    expect(canReviewRelease({ fileHash: '0xabc', title: 'Song', audioSource: 'blob:x' })).toBe(true);
    expect(canReviewRelease({ fileHash: '', title: 'Song', audioSource: 'blob:x' })).toBe(false);
    expect(canReviewRelease({ fileHash: '0xabc', title: '   ', audioSource: 'blob:x' })).toBe(false);
    expect(canReviewRelease({ fileHash: '0xabc', title: 'Song', audioSource: null })).toBe(false);
  });
});

describe('artistSetupState', () => {
  it('walks wallet -> registration -> ready', () => {
    expect(artistSetupState(false, false)).toBe('Wallet needed');
    expect(artistSetupState(true, false)).toBe('Registration needed');
    expect(artistSetupState(true, true)).toBe('Ready');
  });
});

describe('artistStudioLocked', () => {
  it('locks only when registration is available but no runtime exists', () => {
    expect(artistStudioLocked(true, false)).toBe(true);
    expect(artistStudioLocked(true, true)).toBe(false);
    expect(artistStudioLocked(false, false)).toBe(false);
  });
});
