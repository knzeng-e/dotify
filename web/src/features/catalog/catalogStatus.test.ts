import { describe, expect, it } from 'vitest';
import { CATALOG_LOAD_ERROR_STATUS, catalogLoadFailureStatus } from './catalogStatus';

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
