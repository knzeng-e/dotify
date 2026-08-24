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

  it('labels Polkadot Hub EVM as DOT when the connected chain id is DOT-backed', () => {
    expect(nativeCurrencyForChain(420420419, 'https://hub-rpc.polkadot.io')).toEqual({
      name: 'Polkadot',
      symbol: 'DOT',
      decimals: 18
    });
  });

  it('labels Kusama Hub EVM as KSM when the connected chain id is KSM-backed', () => {
    expect(nativeCurrencyForChain(420420418, 'https://hub-rpc.kusama.io')).toEqual({
      name: 'Kusama',
      symbol: 'KSM',
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
