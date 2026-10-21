import { deployments } from '../shared/config/deployments';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCatalog, isAuthoritativeCatalogResponse, readBundledCatalog, readCachedCatalog, type CatalogApiResponse } from './catalog';
import { PRODUCT_DEVNET_BOOTSTRAP_CATALOG, PRODUCT_DEVNET_BOOTSTRAP_PRODUCT_ID } from './productDevnetCatalogBootstrap';

function response(): CatalogApiResponse {
  return {
    items: [],
    artists: [],
    pagination: { limit: 100, nextCursor: null, total: 0 },
    meta: {
      state: 'empty',
      cacheAvailable: true,
      indexedAt: '2026-07-23T12:00:00.000Z',
      lastIndexedBlock: 100,
      chainHeadBlock: 102,
      blockLag: 2,
      staleAfterMs: 60_000,
      lastErrorCode: null
    }
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchCatalog', () => {
  it('post-publication checks bypass HTTP freshness and find a release on a later page', async () => {
    const first = response();
    first.meta.state = 'fresh';
    first.items = [{ id: 'first' } as CatalogApiResponse['items'][number]];
    first.pagination = { limit: 100, nextCursor: 'revision:100', total: 2 };
    const second = response();
    second.meta.state = 'fresh';
    second.items = [{ id: 'published' } as CatalogApiResponse['items'][number]];
    second.pagination.total = 2;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(first)))
      .mockResolvedValueOnce(new Response(JSON.stringify(second)));
    vi.stubGlobal('fetch', fetch);
    const result = await fetchCatalog({ apiUrl: 'https://api.example', storage: null, fresh: true, allPages: true });
    expect(result.items.map(item => item.id)).toEqual(['first', 'published']);
    expect(isAuthoritativeCatalogResponse(result)).toBe(true);
    expect(fetch.mock.calls.every(call => call[1].cache === 'no-store')).toBe(true);
    expect(fetch.mock.calls[0][1].headers.has('If-None-Match')).toBe(false);
  });
  it('loads the browser catalog with one cacheable request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response()), {
        status: 200,
        headers: { 'content-type': 'application/json', etag: 'W/"catalog-1"' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCatalog({
      apiUrl: 'https://api.dotify.example',
      includeInactive: true,
      storage: null
    });

    expect(result.meta.state).toBe('empty');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/catalog?');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('includeInactive=true');
  });

  it('preserves a typed RPC outage response from a 503 API', async () => {
    const outage = response();
    outage.meta = {
      ...outage.meta,
      state: 'rpc-outage',
      cacheAvailable: false,
      lastErrorCode: 'CHAIN_RPC_UNAVAILABLE'
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(outage), {
          status: 503,
          headers: { 'content-type': 'application/json' }
        })
      )
    );

    const result = await fetchCatalog({ apiUrl: 'https://api.dotify.example', storage: null });
    expect(result.meta.state).toBe('rpc-outage');
    expect(result.items).toEqual([]);
  });

  it('times out catalog API requests that never settle', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = expect(fetchCatalog({ apiUrl: 'https://api.dotify.example', storage: null, timeoutMs: 50 })).rejects.toMatchObject({
      code: 'CATALOG_REQUEST_TIMEOUT'
    });
    await vi.advanceTimersByTimeAsync(50);

    await request;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('isAuthoritativeCatalogResponse', () => {
  it('accepts only fresh or empty complete catalog pages', () => {
    expect(isAuthoritativeCatalogResponse(response())).toBe(true);

    const fresh = response();
    fresh.meta.state = 'fresh';
    fresh.items = [{ id: 'release' } as CatalogApiResponse['items'][number]];
    fresh.pagination.total = 1;
    expect(isAuthoritativeCatalogResponse(fresh)).toBe(true);
  });

  it('rejects stale, outage, and incomplete catalog pages', () => {
    const stale = response();
    stale.meta.state = 'stale-cache';
    expect(isAuthoritativeCatalogResponse(stale)).toBe(false);

    const incomplete = response();
    incomplete.meta.state = 'fresh';
    incomplete.pagination = { limit: 100, nextCursor: 'next', total: 101 };
    expect(isAuthoritativeCatalogResponse(incomplete)).toBe(false);

    const outage = response();
    outage.meta.state = 'indexer-outage';
    expect(isAuthoritativeCatalogResponse(outage)).toBe(false);
  });
});

describe('readBundledCatalog', () => {
  it('exposes the Product DevNet bootstrap catalog only for the matching product id', () => {
    const bundled = readBundledCatalog({ apiUrl: 'https://api.dotify.example', productId: PRODUCT_DEVNET_BOOTSTRAP_PRODUCT_ID });
    expect(bundled).toBe(PRODUCT_DEVNET_BOOTSTRAP_CATALOG);
    expect(bundled?.items).toHaveLength(PRODUCT_DEVNET_BOOTSTRAP_CATALOG.items.length);
    expect(bundled?.pagination.total).toBe(PRODUCT_DEVNET_BOOTSTRAP_CATALOG.pagination.total);
    expect(bundled?.meta.cacheAvailable).toBe(true);
    expect(readBundledCatalog({ apiUrl: 'https://api.dotify.example', productId: 'other.dot' })).toBeNull();
    expect(readBundledCatalog({ apiUrl: '', productId: PRODUCT_DEVNET_BOOTSTRAP_PRODUCT_ID })).toBeNull();
  });
});

describe('catalog reset cache isolation', () => {
  it('ignores the former directory cache and writes the new directory into the cache identity', async () => {
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      }
    };
    const apiUrl = 'https://api.reset.example';
    values.set(`dotify:catalog:v1:${apiUrl}:all:100`, JSON.stringify({ version: 1, apiUrl, storedAt: Date.now(), response: response() }));
    expect(readCachedCatalog({ apiUrl, storage })).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(response()))));
    await fetchCatalog({ apiUrl, storage, includeInactive: true });
    const keys = [...values.keys()].filter(key => key.startsWith('dotify:catalog:v2:'));
    expect(keys).toHaveLength(1);
    expect(keys[0]).toContain(deployments.directory.toLowerCase());
    expect(readCachedCatalog({ apiUrl, storage })?.items).toEqual([]);
  });
});
