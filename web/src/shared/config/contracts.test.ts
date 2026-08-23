import { describe, expect, it } from 'vitest';
import { nativeCurrencyForChain } from './contracts';

describe('nativeCurrencyForChain', () => {
  it('labels the configured Product DevNet / Paseo Asset Hub EVM chain as PAS', () => {
    expect(nativeCurrencyForChain(420420417, 'https://eth-rpc-testnet.polkadot.io')).toEqual({
      name: 'Paseo',
      symbol: 'PAS',
      decimals: 18
    });
  });

  it('keeps local development chains on the generic UNIT symbol', () => {
    expect(nativeCurrencyForChain(31337, 'http://127.0.0.1:8545')).toEqual({
      name: 'Unit',
      symbol: 'UNIT',
      decimals: 18
    });
  });
});
