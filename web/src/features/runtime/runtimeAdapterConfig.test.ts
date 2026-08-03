import { describe, expect, it } from 'vitest';
import { resolveRuntimeAdapterConfig } from './runtimeAdapterConfig';

describe('resolveRuntimeAdapterConfig', () => {
  it('defaults to the viem adapter when nothing is configured', () => {
    expect(resolveRuntimeAdapterConfig({})).toEqual({ kind: 'viem', productEnvironment: 'devnet' });
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
    // Product DevNet is a preset over Paseo Asset Hub 1000 (EVM chain
    // 420420417), which is where Dotify's contracts already live.
    expect(resolveRuntimeAdapterConfig({ VITE_DOTIFY_RUNTIME_ADAPTER: 'product-cdm' }).productEnvironment).toBe('devnet');
  });

  it('refuses the paseo preset, which is a different network from Product DevNet', () => {
    // The SDK's `paseo` preset is Paseo Next (Asset Hub Next 1500). Dotify has
    // no deployment there, so it must never be selectable by configuration.
    expect(resolveRuntimeAdapterConfig({ VITE_DOTIFY_PRODUCT_CHAIN: 'paseo' }).productEnvironment).toBe('devnet');
    expect(resolveRuntimeAdapterConfig({ VITE_DOTIFY_PRODUCT_CHAIN: 'nowhere' }).productEnvironment).toBe('devnet');
  });
});
