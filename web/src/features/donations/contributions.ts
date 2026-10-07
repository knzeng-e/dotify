import {
  decodeEventLog,
  encodeAbiParameters,
  encodeEventTopics,
  formatLog,
  getAbiItem,
  keccak256,
  toHex,
  zeroAddress,
  zeroHash,
  type Address,
  type Hash,
  type ContractFunctionReturnType
} from 'viem';
import { musicRoyaltiesAbi } from '../../generated/contracts/musicRoyalties';
import { getPublicClient } from '../../shared/config/contracts';
import { contributionE2e, contributionTestReader } from '../../e2e/contributionMock';
import type { ContributionConfirmationMode } from '../runtime/runtimePorts';
import { FinalizedNativeContributionFailedError } from '../runtime/nativeContributionProof';

export type ContributionPolicy = ContractFunctionReturnType<typeof musicRoyaltiesAbi, 'view', 'musicGiftPolicy'>;
export type ContributionQuote = ContractFunctionReturnType<typeof musicRoyaltiesAbi, 'view', 'musicGiftQuote'>;
export type ContributionContext = { contentHash: Hash; intentId: Hash; host: Address; room: Hash; expiresAt: bigint };
export const emptyPolicy: ContributionPolicy = {
  version: 0n,
  startsAt: 0n,
  endsAt: 0n,
  hostBps: 0,
  roomAttestor: zeroAddress,
  campaign: zeroHash,
  description: '',
  recipients: [],
  shares: []
};
export function newContributionContext(contentHash: Hash = zeroHash): ContributionContext {
  const random = crypto.getRandomValues(new Uint8Array(32));
  return { contentHash, intentId: keccak256(random), host: zeroAddress, room: zeroHash, expiresAt: BigInt(Math.floor(Date.now() / 1000) + 600) };
}
export function contributionId(sender: Address, intent: Hash): Hash {
  return keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'bytes32' }], [sender, intent]));
}
export type ContributionReceipt = {
  id: Hash;
  runtime: Address;
  contentHash: Hash;
  sender: Address;
  amount: bigint;
  host: Address;
  room: Hash;
  campaign: Hash;
  timestamp: number;
  transactionHash: Hash;
  proofKind?: 'substrate-extrinsic' | 'evm-transaction';
  shares: Array<{ recipient: Address; amount: bigint; role: number; paid: boolean; claimed: boolean }>;
};
export class ContributionRevertedError extends Error {
  constructor() {
    super('The network finalized this contribution as failed. No contribution was recorded.');
    this.name = 'ContributionRevertedError';
  }
}
const contributionReceivedEvent = getAbiItem({ abi: musicRoyaltiesAbi, name: 'ContributionReceived' });
const contributionShareEvent = getAbiItem({ abi: musicRoyaltiesAbi, name: 'ContributionShare' });

function contributionIdTopics(eventName: 'ContributionReceived' | 'ContributionShare', id: Hash): [Hash, Hash] {
  const [eventTopic, idTopic] = encodeEventTopics({ abi: musicRoyaltiesAbi, eventName, args: { id } });
  if (typeof eventTopic !== 'string' || typeof idTopic !== 'string') throw new Error('Could not filter contribution logs by intent.');
  return [eventTopic, idTopic];
}

export async function waitForFinalizedContribution(
  read: () => Promise<ContributionReceipt | undefined>,
  options: { attempts?: number; intervalMs?: number; wait?: (milliseconds: number) => Promise<void> } = {}
): Promise<ContributionReceipt> {
  const attempts = options.attempts ?? 10;
  const intervalMs = options.intervalMs ?? 2_000;
  const wait = options.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const receipt = await read();
    if (receipt) return receipt;
    if (attempt + 1 < attempts) await wait(intervalMs);
  }

  throw new Error('The finalized contribution is not visible from the read network yet. Check its status again; no new payment is needed.');
}

export async function confirmSubmittedContribution(input: {
  mode: ContributionConfirmationMode;
  runtime: Address;
  hash: Hash;
  id: Hash;
  reader: {
    receipt(runtime: Address, hash: Hash, expectedId: Hash): Promise<ContributionReceipt>;
    finalizedReceipt(runtime: Address, expectedId: Hash): Promise<ContributionReceipt | undefined>;
  };
  polling?: Parameters<typeof waitForFinalizedContribution>[1];
  nativeReceipt?: () => Promise<ContributionReceipt | undefined>;
}): Promise<ContributionReceipt> {
  if (input.mode === 'finalized-event') {
    if (!input.nativeReceipt) throw new Error('Product contributions need a native receipt reader. Keep this payment pending.');
    try {
      return await waitForFinalizedContribution(input.nativeReceipt, input.polling);
    } catch (error) {
      if (error instanceof FinalizedNativeContributionFailedError) throw new ContributionRevertedError();
      throw error;
    }
  }

  try {
    return await input.reader.receipt(input.runtime, input.hash, input.id);
  } catch (error) {
    if (error instanceof ContributionRevertedError) throw error;
    const receipt = await input.reader.finalizedReceipt(input.runtime, input.id);
    if (receipt) return receipt;
    throw error;
  }
}

export function contributionReader(rpc: string) {
  const client = getPublicClient(rpc);
  if (contributionE2e) return { ...contributionTestReader, client: { ...client, ...contributionTestReader.client } };
  return {
    client,
    policy: (runtime: Address, scope: Hash) =>
      client.readContract({ address: runtime, abi: musicRoyaltiesAbi, functionName: 'musicGiftPolicy', args: [scope] }),
    quote: (runtime: Address, context: ContributionContext, amount: bigint) =>
      client.readContract({ address: runtime, abi: musicRoyaltiesAbi, functionName: 'musicGiftQuote', args: [context, amount] }),
    async receipt(runtime: Address, hash: Hash, expectedId: Hash): Promise<ContributionReceipt> {
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90000 });
      const final = await client.getBlock({ blockTag: 'finalized' });
      if (final.number < receipt.blockNumber) throw new Error('The contribution is included and still awaiting finality. Check its status again.');
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      if (block.hash !== receipt.blockHash) throw new Error('The receipt changed. Check its status again.');
      if (receipt.status !== 'success') throw new ContributionRevertedError();
      const rows = decodeContributions(runtime, receipt.logs);
      const result = rows.find(row => row.id === expectedId);
      if (!result) throw new Error('The receipt does not match this contribution.');
      return result;
    },
    async finalizedReceipt(runtime: Address, expectedId: Hash): Promise<ContributionReceipt | undefined> {
      const final = await client.getBlock({ blockTag: 'finalized' });
      // DevNet EVM logs reject null topic placeholders. Native Product calls
      // require the separate finalized-block reader; they are absent from this index.
      const received = (
        await client.request({
          method: 'eth_getLogs',
          params: [
            { address: runtime, topics: contributionIdTopics(contributionReceivedEvent.name, expectedId), fromBlock: '0x0', toBlock: toHex(final.number) }
          ]
        })
      ).map(log => formatLog(log));
      const source = received[received.length - 1];
      if (!source) return undefined;
      if (source.blockNumber === null) throw new Error('The finalized contribution log has no block number.');
      const shares = (
        await client.request({
          method: 'eth_getLogs',
          params: [
            {
              address: runtime,
              topics: contributionIdTopics(contributionShareEvent.name, expectedId),
              fromBlock: toHex(source.blockNumber),
              toBlock: toHex(source.blockNumber)
            }
          ]
        })
      ).map(log => formatLog(log));
      return decodeContributions(runtime, [...received, ...shares]).find(row => row.id === expectedId);
    },
    async history(runtime: Address): Promise<ContributionReceipt[]> {
      const block = await client.getBlock({ blockTag: 'finalized' });
      const logs = await client.getLogs({
        address: runtime,
        events: musicRoyaltiesAbi.filter(item => item.type === 'event' && item.name.startsWith('Contribution')),
        fromBlock: 0n,
        toBlock: block.number
      });
      return decodeContributions(runtime, logs);
    }
  };
}

export function decodeContributions(
  runtime: Address,
  logs: Array<{ address: string; topics: readonly Hash[]; data: Hash; transactionHash: Hash | null; logIndex?: number | null }>
): ContributionReceipt[] {
  const rows = new Map<Hash, ContributionReceipt>();
  const claimed = new Set<string>();
  const seen = new Set<string>();
  for (const log of logs) {
    if (log.address.toLowerCase() !== runtime.toLowerCase() || !log.transactionHash) continue;
    if (log.logIndex != null) {
      const key = `${log.transactionHash.toLowerCase()}:${log.logIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    try {
      const event = decodeEventLog({ abi: musicRoyaltiesAbi, topics: log.topics as [Hash, ...Hash[]], data: log.data });
      if (event.eventName === 'ContributionReceived') {
        const a = event.args;
        rows.set(a.id, { ...a, runtime, timestamp: Number(a.timestamp) * 1000, transactionHash: log.transactionHash, shares: [] });
      } else if (event.eventName === 'ContributionShare') {
        const a = event.args;
        rows.get(a.id)?.shares.push({ recipient: a.recipient, amount: a.amount, role: a.role, paid: a.paid, claimed: false });
      } else if (event.eventName === 'ContributionClaimed') claimed.add(`${event.args.id}:${event.args.recipient.toLowerCase()}`);
    } catch {
      /* Other runtime events are not contributions. */
    }
  }
  for (const row of rows.values()) for (const share of row.shares) share.claimed = !share.paid && claimed.has(`${row.id}:${share.recipient.toLowerCase()}`);
  return [...rows.values()].reverse();
}
