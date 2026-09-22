import { describe, expect, it, vi } from 'vitest';
import { DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET, createNativeRuntimeAccessPaymentIntent } from '../payments/paymentModel';
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
const legacyTxHash = `0x${'de'.repeat(32)}` as const;

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

  it('refuses an implausible track count instead of allocating for it', async () => {
    // A hostile or malformed runtime must not reach Array.from({ length: n }).
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'musicRegTrackCount') return 2n ** 64n;
      throw new Error(`unexpected ${functionName}`);
    });
    const reader = createViemRuntimeReader({
      ethRpcUrl: 'http://localhost:8545',
      publicClient: { readContract } as never
    });

    await expect(reader.listRuntimeTracks(runtime)).rejects.toThrow(/above the supported maximum/);
    expect(readContract).toHaveBeenCalledTimes(1);
  });

  it('refuses an implausible royalty split count for a single track', async () => {
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
          return 10_000n;
        default:
          throw new Error(`unexpected ${functionName}`);
      }
    });
    const reader = createViemRuntimeReader({
      ethRpcUrl: 'http://localhost:8545',
      publicClient: { readContract } as never
    });

    await expect(reader.listRuntimeTracks(runtime)).rejects.toThrow(/above the supported maximum/);
  });

  it('normalizes royalty payment logs with block timestamps', async () => {
    const getLogs = vi.fn(async ({ event }: { event: { name?: string } }) => {
      if (event.name === 'MusicRoyRoyaltyPaid') {
        return [
          {
            args: { contentHash: hash, listener, recipient: splitRecipient, amount: 2_000_000_000_000_000_000n },
            transactionHash: txHash,
            blockNumber: 7n,
            logIndex: 3
          }
        ];
      }
      if (event.name === 'MusicRoyRoyaltyClaimable') {
        return [
          {
            args: { contentHash: hash, listener, recipient: splitRecipient, amount: 1_000_000_000_000_000_000n, pendingTotal: 1_500_000_000_000_000_000n },
            transactionHash: txHash,
            blockNumber: 8n,
            logIndex: 4
          }
        ];
      }
      if (event.name === 'MusicRoyRoyaltyClaimed' || event.name === 'MusicRoyAccessPaid') {
        return [];
      }
      throw new Error(`unexpected event ${event.name}`);
    });
    const getBlock = vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({ timestamp: blockNumber === 7n ? 123n : 124n }));
    const reader = createViemRuntimeReader({
      ethRpcUrl: 'http://localhost:8545',
      publicClient: { getLogs, getBlock } as never
    });

    await expect(reader.listRoyaltyPaymentLogs(runtime, splitRecipient)).resolves.toEqual([
      {
        runtimeAddress: runtime,
        trackHash: hash,
        listener,
        recipient: splitRecipient,
        amountWei: 2_000_000_000_000_000_000n,
        settlement: 'paid',
        paidAtMs: 123_000,
        transactionHash: txHash,
        blockNumber: 7n,
        logIndex: 3
      },
      {
        runtimeAddress: runtime,
        trackHash: hash,
        listener,
        recipient: splitRecipient,
        amountWei: 1_000_000_000_000_000_000n,
        settlement: 'claimable',
        pendingTotalWei: 1_500_000_000_000_000_000n,
        paidAtMs: 124_000,
        transactionHash: txHash,
        blockNumber: 8n,
        logIndex: 4
      }
    ]);
    expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({ args: { recipient: splitRecipient } }));
  });

  it('reconciles claimable accrual rows after successful royalty claims', async () => {
    const getLogs = vi.fn(async ({ event }: { event: { name?: string } }) => {
      if (event.name === 'MusicRoyRoyaltyPaid' || event.name === 'MusicRoyAccessPaid') return [];
      if (event.name === 'MusicRoyRoyaltyClaimable') {
        return [
          {
            args: { contentHash: hash, listener, recipient: splitRecipient, amount: 1_000_000_000_000_000_000n, pendingTotal: 1_000_000_000_000_000_000n },
            transactionHash: txHash,
            blockNumber: 7n,
            logIndex: 3
          },
          {
            args: { contentHash: hash, listener, recipient: splitRecipient, amount: 2_000_000_000_000_000_000n, pendingTotal: 2_000_000_000_000_000_000n },
            transactionHash: legacyTxHash,
            blockNumber: 9n,
            logIndex: 1
          }
        ];
      }
      if (event.name === 'MusicRoyRoyaltyClaimed') {
        return [
          {
            args: { recipient: splitRecipient, amount: 1_000_000_000_000_000_000n },
            transactionHash: legacyTxHash,
            blockNumber: 8n,
            logIndex: 1
          }
        ];
      }
      throw new Error(`unexpected event ${event.name}`);
    });
    const getBlock = vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({ timestamp: blockNumber + 100n }));
    const reader = createViemRuntimeReader({
      ethRpcUrl: 'http://localhost:8545',
      publicClient: { getLogs, getBlock } as never
    });

    await expect(reader.listRoyaltyPaymentLogs(runtime, splitRecipient)).resolves.toMatchObject([
      {
        runtimeAddress: runtime,
        trackHash: hash,
        listener,
        recipient: splitRecipient,
        amountWei: 1_000_000_000_000_000_000n,
        settlement: 'claimed',
        claimedAtMs: 108_000,
        claimTransactionHash: legacyTxHash,
        blockNumber: 7n,
        logIndex: 3
      },
      {
        runtimeAddress: runtime,
        trackHash: hash,
        listener,
        recipient: splitRecipient,
        amountWei: 2_000_000_000_000_000_000n,
        settlement: 'claimable',
        blockNumber: 9n,
        logIndex: 1
      }
    ]);
  });

  it('preserves pre-upgrade access payments as legacy history without duplicating W05 payments', async () => {
    const getLogs = vi.fn(async ({ event }: { event: { name?: string } }) => {
      if (event.name === 'MusicRoyRoyaltyClaimable' || event.name === 'MusicRoyRoyaltyClaimed') return [];
      if (event.name === 'MusicRoyRoyaltyPaid') {
        return [
          {
            args: { contentHash: hash, listener, recipient: splitRecipient, amount: 2_000_000_000_000_000_000n },
            transactionHash: txHash,
            blockNumber: 10n,
            logIndex: 2
          }
        ];
      }
      if (event.name === 'MusicRoyAccessPaid') {
        return [
          {
            args: { contentHash: hash, listener, amount: 4_000_000_000_000_000_000n },
            transactionHash: txHash,
            blockNumber: 10n,
            logIndex: 3
          },
          {
            args: { contentHash: hash, listener, amount: 3_000_000_000_000_000_000n },
            transactionHash: legacyTxHash,
            blockNumber: 5n,
            logIndex: 1
          }
        ];
      }
      throw new Error(`unexpected event ${event.name}`);
    });
    const getBlock = vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({ timestamp: blockNumber + 100n }));
    const reader = createViemRuntimeReader({
      ethRpcUrl: 'http://localhost:8545',
      publicClient: { getLogs, getBlock } as never
    });

    await expect(reader.listRoyaltyPaymentLogs(runtime, splitRecipient)).resolves.toEqual([
      {
        runtimeAddress: runtime,
        trackHash: hash,
        listener,
        recipient: splitRecipient,
        amountWei: 2_000_000_000_000_000_000n,
        settlement: 'paid',
        paidAtMs: 110_000,
        transactionHash: txHash,
        blockNumber: 10n,
        logIndex: 2
      },
      {
        runtimeAddress: runtime,
        trackHash: hash,
        listener,
        recipient: splitRecipient,
        amountWei: 3_000_000_000_000_000_000n,
        settlement: 'legacy',
        paidAtMs: 105_000,
        transactionHash: legacyTxHash,
        blockNumber: 5n,
        logIndex: 1
      }
    ]);
  });

  it('reads the claimable balance for one royalty recipient', async () => {
    const readContract = vi.fn(async () => 33n);
    const reader = createViemRuntimeReader({
      ethRpcUrl: 'http://localhost:8545',
      publicClient: { readContract } as never
    });

    await expect(reader.getRoyaltyClaimable(runtime, splitRecipient)).resolves.toBe(33n);
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'musicRoyClaimable', args: [splitRecipient] }));
  });
});

describe('createViemRuntimeWriter', () => {
  function runtimeRegistration() {
    return {
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
    };
  }

  it('routes runtime writes through named contract calls and waits for receipts', async () => {
    const writeContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      return `${txHash}:${functionName}` as `0x${string}`;
    });
    const waitForTransactionReceipt = vi.fn(async () => ({ status: 'success' }));
    const estimateContractGas = vi.fn(async () => 80_000n);
    const getChainId = vi.fn(async () => 420420417);
    const getGasPrice = vi.fn(async () => 1_000n);
    const writer = createViemRuntimeWriter({
      ethRpcUrl: 'http://localhost:8545',
      walletClient: { account: { address: artist }, getChainId, writeContract } as never,
      publicClient: { estimateContractGas, getChainId, getGasPrice, waitForTransactionReceipt } as never
    });

    await expect(writer.createRuntime(factory)).resolves.toBe(`${txHash}:createRuntime`);
    await expect(writer.installRuntimeStep(factory)).resolves.toBe(`${txHash}:installRuntimeStep`);
    await expect(
      writer.payForAccess(
        createNativeRuntimeAccessPaymentIntent({
          runtimeAddress: runtime,
          contentHash: hash,
          amountPlanck: 1n,
          asset: DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET
        })
      )
    ).resolves.toBe(`${txHash}:musicRoyPayAccess`);
    await expect(writer.claimRoyalty(runtime, artist)).resolves.toBe(`${txHash}:musicRoyClaim`);
    await expect(writer.registerTrack(runtime, runtimeRegistration())).resolves.toBe(`${txHash}:musicRegRegister`);
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
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: txHash, timeout: 240_000, pollingInterval: 6_000 });
    expect(estimateContractGas).toHaveBeenCalledWith(
      expect.objectContaining({
        account: artist,
        address: runtime,
        functionName: 'musicRegRegister'
      })
    );
    expect(writeContract).toHaveBeenCalledTimes(7);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: runtime,
        functionName: 'musicRegRegister',
        gas: 104_000n,
        maxFeePerGas: 2_000n,
        maxPriorityFeePerGas: 1_000n
      })
    );
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: runtime,
        functionName: 'musicRoyPayAccess',
        args: [hash],
        value: 1n
      })
    );
    expect(writeContract).toHaveBeenCalledWith(expect.objectContaining({ address: runtime, functionName: 'musicRoyClaim', args: [artist] }));
  });

  it('refuses to submit a registration when the wallet chain differs from the configured RPC', async () => {
    const writeContract = vi.fn();
    const estimateContractGas = vi.fn();
    const writer = createViemRuntimeWriter({
      ethRpcUrl: 'https://eth-rpc-testnet.polkadot.io/',
      walletClient: { account: { address: artist }, getChainId: vi.fn(async () => 1), writeContract } as never,
      publicClient: { getChainId: vi.fn(async () => 420420417), estimateContractGas } as never
    });

    await expect(writer.registerTrack(runtime, runtimeRegistration())).rejects.toThrow(/Wallet is connected to chain 1/);
    expect(estimateContractGas).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });

  it('reports a dropped transaction when receipt waiting times out and the hash is absent', async () => {
    const waitForTransactionReceipt = vi.fn(async () => {
      throw new Error(`Timed out while waiting for transaction with hash "${txHash}" to be confirmed. Version: viem@2.55.19`);
    });
    const getTransactionReceipt = vi.fn(async () => {
      throw new Error('not found');
    });
    const getTransaction = vi.fn(async () => {
      throw new Error('not found');
    });
    const writer = createViemRuntimeWriter({
      ethRpcUrl: 'http://localhost:8545',
      walletClient: { writeContract: vi.fn() } as never,
      publicClient: { waitForTransactionReceipt, getTransactionReceipt, getTransaction } as never
    });

    await expect(writer.waitForTransaction(txHash)).rejects.toThrow(/could not find it on the configured Product DevNet RPCs/);
    expect(getTransactionReceipt).toHaveBeenCalledWith({ hash: txHash });
    expect(getTransaction).toHaveBeenCalledWith({ hash: txHash });
  });

  it('reports a still-pending transaction when a timeout hash remains in the RPC pool', async () => {
    const waitForTransactionReceipt = vi.fn(async () => {
      throw new Error(`Timed out while waiting for transaction with hash "${txHash}" to be confirmed. Version: viem@2.55.19`);
    });
    const getTransactionReceipt = vi.fn(async () => {
      throw new Error('not found');
    });
    const getTransaction = vi.fn(async () => ({ hash: txHash }));
    const writer = createViemRuntimeWriter({
      ethRpcUrl: 'http://localhost:8545',
      walletClient: { writeContract: vi.fn() } as never,
      publicClient: { waitForTransactionReceipt, getTransactionReceipt, getTransaction } as never
    });

    await expect(writer.waitForTransaction(txHash)).rejects.toThrow(/is still pending/);
  });

  it('accepts a receipt found by follow-up lookup after the initial wait fails', async () => {
    const waitForTransactionReceipt = vi.fn(async () => {
      throw new Error(`Timed out while waiting for transaction with hash "${txHash}" to be confirmed. Version: viem@2.55.19`);
    });
    const getTransactionReceipt = vi.fn(async () => ({ status: 'success' }));
    const writer = createViemRuntimeWriter({
      ethRpcUrl: 'http://localhost:8545',
      walletClient: { writeContract: vi.fn() } as never,
      publicClient: { waitForTransactionReceipt, getTransactionReceipt } as never
    });

    await expect(writer.waitForTransaction(txHash)).resolves.toBeUndefined();
  });
});
