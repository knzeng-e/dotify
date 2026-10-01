import { zeroAddress, zeroHash, type Address, type Hash } from 'viem';
import type { ContributionContext, ContributionPolicy, ContributionQuote, ContributionReceipt } from '../features/donations/contributions';
import { contributionId, emptyPolicy } from '../features/donations/contributions';
import { E2E_CLASSIC_LISTENER, E2E_CLASSIC_TX_HASH } from './classicUnlockMock';

export const contributionE2e = import.meta.env.DEV && import.meta.env.VITE_E2E_CLASSIC_UNLOCK === 'true';
type State = {
  sends: number;
  confirmed: boolean;
  receipt?: ContributionReceipt;
  receipts?: ContributionReceipt[];
  historyError?: string;
  complete?: () => void;
};
let state: State | undefined;
const policies = new Map<string, ContributionPolicy>();
function current() {
  state ??= { sends: 0, confirmed: false };
  Reflect.set(window, '__DOTIFY_E2E_DONATION__', state);
  return state;
}
let prepared: { context: ContributionContext; amount: bigint; runtime: Address } | undefined;
export const contributionTestReader = {
  client: { getChainId: async () => 420420417 },
  policy: async (runtime: Address, scope: Hash) => policies.get(`${runtime}:${scope}`) ?? emptyPolicy,
  quote: async (runtime: Address, context: ContributionContext, amount: bigint): Promise<ContributionQuote> => {
    current();
    prepared = { runtime, context, amount };
    return {
      digest: zeroHash,
      campaign: zeroHash,
      attestor: zeroAddress,
      recipients: ['0x0000000000000000000000000000000000000a71'],
      amounts: [amount],
      roles: [0]
    };
  },
  async receipt() {
    const s = current();
    const scenario = new URLSearchParams(location.search).get('e2eGift');
    if (scenario === 'pending' && !s.confirmed)
      await new Promise<void>(resolve => {
        s.complete = () => {
          s.confirmed = true;
          resolve();
        };
      });
    if (scenario === 'delayed' && !s.confirmed) throw new Error('Confirmation was interrupted. Check the status before sending again.');
    s.confirmed = true;
    if (!s.receipt) throw new Error('No contribution');
    return s.receipt;
  },
  async history(runtime: Address): Promise<ContributionReceipt[]> {
    const s = current();
    if (s.historyError) throw new Error(s.historyError);
    if (s.receipts) return s.receipts.filter(row => row.runtime.toLowerCase() === runtime.toLowerCase());
    return s.confirmed && s.receipt?.runtime.toLowerCase() === runtime.toLowerCase() ? [s.receipt] : [];
  }
};
export async function contributionTestWrite(runtime: Address, method: string, args: readonly unknown[]) {
  const s = current();
  if (method === 'musicGiftSetPolicy') {
    const p = args[1] as ContributionPolicy;
    policies.set(`${runtime}:${args[0]}`, { ...p, version: p.version + 1n });
    return E2E_CLASSIC_TX_HASH;
  }
  s.sends++;
  if (new URLSearchParams(location.search).get('e2eGift') === 'reject')
    throw Object.assign(new Error('User rejected the signature. No contribution was sent.'), { code: 4001 });
  if (!prepared) throw new Error('No quote');
  const { context, amount } = prepared;
  s.receipt = {
    id: contributionId(E2E_CLASSIC_LISTENER, context.intentId),
    runtime,
    contentHash: context.contentHash,
    sender: E2E_CLASSIC_LISTENER,
    amount,
    host: context.host,
    room: context.room,
    campaign: zeroHash,
    timestamp: Date.now(),
    transactionHash: E2E_CLASSIC_TX_HASH,
    shares: [{ recipient: '0x0000000000000000000000000000000000000a71', amount, role: 0, paid: true, claimed: false }]
  };
  return E2E_CLASSIC_TX_HASH;
}
