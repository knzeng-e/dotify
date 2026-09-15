import type { getWalletClient } from '../../shared/config/contracts';
import { getPublicClient, resolveEvmChain } from '../../shared/config/contracts';
import { SupportNotSubmittedError } from '../payments/supportPayment';
import type { DonationPort } from './donationModel';
import type { Address } from 'viem';

export async function createViemDonationPort(
  rpcUrl: string,
  sender: Address,
  getWallet: () => Promise<Awaited<ReturnType<typeof getWalletClient>>>
): Promise<DonationPort> {
  const chain = await resolveEvmChain(rpcUrl);
  const client = getPublicClient(rpcUrl);
  return {
    asset: { ...chain.nativeCurrency, network: `evm:${chain.id}` },
    async send(recipient, amount) {
      let wallet;
      try {
        wallet = await getWallet();
        if (wallet.account?.address.toLowerCase() !== sender.toLowerCase() || wallet.chain?.id !== chain.id) throw new Error('The connected account changed.');
        await client.estimateGas({ account: sender, to: recipient, value: amount });
      } catch (error) {
        throw new SupportNotSubmittedError(error);
      }
      const hash = await wallet.sendTransaction({ to: recipient, value: amount });
      return { hash, finalized: false };
    },
    async confirm(receipt, recipient) {
      const [confirmed, transaction] = await Promise.all([
        client.waitForTransactionReceipt({ hash: receipt.hash, timeout: 90_000 }),
        client.getTransaction({ hash: receipt.hash })
      ]);
      if (
        confirmed.status !== 'success' ||
        transaction.from.toLowerCase() !== sender.toLowerCase() ||
        transaction.to?.toLowerCase() !== recipient.toLowerCase() ||
        transaction.value !== receipt.amount ||
        transaction.input !== '0x'
      ) {
        throw new Error('The transfer receipt did not confirm this gift. Check the payment reference.');
      }
    },
    destroy() {}
  };
}
