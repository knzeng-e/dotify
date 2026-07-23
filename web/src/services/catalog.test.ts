import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCatalog, type CatalogApiResponse } from './catalog';

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
});
