import { describe, expect, it, vi } from 'vitest';
import { persistentPaymentJournal } from './paymentJournal';

function storage() {
  const items = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      items.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      items.delete(key);
    })
  };
}

describe('persistent payment journal', () => {
  it('preserves the old reservation if migration cannot be persisted', () => {
    const local = storage();
    const session = storage();
    session.setItem('scope', 'unresolved');
    local.setItem.mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    expect(() =>
      persistentPaymentJournal(
        () => local,
        () => session
      ).getItem('scope')
    ).toThrow('Quota exceeded');
    expect(session.getItem('scope')).toBe('unresolved');
    expect(session.removeItem).not.toHaveBeenCalled();
  });

  it('never replaces a durable receipt with stale tab state and removes both only explicitly', () => {
    const local = storage();
    const session = storage();
    local.setItem('scope', 'submitted');
    session.setItem('scope', 'reserved');
    const journal = persistentPaymentJournal(
      () => local,
      () => session
    );
    expect(journal.getItem('scope')).toBe('submitted');
    journal.removeItem('scope');
    expect(local.getItem('scope')).toBeNull();
    expect(session.getItem('scope')).toBeNull();
  });
});
