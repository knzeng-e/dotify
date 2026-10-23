import type { createContractRuntimeFromClient } from '@parity/product-sdk/contracts';

type ProductContractRuntime = ReturnType<typeof createContractRuntimeFromClient>;

export class ProductCdmStorageDepositError extends Error {
  constructor() {
    super('Product could not verify the required network deposit. No transaction was submitted. Please try again.');
    this.name = 'ProductCdmStorageDepositError';
  }
}

/**
 * SDK contracts 0.11.3 still sizes its storage limit from the net deposit. Revive
 * also reports the peak required before refunds: finalizing a runtime writes
 * directory/owner state before releasing its pending-bootstrap storage.
 * Feed that peak into the SDK sizing slot without changing calldata, value,
 * weight, return data or the actual on-chain net charge. No unlimited deposit.
 * Remove this adaptation when the pinned SDK sizes from max_storage_deposit.
 */
export function withProductPeakStorageDeposit(runtime: ProductContractRuntime): ProductContractRuntime {
  return {
    ...runtime,
    async dryRunCall(...args) {
      const result = await runtime.dryRunCall(...args);
      // Preserve the SDK's existing dispatch/revert handling, including payloads.
      if (!result.result.success || (result.result.value.flags & 1) !== 0) return result;
      const net = result.storage_deposit;
      const peak = result.max_storage_deposit;
      const valid = (deposit: typeof net) =>
        deposit && (deposit.type === 'Charge' || deposit.type === 'Refund') && typeof deposit.value === 'bigint' && deposit.value >= 0n;
      if (!valid(net) || !valid(peak)) throw new ProductCdmStorageDepositError();
      const netCharge = net.type === 'Charge' ? net.value : 0n;
      const peakCharge = peak.type === 'Charge' ? peak.value : 0n;
      if (peakCharge < netCharge) throw new ProductCdmStorageDepositError();
      return { ...result, storage_deposit: peak };
    }
  };
}
