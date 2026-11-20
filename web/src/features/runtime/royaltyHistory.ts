import { decodeEventLog, zeroAddress, type Address, type Hash } from 'viem';
import { musicRoyaltiesAbi } from '../../generated/contracts/musicRoyalties';
import type { RuntimeRoyaltyPaymentLog } from './runtimePorts';
import { readNativePaymentHistory } from './nativePaymentHistory';
import { nativeRoyaltyReceipts } from './nativeRoyaltyReceipts';

type ProofKind = 'evm-transaction' | 'substrate-extrinsic';
export type RoyaltyEvent = {
  eventName: 'MusicRoyAccessPaid' | 'MusicRoyRoyaltyPaid' | 'MusicRoyRoyaltyClaimable' | 'MusicRoyRoyaltyClaimed';
  args: { contentHash?: Hash; listener?: Address; recipient?: Address; amount?: bigint; pendingTotal?: bigint };
  transactionHash: Hash;
  blockNumber: bigint;
  transactionIndex?: number;
  logIndex: number;
  proofKind?: ProofKind;
};
export async function readNativeRoyaltyEvents(apiUrl: string, runtime: Address): Promise<RoyaltyEvent[]> {
  await nativeRoyaltyReceipts.flush(apiUrl, runtime);
  const receipts = await readNativePaymentHistory(apiUrl, [runtime], 'royalties');
  return receipts.flatMap(receipt =>
    receipt.logs.flatMap(log => {
      if (log.address.toLowerCase() !== runtime.toLowerCase()) return [];
      let event;
      try {
        event = decodeEventLog({ abi: musicRoyaltiesAbi, data: log.data, topics: log.topics as [Hash, ...Hash[]] });
      } catch {
        throw new Error('Native royalty events could not be decoded.');
      }
      if (
        event.eventName !== 'MusicRoyAccessPaid' &&
        event.eventName !== 'MusicRoyRoyaltyPaid' &&
        event.eventName !== 'MusicRoyRoyaltyClaimable' &&
        event.eventName !== 'MusicRoyRoyaltyClaimed'
      )
        return [];
      if (!Number.isSafeInteger(receipt.block.index) || receipt.block.index! < 0) throw new Error('Native royalty history needs the verified extrinsic index.');
      return [
        {
          ...log,
          eventName: event.eventName as RoyaltyEvent['eventName'],
          args: event.args,
          blockNumber: BigInt(receipt.block.number),
          transactionIndex: receipt.block.index,
          proofKind: 'substrate-extrinsic' as const
        }
      ];
    })
  );
}

function compare(a: RoyaltyEvent, b: RoyaltyEvent) {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
  return (a.transactionIndex ?? 0) - (b.transactionIndex ?? 0) || a.logIndex - b.logIndex;
}
const groupKey = (e: RoyaltyEvent) => `${e.blockNumber}:${e.transactionIndex}`;
function fingerprint(e: RoyaltyEvent) {
  return JSON.stringify([
    e.eventName,
    e.args.contentHash?.toLowerCase(),
    e.args.listener?.toLowerCase(),
    e.args.recipient?.toLowerCase(),
    e.args.amount?.toString(),
    e.args.pendingTotal?.toString()
  ]);
}
/** Merge before allocating claims: a native claim can settle an EVM accrual and vice versa. */
export function mergeRoyaltyEvents(evm: RoyaltyEvent[], native: RoyaltyEvent[]): RoyaltyEvent[] {
  const nativeGroups = new Map<string, RoyaltyEvent[]>();
  for (const e of native) {
    const rows = nativeGroups.get(groupKey(e)) ?? [];
    rows.push(e);
    nativeGroups.set(groupKey(e), rows);
  }
  const evmGroups = new Map<string, RoyaltyEvent[]>();
  for (const e of evm) {
    if (e.transactionIndex === undefined || !nativeGroups.has(groupKey(e))) continue;
    const rows = evmGroups.get(groupKey(e)) ?? [];
    rows.push(e);
    evmGroups.set(groupKey(e), rows);
  }
  for (const [key, rows] of evmGroups) {
    const signature = (events: RoyaltyEvent[]) => JSON.stringify(events.map(fingerprint).sort());
    if (signature(rows) !== signature(nativeGroups.get(key)!)) throw new Error('Native and EVM royalty sources disagree.');
  }
  const combined = [...native, ...evm.filter(e => e.transactionIndex === undefined || !nativeGroups.has(groupKey(e)))];
  return [...new Map(combined.map(e => [`${e.proofKind}:${e.blockNumber}:${e.transactionHash.toLowerCase()}:${e.logIndex}`, e])).values()].sort(compare);
}

export function royaltyPaymentsFromEvents(
  runtimeAddress: Address,
  events: RoyaltyEvent[],
  timestamps: Map<string, number | null>,
  recipientAddress?: Address
): RuntimeRoyaltyPaymentLog[] {
  const ordered = [...events].sort(compare);
  const rows: Array<{ event: RoyaltyEvent; payment: RuntimeRoyaltyPaymentLog }> = [];
  const accessKeys = new Set(
    ordered
      .filter(e => e.eventName === 'MusicRoyRoyaltyPaid' || e.eventName === 'MusicRoyRoyaltyClaimable')
      .map(e => `${e.transactionHash.toLowerCase()}:${e.args.contentHash}:${e.args.listener?.toLowerCase()}`)
  );
  for (const event of ordered) {
    const a = event.args;
    if (event.eventName === 'MusicRoyRoyaltyClaimed') {
      if (!a.recipient || a.amount === undefined) throw new Error('Incomplete royalty claim.');
      let remaining = a.amount;
      for (const row of rows) {
        const p = row.payment;
        if (p.settlement !== 'claimable' || p.recipient.toLowerCase() !== a.recipient.toLowerCase()) continue;
        // Runtime claims clear the full balance, so partial coverage is not
        // assigned speculatively to a later or different recipient's income.
        if (remaining < p.amountWei) break;
        remaining -= p.amountWei;
        p.settlement = 'claimed';
        p.claimedAtMs = timestamps.get(event.blockNumber.toString()) ?? null;
        p.claimTransactionHash = event.transactionHash;
        p.claimProofKind = event.proofKind ?? 'evm-transaction';
      }
      continue;
    }
    if (!a.contentHash || !a.listener || a.amount === undefined) throw new Error('Incomplete royalty payment.');
    if (event.eventName === 'MusicRoyAccessPaid' && accessKeys.has(`${event.transactionHash.toLowerCase()}:${a.contentHash}:${a.listener.toLowerCase()}`))
      continue;
    const settlement = event.eventName === 'MusicRoyRoyaltyPaid' ? 'paid' : event.eventName === 'MusicRoyRoyaltyClaimable' ? 'claimable' : 'legacy';
    if (settlement !== 'legacy' && !a.recipient) throw new Error('Royalty beneficiary is missing.');
    rows.push({
      event,
      payment: {
        runtimeAddress,
        trackHash: a.contentHash,
        listener: a.listener,
        recipient: a.recipient ?? recipientAddress ?? zeroAddress,
        amountWei: a.amount,
        settlement,
        ...(a.pendingTotal !== undefined ? { pendingTotalWei: a.pendingTotal } : {}),
        paidAtMs: timestamps.get(event.blockNumber.toString()) ?? null,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        proofKind: event.proofKind ?? 'evm-transaction'
      }
    });
  }
  const payments = rows.map(row => row.payment).filter(p => !recipientAddress || p.recipient.toLowerCase() === recipientAddress.toLowerCase());
  return [
    ...payments.filter(p => p.settlement === 'paid'),
    ...payments.filter(p => p.settlement === 'claimable' || p.settlement === 'claimed'),
    ...payments.filter(p => p.settlement === 'legacy')
  ];
}
