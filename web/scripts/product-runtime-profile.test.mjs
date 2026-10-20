import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertProductRuntimeProfile } from './product-runtime-profile.mjs';
import { parseEnvFile } from './product-devnet-journey-harness.mjs';

test('tracked Product build preserves native Host payments', () => {
  const env = parseEnvFile(readFileSync(new URL('../.env.product-devnet', import.meta.url), 'utf8'));
  assert.doesNotThrow(() => assertProductRuntimeProfile(env));
});
test('Product publication rejects missing, EVM-only and wrong-chain profiles', () => {
  for (const env of [
    {},
    { VITE_DOTIFY_RUNTIME_ADAPTER: 'viem', VITE_DOTIFY_PRODUCT_CHAIN: 'devnet' },
    { VITE_DOTIFY_RUNTIME_ADAPTER: 'product-cdm', VITE_DOTIFY_PRODUCT_CHAIN: 'paseo' }
  ]) {
    assert.throws(() => assertProductRuntimeProfile(env), /Refusing an EVM-wallet-only Product bundle/);
  }
});
