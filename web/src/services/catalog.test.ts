import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCatalog, readBundledCatalog, type CatalogApiResponse } from './catalog';

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

describe('readBundledCatalog', () => {
  it('exposes the Product DevNet bootstrap catalog only for the matching product id', () => {
    const bundled = readBundledCatalog({ apiUrl: 'https://api.dotify.example', productId: 'dotify-test01.dot' });
    expect(bundled?.items).toHaveLength(0);
    expect(bundled?.pagination.total).toBe(0);
    expect(bundled?.meta.cacheAvailable).toBe(true);
    expect(readBundledCatalog({ apiUrl: 'https://api.dotify.example', productId: 'other.dot' })).toBeNull();
    expect(readBundledCatalog({ apiUrl: '', productId: 'dotify-test01.dot' })).toBeNull();
  });
});
