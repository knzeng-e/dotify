import { describe, expect, it, vi } from 'vitest';
import { contributionReconciliationDelay, contributionReconciliationDelaysMs, waitForContributionReconciliation } from './contributionReconciliation';

class TestVisibility extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';

  set(value: DocumentVisibilityState) {
    this.visibilityState = value;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

describe('contribution reconciliation schedule', () => {
  it('uses a bounded exponential-style schedule', () => {
    expect(contributionReconciliationDelaysMs).toEqual([5_000, 15_000, 30_000, 60_000, 120_000, 300_000]);
    expect(contributionReconciliationDelay(contributionReconciliationDelaysMs.length)).toBeUndefined();
  });

  it('does not resume a reconciliation cycle while the page is hidden', async () => {
    vi.useFakeTimers();
    try {
      const visibility = new TestVisibility();
      visibility.set('hidden');
      const pending = waitForContributionReconciliation(5_000, new AbortController().signal, visibility);
      await vi.advanceTimersByTimeAsync(60_000);
      let settled = false;
      void pending.then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);

      visibility.set('visible');
      await vi.advanceTimersByTimeAsync(4_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels a scheduled reconciliation without another read', async () => {
    const controller = new AbortController();
    const pending = waitForContributionReconciliation(60_000, controller.signal, new TestVisibility());
    controller.abort();
    await expect(pending).resolves.toBe(false);
  });
});
