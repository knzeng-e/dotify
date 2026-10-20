import { afterEach, expect, it, vi } from 'vitest';
import { createSessionRevocations } from './sessionRevocations';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function storage() {
  const records = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      get length() {
        return records.size;
      },
      key: (index: number) => [...records.keys()][index] ?? null,
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => records.set(key, value),
      removeItem: (key: string) => records.delete(key)
    }
  });
  return records;
}

it('keeps distinct concurrent records, scopes them to the API and retains them only until expiry plus clock margin', () => {
  const records = storage();
  const expiry = Date.now() + 3_600_000;
  const one = createSessionRevocations('https://one');
  const two = createSessionRevocations('https://one');
  one.add('account-one', { token: 'one', expiresAt: new Date(expiry).toISOString() });
  two.add('account-two', { token: 'two', expiresAt: new Date(expiry).toISOString() });
  expect(
    createSessionRevocations('https://one')
      .entries()
      .map(item => item.token)
      .sort()
  ).toEqual(['one', 'two']);
  expect(createSessionRevocations('https://two').entries()).toEqual([]);
  one.complete('one');
  expect(
    createSessionRevocations('https://one')
      .entries()
      .map(item => item.token)
  ).toEqual(['two']);
  vi.useFakeTimers();
  vi.setSystemTime(expiry + 300_001);
  expect(two.entries()).toEqual([]);
  expect(records.size).toBe(0);
});
