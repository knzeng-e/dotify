import { hexToBytes, toHex, type Hash } from 'viem';
import type { NativeContributionBlock, NativeContributionLog } from './runtimePorts';

export class FinalizedNativeContributionFailedError extends Error {
  constructor() {
    super('The finalized native transaction failed. No contribution was recorded.');
    this.name = 'FinalizedNativeContributionFailedError';
  }
}

type EventRecord = { phase: { type: string; value?: number }; event: { type: string; value: { type: string; value?: unknown } } };
type Block = { block: { header: { number: Hash }; extrinsics: Hash[] } };
export type NativeContributionProofDeps = {
  request: <T>(method: string, params: unknown[]) => Promise<T>;
  decodeEvents: (bytes: Uint8Array) => EventRecord[];
  hashExtrinsic: (bytes: Uint8Array) => Hash;
};

// Twox128("System") ++ Twox128("Events"), the standard native event storage key.
const SYSTEM_EVENTS = '0x26aa394eea5630e07c48ae0c9558cef780d41e5e16056765bc8461851072c9d7';
function validHash(value: unknown, length: number): value is Hash {
  return typeof value === 'string' && new RegExp(`^0x[\\da-f]{${length * 2}}$`, 'i').test(value);
}
function hex(value: unknown): Hash {
  if (typeof value === 'string') return value as Hash;
  if (value instanceof Uint8Array) return toHex(value);
  if (value && typeof value === 'object' && 'asHex' in value && typeof value.asHex === 'function') return value.asHex();
  throw new Error('The native contribution event is unreadable.');
}

/** Verify a single native transaction against a canonical finalized block, never an explorer's success flag. */
export async function readNativeContributionLogs(
  hash: Hash,
  anchor: NativeContributionBlock,
  deps: NativeContributionProofDeps
): Promise<NativeContributionLog[]> {
  if (!validHash(hash, 32) || !Number.isSafeInteger(anchor.number) || anchor.number < 0)
    throw new Error('Choose a valid receipt block before checking this native contribution.');
  const finalizedHash = await deps.request<Hash>('chain_getFinalizedHead', []);
  const finalized = await deps.request<{ number: Hash }>('chain_getHeader', [finalizedHash]);
  if (BigInt(finalized.number) < BigInt(anchor.number)) throw new Error('This contribution block is still awaiting finality.');
  const blockHash = await deps.request<Hash | null>('chain_getBlockHash', [anchor.number]);
  if (!blockHash || (anchor.hash && blockHash.toLowerCase() !== anchor.hash.toLowerCase()))
    throw new Error('The native receipt block changed. Keep this contribution pending.');
  const block = await deps.request<Block>('chain_getBlock', [blockHash]);
  if (BigInt(block.block.header.number) !== BigInt(anchor.number)) throw new Error('The native receipt block does not match its reference.');
  const matches = block.block.extrinsics.flatMap((bytes, index) => (deps.hashExtrinsic(hexToBytes(bytes)).toLowerCase() === hash.toLowerCase() ? [index] : []));
  if (matches.length !== 1 || (anchor.index !== undefined && matches[0] !== anchor.index))
    throw new Error('This block does not contain the saved native transaction. Check its receipt block.');
  const encoded = await deps.request<Hash | null>('state_getStorage', [SYSTEM_EVENTS, blockHash]);
  if (!encoded) throw new Error('The finalized native events are unavailable. Check this saved contribution again.');
  const events = deps.decodeEvents(hexToBytes(encoded)).filter(row => row.phase.type === 'ApplyExtrinsic' && row.phase.value === matches[0]);
  const dispatch = events.filter(
    row => row.event.type === 'System' && (row.event.value.type === 'ExtrinsicFailed' || row.event.value.type === 'ExtrinsicSuccess')
  );
  if (dispatch.length !== 1) throw new Error('The native transaction has no verified dispatch result.');
  if (dispatch[0].event.value.type === 'ExtrinsicFailed') throw new FinalizedNativeContributionFailedError();
  return events.flatMap((row, index) => {
    if (row.event.type !== 'Revive' || row.event.value.type !== 'ContractEmitted') return [];
    const event = row.event.value.value as { contract: unknown; data: unknown; topics: unknown[] };
    const address = hex(event.contract);
    const data = hex(event.data);
    const topics = event.topics.map(hex);
    if (!validHash(address, 20) || !/^0x(?:[\da-f]{2})*$/i.test(data) || !topics.every(topic => validHash(topic, 32)))
      throw new Error('The native contribution log is malformed.');
    return [{ address, data, topics, transactionHash: hash, logIndex: index }];
  });
}
