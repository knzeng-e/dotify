import { afterEach, expect, it, vi } from 'vitest';
import { createSessionCache } from './sessionCache';

const scope = { address: '0x1111', chainId: 1, identity: 'eip191' };
const session = (token: string, expires = Date.now() + 3_600_000) => ({ token, expiresAt: new Date(expires).toISOString() });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function storage() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    key: (index: number) => [...values.keys()][index],
    get length() {
      return values.size;
    }
  };
  vi.stubGlobal('window', { localStorage });
  return { values, localStorage };
}

it('scopes sessions to API, chain, account, and signing identity', () => {
  storage();
  const cache = createSessionCache('https://api.one');
  cache.store(scope, session('one'));
  expect(cache.read(scope)?.token).toBe('one');
  expect(cache.read({ ...scope, chainId: 2 })).toBeNull();
  expect(cache.read({ ...scope, address: '0x2222' })).toBeNull();
  expect(cache.read({ ...scope, identity: 'product:public-key' })).toBeNull();
  expect(createSessionCache('https://api.two').read(scope)).toBeNull();
});

it('preserves a newer token when a concurrent request rejects the previous one', () => {
  storage();
  const cache = createSessionCache('api');
  cache.store(scope, session('new'));
  cache.clear(scope.address, 'old');
  expect(cache.read(scope)?.token).toBe('new');
});

it('keeps memory authoritative after a failed refresh write, and cannot resurrect a token after failed removal', () => {
  const { localStorage } = storage();
  const cache = createSessionCache('api');
  cache.store(scope, session('old'));
  localStorage.setItem = () => {
    throw new Error('storage full');
  };
  localStorage.removeItem = () => {
    throw new Error('storage blocked');
  };
  cache.store(scope, session('new'));
  expect(cache.read(scope)?.token).toBe('new');
  cache.clear(scope.address);
  expect(cache.read(scope)).toBeNull();
});

it('honors expiry and cross-tab logout without using stale in-memory tokens', () => {
  const { values } = storage();
  const cache = createSessionCache('api');
  cache.store(scope, session('one'));
  values.clear();
  expect(cache.read(scope)).toBeNull();
  cache.store(scope, session('two'));
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 3_600_000);
  expect(cache.read(scope)).toBeNull();
  expect(cache.clear(scope.address).map(item => item.token)).toEqual(['two']);
});

it('retains a session loaded from storage if that storage later becomes unavailable', () => {
  const { localStorage } = storage();
  createSessionCache('api').store(scope, session('persisted'));
  const reloaded = createSessionCache('api');
  expect(reloaded.read(scope)?.token).toBe('persisted');
  localStorage.getItem = () => {
    throw new Error('Host storage unavailable');
  };
  expect(reloaded.read(scope)?.token).toBe('persisted');
});
