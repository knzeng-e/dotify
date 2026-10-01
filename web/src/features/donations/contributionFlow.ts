import type { Address, Hash } from 'viem';
import { SupportNotSubmittedError, supportWasCanceled } from '../payments/supportPayment';
import type { ContributionContext, ContributionQuote, ContributionReceipt } from './contributions';
import { contributionId } from './contributions';

export type ContributionIntent = {
  network: number;
  sender: Address;
  runtime: Address;
  amount: bigint;
  context: ContributionContext;
  quote: ContributionQuote;
  proof: Hash;
};
type Saved = { id: Hash; amount: string; hash?: Hash };
export type ContributionOutcome = { status: 'confirmed' | 'uncertain' | 'failed'; message: string; hash?: Hash; receipt?: ContributionReceipt };
const operations = new Map<string, Promise<ContributionOutcome>>();

export function contributionStorageKey(intent: ContributionIntent) {
  return `dotify.contribution.v1:${intent.network}:${intent.sender.toLowerCase()}:${intent.runtime.toLowerCase()}:${intent.context.contentHash.toLowerCase()}`;
}
export async function runContribution(input: {
  intent: ContributionIntent;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  send: () => Promise<Hash>;
  confirm: (hash: Hash, id: Hash) => Promise<ContributionReceipt>;
  recover: (id: Hash) => Promise<ContributionReceipt | undefined>;
  currentAccount: () => boolean;
}): Promise<ContributionOutcome> {
  const key = contributionStorageKey(input.intent);
  const existing = operations.get(key);
  if (existing) return existing;
  const execute = async (): Promise<ContributionOutcome> => {
    let saved: Saved | undefined;
    let submitting = false;
    try {
      const raw = input.storage.getItem(key);
      saved = raw ? JSON.parse(raw) : undefined;
      if (saved && (!/^0x[\da-f]{64}$/i.test(saved.id) || !/^[1-9]\d*$/.test(saved.amount) || (saved.hash && !/^0x[\da-f]{64}$/i.test(saved.hash))))
        throw new Error('The saved contribution is unreadable. Check your account activity.');
      if (!input.currentAccount()) throw new Error('Your account changed. Reopen this contribution.');
      let receipt: ContributionReceipt;
      if (saved) {
        const recovered = saved.hash ? await input.confirm(saved.hash, saved.id) : await input.recover(saved.id);
        if (!recovered) return { status: 'uncertain', message: 'An earlier contribution may still complete. No new payment was sent.' };
        receipt = recovered;
      } else {
        saved = { id: contributionId(input.intent.sender, input.intent.context.intentId), amount: input.intent.amount.toString() };
        input.storage.setItem(key, JSON.stringify(saved));
        submitting = true;
        saved.hash = await input.send();
        input.storage.setItem(key, JSON.stringify(saved));
        receipt = await input.confirm(saved.hash, saved.id);
      }
      if (receipt.id !== saved.id || receipt.sender.toLowerCase() !== input.intent.sender.toLowerCase() || receipt.amount !== BigInt(saved.amount))
        throw new Error('The receipt does not match the saved contribution.');
      input.storage.removeItem(key);
      return { status: 'confirmed', message: 'Contribution confirmed. Each recipient’s settlement is recorded below.', receipt, hash: receipt.transactionHash };
    } catch (error) {
      const safe = submitting && !saved?.hash && (error instanceof SupportNotSubmittedError || supportWasCanceled(error));
      if (safe) {
        try {
          input.storage.removeItem(key);
        } catch {
          /* Preserve an uncertain reservation if storage is no longer writable. */
        }
      }
      return {
        status: saved && !safe ? 'uncertain' : 'failed',
        hash: saved?.hash,
        message: error instanceof Error ? error.message : 'The contribution could not be checked.'
      };
    }
  };
  const promise = (typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request(key, execute) : execute()).finally(() =>
    operations.delete(key)
  );
  operations.set(key, promise);
  return promise;
}
