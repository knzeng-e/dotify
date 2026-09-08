import type { Address, Hash } from 'viem';
import type { ExecutableTrackAccessPaymentIntent } from '../payments/paymentModel';
import type { OnchainTrackRecord, RoyaltySplit } from '../../shared/types';

export type RuntimeDirectoryEntry = {
  artist: Address;
  runtime: Address;
};

export type RuntimeTrackSnapshot = {
  hash: Hash;
  record: OnchainTrackRecord;
  royaltySplits: Array<Pick<RoyaltySplit, 'recipient' | 'bps'>>;
};

export type RuntimeRoyaltyPaymentLog = {
  trackHash: Hash;
  listener: Address;
  recipient: Address;
  amountWei: bigint;
  settlement: 'paid' | 'claimable';
  pendingTotalWei?: bigint;
  paidAtMs: number | null;
  transactionHash: Hash;
  blockNumber: bigint;
  logIndex: number;
};

export type RuntimeTrackRegistration = {
  contentHash: Hash;
  title: string;
  artistName: string;
  description: string;
  imageRef: string;
  audioRef: string;
  metadataRef: string;
  artistContractRef: string;
  accessMode: number;
  pricePlanck: bigint;
  requiredPersonhood: number;
  royaltyRecipients: Address[];
  royaltyShares: number[];
};

export type RuntimeAccessPolicyUpdate = {
  contentHash: Hash;
  accessMode: number;
  pricePlanck: bigint;
  requiredPersonhood: number;
};

/**
 * Track and split counts are read from contract storage, and the artist
 * directory enumerates runtimes Dotify does not control. `Array.from({ length:
 * Number(count) })` allocates before any later check can reject the value, so a
 * malformed or hostile count has to be refused before it is materialised.
 *
 * Exceeding a bound throws rather than truncating: a silent cap would present a
 * partial catalog as complete. The catalog loader already isolates per-runtime
 * failures, so one bad runtime degrades to a missing artist, not a dead
 * catalog.
 */
export const MAX_RUNTIME_TRACKS = 2_000;
export const MAX_ROYALTY_SPLITS = 128;

export function assertBoundedCount(count: bigint, max: number, label: string): number {
  if (count < 0n || count > BigInt(max)) {
    throw new Error(`${label} reports ${count} entries, above the supported maximum of ${max}.`);
  }
  return Number(count);
}

export interface RuntimeReadPort {
  ensureContract(address: Address): Promise<boolean>;
  resolveArtistRuntime(directoryAddress: Address, artistAddress: Address): Promise<Address | null>;
  getArtistCount(directoryAddress: Address): Promise<bigint>;
  listArtistRuntimes(directoryAddress: Address, artistCount: bigint): Promise<RuntimeDirectoryEntry[]>;
  listRuntimeTracks(runtimeAddress: Address): Promise<RuntimeTrackSnapshot[]>;
  canAccess(runtimeAddress: Address, contentHash: Hash, listenerAddress: Address): Promise<boolean>;
  hasPaid(runtimeAddress: Address, contentHash: Hash, listenerAddress: Address): Promise<boolean>;
  pendingRuntimeOf(factoryAddress: Address, artistAddress: Address): Promise<Address | null>;
  pendingRuntimeStageOf(factoryAddress: Address, artistAddress: Address): Promise<number>;
  listRoyaltyPaymentLogs(runtimeAddress: Address, recipientAddress?: Address): Promise<RuntimeRoyaltyPaymentLog[]>;
  getRoyaltyClaimable(runtimeAddress: Address, recipientAddress: Address): Promise<bigint>;
}

export interface RuntimeWritePort {
  createRuntime(factoryAddress: Address): Promise<Hash>;
  installRuntimeStep(factoryAddress: Address): Promise<Hash>;
  registerTrack(runtimeAddress: Address, registration: RuntimeTrackRegistration): Promise<Hash>;
  payForAccess(intent: ExecutableTrackAccessPaymentIntent): Promise<Hash>;
  claimRoyalty(runtimeAddress: Address, recipientAddress: Address): Promise<Hash>;
  setAccessMode(runtimeAddress: Address, update: RuntimeAccessPolicyUpdate): Promise<Hash>;
  setReleaseActive(runtimeAddress: Address, contentHash: Hash, active: boolean): Promise<Hash>;
  waitForTransaction(txHash: Hash): Promise<void>;
}
