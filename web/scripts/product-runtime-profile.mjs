/** Product publications must preserve native Host payments, not ask for an EVM wallet. */
export function assertProductRuntimeProfile(env) {
  if (env.VITE_DOTIFY_RUNTIME_ADAPTER !== 'product-cdm' || env.VITE_DOTIFY_PRODUCT_CHAIN !== 'devnet') {
    throw new Error(
      'Product release requires VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm and VITE_DOTIFY_PRODUCT_CHAIN=devnet. Refusing an EVM-wallet-only Product bundle.'
    );
  }
}
