import { describe, expect, it } from 'vitest';
import { resolveRuntimeAdapterConfig } from './runtimeAdapterConfig';

describe('resolveRuntimeAdapterConfig', () => {
  it('defaults to the viem adapter when nothing is configured', () => {
    expect(resolveRuntimeAdapterConfig({})).toEqual({ kind: 'viem', productEnvironment: 'paseo' });
  });

  it('selects the Product CDM adapter only on an exact opt-in', () => {
    expect(resolveRuntimeAdapterConfig({ VITE_DOTIFY_RUNTIME_ADAPTER: 'product-cdm' }).kind).toBe('product-cdm');
    expect(resolveRuntimeAdapterConfig({ VITE_DOTIFY_RUNTIME_ADAPTER: 'PRODUCT-CDM' }).kind).toBe('product-cdm');
  });

  it('fails closed to viem for an unknown adapter rather than disabling reads', () => {
    expect(resolveRuntimeAdapterConfig({ VITE_DOTIFY_RUNTIME_ADAPTER: 'cdm' }).kind).toBe('viem');
    expect(resolveRuntimeAdapterConfig({ VITE_DOTIFY_RUNTIME_ADAPTER: '' }).kind).toBe('viem');
  });

  it('defaults the Product chain to the preset holding Dotify runtimes', () => {
    // Dotify's contracts are on Polkadot Hub TestNet, reached via the paseo
    // preset - defaulting to devnet would resolve addresses holding no code.
    expect(resolveRuntimeAdapterConfig({ VITE_DOTIFY_RUNTIME_ADAPTER: 'product-cdm' }).productEnvironment).toBe('paseo');
    expect(resolveRuntimeAdapterConfig({ VITE_DOTIFY_PRODUCT_CHAIN: 'nowhere' }).productEnvironment).toBe('paseo');
  });

  it('accepts an explicit supported Product chain', () => {
    expect(resolveRuntimeAdapterConfig({ VITE_DOTIFY_PRODUCT_CHAIN: 'devnet' }).productEnvironment).toBe('devnet');
  });
});
