import { useMemo } from 'react';
import { useWalletContext } from '../../app/providers/WalletProvider';
import { createRuntimeWriter } from '../runtime/runtimeWriterProvider';
import { resolveProductHostConfig } from '../productHost/productHost';
import { contributionE2e, contributionTestWrite } from '../../e2e/contributionMock';
import { readNativeContributionReceiptApi } from '../runtime/nativeContributionReceiptApi';

export function useContributionWriter() {
  const wallet = useWalletContext();
  return useMemo(() => {
    const signer = wallet.connectedWallet?.keyRequestSigner;
    const writer = createRuntimeWriter({
      ethRpcUrl: wallet.ethRpcUrl,
      getViemWalletClient: async () => {
        const client = await wallet.getActiveWalletClient();
        if (client.account?.address.toLowerCase() !== wallet.listenerEvmAddress?.toLowerCase())
          throw new Error('The paying account changed. Prepare the contribution again.');
        return client;
      },
      productAccount:
        wallet.connectedWallet?.method === 'product-host'
          ? {
              productId: resolveProductHostConfig(import.meta.env).productId,
              evmAddress: wallet.listenerEvmAddress ?? undefined,
              publicKey: signer && 'productPublicKey' in signer ? signer.productPublicKey : undefined
            }
          : undefined
    });
    return contributionE2e
      ? {
          ...writer,
          contributionConfirmationMode: ['native-recovery', 'native-api-recovery'].includes(new URLSearchParams(location.search).get('e2eGift') ?? '')
            ? ('finalized-event' as const)
            : writer.contributionConfirmationMode,
          readFinalizedContributionLogs:
            new URLSearchParams(location.search).get('e2eGift') === 'native-api-recovery'
              ? (hash, block) => readNativeContributionReceiptApi({ apiUrl: 'https://receipt.dotify.test', hash, block })
              : writer.readFinalizedContributionLogs,
          contributionCall: contributionTestWrite,
          waitForTransaction: async () => {}
        }
      : writer;
  }, [wallet]);
}
