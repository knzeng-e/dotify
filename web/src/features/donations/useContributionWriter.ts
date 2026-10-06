import { useMemo } from 'react';
import { useWalletContext } from '../../app/providers/WalletProvider';
import { createRuntimeWriter } from '../runtime/runtimeWriterProvider';
import { resolveProductHostConfig } from '../productHost/productHost';
import { contributionE2e, contributionTestWrite } from '../../e2e/contributionMock';

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
          contributionConfirmationMode:
            new URLSearchParams(location.search).get('e2eGift') === 'native-recovery' ? ('finalized-event' as const) : writer.contributionConfirmationMode,
          contributionCall: contributionTestWrite,
          waitForTransaction: async () => {}
        }
      : writer;
  }, [wallet]);
}
