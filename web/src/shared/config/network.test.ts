import { describe, expect, it } from 'vitest';
import { TESTNET_ETH_RPC_URL, resolveDefaultEthRpcUrl } from './network';

describe('resolveDefaultEthRpcUrl', () => {
  it('defaults to the public testnet RPC', () => {
    expect(resolveDefaultEthRpcUrl(undefined)).toBe(TESTNET_ETH_RPC_URL);
    expect(resolveDefaultEthRpcUrl('')).toBe(TESTNET_ETH_RPC_URL);
    expect(resolveDefaultEthRpcUrl('   ')).toBe(TESTNET_ETH_RPC_URL);
  });

  it('allows a configured RPC override', () => {
    expect(resolveDefaultEthRpcUrl('https://rpc.example.test')).toBe('https://rpc.example.test');
  });
});
