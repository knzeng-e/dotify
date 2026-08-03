import type { Address, Hash } from 'viem';
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
  amountWei: bigint;
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
  listRoyaltyPaymentLogs(runtimeAddress: Address): Promise<RuntimeRoyaltyPaymentLog[]>;
}

export interface RuntimeWritePort {
  createRuntime(factoryAddress: Address): Promise<Hash>;
  installRuntimeStep(factoryAddress: Address): Promise<Hash>;
  registerTrack(runtimeAddress: Address, registration: RuntimeTrackRegistration): Promise<Hash>;
  payForAccess(runtimeAddress: Address, contentHash: Hash, value: bigint): Promise<Hash>;
  setAccessMode(runtimeAddress: Address, update: RuntimeAccessPolicyUpdate): Promise<Hash>;
  setReleaseActive(runtimeAddress: Address, contentHash: Hash, active: boolean): Promise<Hash>;
  waitForTransaction(txHash: Hash): Promise<void>;
}
