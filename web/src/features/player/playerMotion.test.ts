import { expect, it, vi } from 'vitest';
import { createPlayerMotion } from './playerMotion';
function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture() {
  const direction = vi.fn(),
    commits: (() => void)[] = [],
    finishes: ReturnType<typeof deferred>[] = [];
  const updates: ReturnType<typeof deferred>[] = [],
    skip = vi.fn();
  const port = {
    available: () => true,
    immediate: () => false,
    direction,
    start: vi.fn((commit: () => void) => {
      commits.push(commit);
      const finish = deferred(),
        update = deferred();
      finishes.push(finish);
      updates.push(update);
      return { finished: finish.promise, updateCallbackDone: update.promise, skipTransition: skip };
    })
  };
  return { port, commits, finishes, updates, skip, direction };
}
it('unsupported, hidden or reduced motion commits once without an animation wait', () => {
  for (const fast of ['unsupported', 'immediate']) {
    const f = fixture();
    if (fast === 'unsupported') f.port.available = () => false;
    else f.port.immediate = () => true;
    const change = vi.fn();
    createPlayerMotion(f.port)('open', change);
    expect(change).toHaveBeenCalledTimes(1);
    expect(f.port.start).not.toHaveBeenCalled();
    expect(f.direction).toHaveBeenLastCalledWith(null);
  }
});
it('a rapid reversal commits intents in order and a delayed callback cannot reopen the old view', async () => {
  const f = fixture(),
    navigate = createPlayerMotion(f.port),
    changes: string[] = [];
  navigate('open', () => changes.push('player'));
  navigate('close', () => changes.push('music'));
  expect(changes).toEqual(['player']);
  expect(f.skip).toHaveBeenCalledTimes(1);
  f.commits[1]();
  f.commits[0]();
  expect(changes).toEqual(['player', 'music']);
  f.finishes[0].resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(f.direction).toHaveBeenLastCalledWith('close');
  f.finishes[1].resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(f.direction).toHaveBeenLastCalledWith(null);
});
it('capture failures retain ordinary navigation and never repeat a synchronously applied update', () => {
  const f = fixture(),
    change = vi.fn();
  f.port.start = vi.fn((commit: () => void) => {
    commit();
    throw new Error('Capture unavailable');
  });
  createPlayerMotion(f.port)('open', change);
  expect(change).toHaveBeenCalledTimes(1);
  expect(f.direction).toHaveBeenLastCalledWith(null);
});
it('a rejected platform update promise applies the pending route and releases its presentation', async () => {
  const f = fixture(),
    change = vi.fn();
  createPlayerMotion(f.port)('open', change);
  f.updates[0].reject(new Error('Skipped'));
  f.finishes[0].reject(new Error('Skipped'));
  await Promise.resolve();
  await Promise.resolve();
  expect(change).toHaveBeenCalledTimes(1);
  expect(f.direction).toHaveBeenLastCalledWith(null);
  f.commits[0]();
  expect(change).toHaveBeenCalledTimes(1);
});
