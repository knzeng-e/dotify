import type { SubmittableTransaction } from '@parity/product-sdk-tx';
import { createProductSignerManager, type ProductRuntimeSignerAccount } from '../runtime/runtimeWriterProvider';
import { SupportNotSubmittedError } from '../payments/supportPayment';
import type { DonationPort } from './donationModel';

export function nativeDonationAsset(properties: { tokenDecimals?: unknown; tokenSymbol?: unknown }, genesisHash: string) {
  const decimals = Array.isArray(properties.tokenDecimals) && properties.tokenDecimals.length === 1 ? properties.tokenDecimals[0] : properties.tokenDecimals;
  const symbol = Array.isArray(properties.tokenSymbol) && properties.tokenSymbol.length === 1 ? properties.tokenSymbol[0] : properties.tokenSymbol;
  if (
    !Number.isInteger(decimals) ||
    Number(decimals) < 0 ||
    Number(decimals) > 18 ||
    typeof symbol !== 'string' ||
    !symbol.trim() ||
    !/^0x[\da-f]{64}$/i.test(genesisHash)
  ) {
    throw new Error('The native currency could not be verified. No gift was sent.');
  }
  return { decimals: Number(decimals), symbol, network: `substrate:${genesisHash.toLowerCase()}` };
}

export async function createProductDonationPort(account: ProductRuntimeSignerAccount): Promise<DonationPort> {
  if (!account.publicKey || !account.evmAddress) throw new Error('Reconnect Polkadot App before preparing a gift.');
  const [chain, descriptor, address, tx] = await Promise.all([
    import('@parity/product-sdk/chain'),
    import('@parity/product-sdk-descriptors/devnet-asset-hub'),
    import('@parity/product-sdk/address'),
    import('@parity/product-sdk-tx')
  ]);
  const client = await chain.createChainClient({ chains: { assetHub: descriptor.devnet_asset_hub } });
  try {
    const raw = client.raw.assetHub;
    const spec = await raw.getChainSpecData();
    const asset = nativeDonationAsset(spec.properties, spec.genesisHash);
    const api = raw.getTypedApi(descriptor.devnet_asset_hub);
    return {
      asset,
      canCheckReceipt: false,
      async send(recipient, amount) {
        let manager: Awaited<ReturnType<typeof createProductSignerManager>> | undefined;
        let prepared: SubmittableTransaction;
        try {
          // Resolve an already-mapped native account; the SDK's 0xEE fallback
          // is only for EVM-derived accounts. Never truncate/pad a native key.
          const mapped = await api.query.Revive.OriginalAccount.getValue(recipient);
          const destination = mapped ?? address.h160ToSs58(recipient);
          if (address.ss58ToH160(destination).toLowerCase() !== recipient.toLowerCase())
            throw new Error('The receiving account mapping did not match the artist.');
          manager = await createProductSignerManager(account);
          if (!manager.getSigner()) throw new Error('Reconnect Polkadot App before sending a gift.');
          // Native Balances units come from chain properties, independently of
          // the 18-decimal EVM access-payment amount. Keep the sender alive.
          prepared = api.tx.Balances.transfer_keep_alive({ dest: { type: 'Id', value: destination }, value: amount });
        } catch (error) {
          manager?.destroy();
          throw new SupportNotSubmittedError(error);
        }
        try {
          const result = await tx.submitAndWatch(prepared, manager.getSigner()!, { waitFor: 'finalized' });
          if (!result.ok) throw result.error;
          if (!result.value.ok || !/^0x[\da-f]{64}$/i.test(result.value.txHash)) throw new Error('The gift was not confirmed by the network.');
          return { hash: result.value.txHash as `0x${string}`, finalized: true };
        } finally {
          manager.destroy();
        }
      },
      async confirm() {
        // A Product hash is returned only after finalized success. Unknown
        // native submissions have no hash and must be checked in host activity.
        throw new Error('Check this native transfer in Polkadot App activity. No new gift was sent.');
      },
      destroy: () => client.destroy()
    };
  } catch (error) {
    client.destroy();
    throw error;
  }
}
