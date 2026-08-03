import { describe, expect, it, vi } from 'vitest';
import { createViemRuntimeReader, createViemRuntimeWriter } from './viemRuntimeAdapter';
import type { OnchainTrackRecord } from '../../shared/types';

const directory = '0x1000000000000000000000000000000000000000' as const;
const factory = '0x2000000000000000000000000000000000000000' as const;
const runtime = '0x3000000000000000000000000000000000000000' as const;
const artist = '0x4000000000000000000000000000000000000000' as const;
const listener = '0x5000000000000000000000000000000000000000' as const;
const splitRecipient = '0x6000000000000000000000000000000000000000' as const;
const hash = `0x${'ab'.repeat(32)}` as const;
const txHash = `0x${'cd'.repeat(32)}` as const;

function baseTrackRecord(patch: Partial<OnchainTrackRecord> = {}): OnchainTrackRecord {
  return {
    artist,
    tokenId: 1n,
    title: 'Runtime song',
    artistName: 'Runtime artist',
    description: 'On-chain description',
    imageRef: 'ipfs://cover',
    audioRef: 'dotify.audio.v2:audio',
    metadataRef: 'ipfs://metadata',
    artistContractRef: 'dotify:self-certified',
    royaltyBps: 9000,
    accessMode: 1,
    pricePlanck: 1_000_000_000_000_000_000n,
    requiredPersonhood: 0,
    registeredAtBlock: 12n,
    active: true,
    ...patch
  };
}

describe('createViemRuntimeReader', () => {
  it('paginates directory runtimes and filters zero-address entries', async () => {
    const readContract = vi.fn(async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
      if (functionName !== 'artistsPage') throw new Error(`unexpected ${functionName}`);
      const offset = args?.[0];
      if (offset === 0n) {
        return [[artist], [runtime]];
      }
      return [[listener], ['0x0000000000000000000000000000000000000000']];
    });
    const reader = createViemRuntimeReader({
      ethRpcUrl: 'http://localhost:8545',
      publicClient: { readContract } as never
    });

    await expect(reader.listArtistRuntimes(directory, 51n)).resolves.toEqual([{ artist, runtime }]);
    expect(readContract).toHaveBeenCalledTimes(2);
  });

  it('returns runtime track snapshots with royalty splits', async () => {
    const record = baseTrackRecord();
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case 'musicRegTrackCount':
          return 1n;
        case 'musicRegTrackHashAtIndex':
          return hash;
        case 'musicRegGetTrack':
          return [record, runtime];
        case 'musicRoySplitCount':
          return 1n;
        case 'musicRoySplitAt':
          return [splitRecipient, 2500];
        default:
          throw new Error(`unexpected ${functionName}`);
      }
    });
    const reader = createViemRuntimeReader({
      ethRpcUrl: 'http://localhost:8545',
      publicClient: { readContract } as never
    });

    await expect(reader.listRuntimeTracks(runtime)).resolves.toEqual([
      {
        hash,
        record,
        royaltySplits: [{ recipient: splitRecipient, bps: 2500 }]
      }
    ]);
  });

  it('normalizes royalty payment logs with block timestamps', async () => {
    const getLogs = vi.fn(async () => [
      {
        args: { contentHash: hash, listener, amount: 2_000_000_000_000_000_000n },
        transactionHash: txHash,
        blockNumber: 7n,
        logIndex: 3
      }
    ]);
    const getBlock = vi.fn(async () => ({ timestamp: 123n }));
    const reader = createViemRuntimeReader({
      ethRpcUrl: 'http://localhost:8545',
      publicClient: { getLogs, getBlock } as never
    });

    await expect(reader.listRoyaltyPaymentLogs(runtime)).resolves.toEqual([
      {
        trackHash: hash,
        listener,
        amountWei: 2_000_000_000_000_000_000n,
        paidAtMs: 123_000,
        transactionHash: txHash,
        blockNumber: 7n,
        logIndex: 3
      }
    ]);
  });
});

describe('createViemRuntimeWriter', () => {
  it('routes runtime writes through named contract calls and waits for receipts', async () => {
    const writeContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      return `${txHash}:${functionName}` as `0x${string}`;
    });
    const waitForTransactionReceipt = vi.fn(async () => ({ status: 'success' }));
    const writer = createViemRuntimeWriter({
      ethRpcUrl: 'http://localhost:8545',
      walletClient: { writeContract } as never,
      publicClient: { waitForTransactionReceipt } as never
    });

    await expect(writer.createRuntime(factory)).resolves.toBe(`${txHash}:createRuntime`);
    await expect(writer.installRuntimeStep(factory)).resolves.toBe(`${txHash}:installRuntimeStep`);
    await expect(writer.payForAccess(runtime, hash, 1n)).resolves.toBe(`${txHash}:musicRoyPayAccess`);
    await expect(
      writer.registerTrack(runtime, {
        contentHash: hash,
        title: 'Runtime song',
        artistName: 'Runtime artist',
        description: 'On-chain description',
        imageRef: 'ipfs://cover',
        audioRef: 'dotify.audio.v2:audio',
        metadataRef: 'ipfs://metadata',
        artistContractRef: 'dotify:self-certified',
        accessMode: 1,
        pricePlanck: 1n,
        requiredPersonhood: 0,
        royaltyRecipients: [artist],
        royaltyShares: [10_000]
      })
    ).resolves.toBe(`${txHash}:musicRegRegister`);
    await expect(
      writer.setAccessMode(runtime, {
        contentHash: hash,
        accessMode: 2,
        pricePlanck: 0n,
        requiredPersonhood: 1
      })
    ).resolves.toBe(`${txHash}:musicRegSetAccessMode`);
    await expect(writer.setReleaseActive(runtime, hash, false)).resolves.toBe(`${txHash}:musicRegDeactivate`);

    await writer.waitForTransaction(txHash);
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: txHash });
    expect(writeContract).toHaveBeenCalledTimes(6);
  });
});
