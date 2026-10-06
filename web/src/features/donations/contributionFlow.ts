import type { Address, Hash } from 'viem';
import { SupportNotSubmittedError, supportWasCanceled } from '../payments/supportPayment';
import type { ContributionContext, ContributionQuote, ContributionReceipt } from './contributions';
import { ContributionRevertedError, contributionId } from './contributions';

export type ContributionIntent = {
  network: number;
  sender: Address;
  runtime: Address;
  amount: bigint;
  context: ContributionContext;
  quote: ContributionQuote;
  proof: Hash;
};
type Saved = { id: Hash; amount: string; hash?: Hash; technicalMessage?: string };
export type ContributionScope = Pick<ContributionIntent, 'network' | 'sender' | 'runtime'> & { context: Pick<ContributionContext, 'contentHash'> };
export type ContributionOutcome = {
  status: 'confirmed' | 'uncertain' | 'failed';
  message: string;
  technicalMessage?: string;
  id?: Hash;
  hash?: Hash;
  receipt?: ContributionReceipt;
};
const operations = new Map<string, Promise<ContributionOutcome>>();

export function contributionStorageKey(intent: ContributionScope) {
  return `dotify.contribution.v1:${intent.network}:${intent.sender.toLowerCase()}:${intent.runtime.toLowerCase()}:${intent.context.contentHash.toLowerCase()}`;
}
export function readSavedContribution(scope: ContributionScope, storage: Pick<Storage, 'getItem'>): Saved | undefined {
  const raw = storage.getItem(contributionStorageKey(scope));
  if (!raw) return undefined;
  const saved = JSON.parse(raw) as Saved;
  if (
    !saved ||
    !/^0x[\da-f]{64}$/i.test(saved.id) ||
    !/^[1-9]\d*$/.test(saved.amount) ||
    (saved.hash && !/^0x[\da-f]{64}$/i.test(saved.hash)) ||
    (saved.technicalMessage !== undefined && typeof saved.technicalMessage !== 'string')
  )
    throw new Error('The saved contribution is unreadable. Check your account activity.');
  return saved;
}
function verifyReceipt(receipt: ContributionReceipt, saved: Saved, sender: Address) {
  if (receipt.id !== saved.id || receipt.sender.toLowerCase() !== sender.toLowerCase() || receipt.amount !== BigInt(saved.amount))
    throw new Error('The receipt does not match the saved contribution.');
}
function pendingOutcome(error?: unknown, saved?: Saved): ContributionOutcome {
  return {
    status: 'uncertain',
    message: 'The contribution is still being checked. No new payment will be sent.',
    hash: saved?.hash,
    id: saved?.id,
    technicalMessage: saved?.technicalMessage ?? (error instanceof Error ? error.message : undefined)
  };
}
function rememberUncertainty(saved: Saved | undefined, error: unknown, key: string, storage: Pick<Storage, 'setItem'>) {
  if (!saved || saved.technicalMessage || !(error instanceof Error)) return;
  saved.technicalMessage = error.message.slice(0, 4_000);
  try {
    storage.setItem(key, JSON.stringify(saved));
  } catch {
    // Diagnostics must never release a reserved payment or trigger resubmission.
  }
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
      saved = readSavedContribution(input.intent, input.storage);
      if (!input.currentAccount()) throw new Error('Your account changed. Reopen this contribution.');
      let receipt: ContributionReceipt;
      if (saved) {
        const recovered = saved.hash ? await input.confirm(saved.hash, saved.id) : await input.recover(saved.id);
        if (!recovered) return pendingOutcome(undefined, saved);
        receipt = recovered;
      } else {
        const reservation = { id: contributionId(input.intent.sender, input.intent.context.intentId), amount: input.intent.amount.toString() };
        input.storage.setItem(key, JSON.stringify(reservation));
        saved = reservation;
        submitting = true;
        saved.hash = await input.send();
        input.storage.setItem(key, JSON.stringify(saved));
        receipt = await input.confirm(saved.hash, saved.id);
      }
      verifyReceipt(receipt, saved, input.intent.sender);
      input.storage.removeItem(key);
      return { status: 'confirmed', message: 'Contribution confirmed. Each recipient’s settlement is recorded below.', receipt, hash: receipt.transactionHash };
    } catch (error) {
      let safe =
        (submitting && !saved?.hash && (error instanceof SupportNotSubmittedError || supportWasCanceled(error))) || error instanceof ContributionRevertedError;
      if (safe) {
        try {
          input.storage.removeItem(key);
        } catch {
          safe = false;
        }
      }
      const status = saved && !safe ? 'uncertain' : 'failed';
      const technicalMessage = error instanceof Error ? error.message : 'The contribution could not be checked.';
      if (status === 'uncertain') rememberUncertainty(saved, error, key, input.storage);
      return status === 'uncertain' ? pendingOutcome(error, saved) : { status, message: technicalMessage };
    }
  };
  const promise = (typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request(key, execute) : execute()).finally(() =>
    operations.delete(key)
  );
  operations.set(key, promise);
  return promise;
}

export async function recoverSavedContribution(input: {
  scope: ContributionScope;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  confirm: (hash: Hash, id: Hash) => Promise<ContributionReceipt>;
  recover: (id: Hash) => Promise<ContributionReceipt | undefined>;
  currentAccount: () => boolean;
}): Promise<ContributionOutcome> {
  const key = contributionStorageKey(input.scope);
  const existing = operations.get(key);
  if (existing) return existing;
  const execute = async (): Promise<ContributionOutcome> => {
    let saved: Saved | undefined;
    try {
      saved = readSavedContribution(input.scope, input.storage);
      if (!saved) return { status: 'failed', message: 'No pending contribution was found.' };
      if (!input.currentAccount()) return pendingOutcome(new Error('Reconnect the paying account to continue checking.'), saved);
      const receipt = saved.hash ? await input.confirm(saved.hash, saved.id) : await input.recover(saved.id);
      if (!receipt) return pendingOutcome(undefined, saved);
      verifyReceipt(receipt, saved, input.scope.sender);
      input.storage.removeItem(key);
      return { status: 'confirmed', message: 'Contribution confirmed. Each recipient’s settlement is recorded below.', receipt, hash: receipt.transactionHash };
    } catch (error) {
      if (error instanceof ContributionRevertedError) {
        try {
          input.storage.removeItem(key);
          return { status: 'failed', message: error.message };
        } catch {
          /* Keep the journal until its final status can be shown safely. */
        }
      }
      rememberUncertainty(saved, error, key, input.storage);
      return pendingOutcome(error, saved);
    }
  };
  const promise = (typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request(key, execute) : execute()).finally(() =>
    operations.delete(key)
  );
  operations.set(key, promise);
  return promise;
}
