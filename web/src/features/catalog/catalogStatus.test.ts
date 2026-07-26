import { describe, expect, it } from 'vitest';
import { CATALOG_LOAD_ERROR_STATUS, catalogApiStatus, catalogLoadFailureStatus } from './catalogStatus';

describe('catalogLoadFailureStatus', () => {
  it('uses understandable listener-facing copy for RPC transport failures', () => {
    const status = catalogLoadFailureStatus(
      new Error(
        'HTTP request failed. URL: https://services.polkadothub-rpc.com/testnet Request body: {"method":"eth_getCode"} Details: Failed to fetch Version: viem@2.53.1'
      )
    );

    expect(status).toBe(CATALOG_LOAD_ERROR_STATUS);
    expect(status).not.toContain('eth_getCode');
    expect(status).not.toContain('viem');
    expect(status).not.toContain('https://');
  });

  it('uses the same safe status for unknown catalog errors', () => {
    expect(catalogLoadFailureStatus('unexpected')).toBe(CATALOG_LOAD_ERROR_STATUS);
  });
});

describe('catalogApiStatus', () => {
  const metadata = {
    state: 'fresh' as const,
    cacheAvailable: true,
    indexedAt: '2026-07-23T12:00:00.000Z',
    lastIndexedBlock: 100,
    chainHeadBlock: 102,
    blockLag: 2,
    staleAfterMs: 60_000,
    lastErrorCode: null
  };

  it('distinguishes stale cache, indexer outage, RPC outage, and empty catalog', () => {
    expect(catalogApiStatus({ ...metadata, state: 'stale-cache' }, 2)).toContain('saved catalog');
    expect(catalogApiStatus({ ...metadata, state: 'indexer-outage' }, 2)).toContain('catalog index');
    expect(catalogApiStatus({ ...metadata, state: 'rpc-outage' }, 2)).toContain('music registry');
    expect(catalogApiStatus({ ...metadata, state: 'empty' }, 0)).toContain('No tracks');
  });
});
