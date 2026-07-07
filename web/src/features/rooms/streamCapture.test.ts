import { describe, expect, it } from 'vitest';
import { MAX_CAPTURE_ATTEMPTS, nextCaptureAttempt, shouldReuseCapture } from './streamCapture';

describe('shouldReuseCapture', () => {
  it('reuses when the source is unchanged and the track is live', () => {
    expect(shouldReuseCapture('blob:a', 'blob:a', true)).toBe(true);
  });

  it('does not reuse when the source changed (track skip/next)', () => {
    expect(shouldReuseCapture('blob:a', 'blob:b', true)).toBe(false);
  });

  it('does not reuse when the current stream has no live track', () => {
    expect(shouldReuseCapture('blob:a', 'blob:a', false)).toBe(false);
  });

  it('does not reuse before anything has been captured', () => {
    expect(shouldReuseCapture(null, 'blob:a', true)).toBe(false);
  });
});

describe('nextCaptureAttempt', () => {
  it('starts a fresh count for a new source', () => {
    expect(nextCaptureAttempt({ source: null, count: 0 }, 'blob:a')).toEqual({
      attempt: { source: 'blob:a', count: 1 },
      exhausted: false
    });
  });

  it('increments while the source is unchanged', () => {
    const first = nextCaptureAttempt({ source: null, count: 0 }, 'blob:a');
    const second = nextCaptureAttempt(first.attempt, 'blob:a');
    expect(second.attempt.count).toBe(2);
    expect(second.exhausted).toBe(false);
  });

  it('resets the count when the source changes', () => {
    const built = nextCaptureAttempt({ source: 'blob:a', count: 3 }, 'blob:b');
    expect(built.attempt).toEqual({ source: 'blob:b', count: 1 });
    expect(built.exhausted).toBe(false);
  });

  it('reports exhausted once attempts reach the ceiling', () => {
    let state = { source: null as string | null, count: 0 };
    let exhausted = false;
    for (let i = 0; i < MAX_CAPTURE_ATTEMPTS; i += 1) {
      const result = nextCaptureAttempt(state, 'blob:a');
      state = result.attempt;
      exhausted = result.exhausted;
    }
    expect(state.count).toBe(MAX_CAPTURE_ATTEMPTS);
    expect(exhausted).toBe(true);
  });

  it('honors a custom ceiling', () => {
    expect(nextCaptureAttempt({ source: 'blob:a', count: 1 }, 'blob:a', 2).exhausted).toBe(true);
  });
});
