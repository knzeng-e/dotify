import { describe, expect, it, vi } from 'vitest';
import { runSerializedRefresh, type RefreshGate } from './useVisibleRefresh';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('serialized refreshes', () => {
  it('shares an active refresh with ordinary callers', async () => {
    const first = deferred();
    const gate: RefreshGate = { current: null };
    const refresh = vi.fn(() => first.promise);

    const active = runSerializedRefresh(gate, refresh);
    const overlapping = runSerializedRefresh(gate, refresh);
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);

    first.resolve();
    await Promise.all([active, overlapping]);
    expect(gate.current).toBeNull();
  });

  it('waits for an active refresh and then runs a fresh post-write read', async () => {
    const first = deferred();
    const gate: RefreshGate = { current: null };
    const refresh = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(undefined);

    const active = runSerializedRefresh(gate, refresh);
    const postWrite = runSerializedRefresh(gate, refresh, true);
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);

    first.resolve();
    await Promise.all([active, postWrite]);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(gate.current).toBeNull();
  });
});
