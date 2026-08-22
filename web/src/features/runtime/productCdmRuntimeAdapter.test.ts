import { describe, expect, it, vi } from 'vitest';
import { createNativeRuntimeAccessPaymentIntent } from '../payments/paymentModel';
import {
  ProductCdmRuntimeError,
  ProductCdmRuntimeUnsupportedOperationError,
  createProductCdmRuntimeContractResolver,
  createProductCdmRuntimeReader,
  createProductCdmRuntimeWriter,
  type ProductCdmContractHandle
} from './productCdmRuntimeAdapter';
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
    title: 'Product runtime song',
    artistName: 'Product runtime artist',
    description: 'CDM-backed description',
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

function queryMethod(value: unknown) {
  return {
    query: vi.fn(async () => ({ success: true as const, value }))
  };
}

function txMethod() {
  return {
    tx: vi.fn(async () => ({
      ok: true as const,
      value: {
        txHash,
        ok: true
      }
    }))
  };
}

describe('createProductCdmRuntimeContractResolver', () => {
  it('resolves static CDM packages and requires an explicit runtime instance factory', async () => {
    const directoryContract = {};
    const factoryContract = {};
    const manager = {
      getContract: vi.fn((packageName: string) => {
        if (packageName === '@dotify/directory') return directoryContract;
        if (packageName === '@dotify/factory') return factoryContract;
        throw new Error(`unexpected package ${packageName}`);
      }),
      getAddress: vi.fn((packageName: string) => {
        if (packageName === '@dotify/directory') return directory;
        if (packageName === '@dotify/factory') return factory;
        return runtime;
      })
    };
    const resolver = createProductCdmRuntimeContractResolver({
      manager,
      packages: {
        directory: '@dotify/directory',
        factory: '@dotify/factory',
        runtime: '@dotify/runtime'
      }
    });

    expect(await resolver.hasContract?.(directory)).toBe(true);
    expect(await resolver.hasContract?.(runtime)).toBe(false);
    expect(resolver.getDirectoryContract(directory)).toBe(directoryContract);
    expect(resolver.getFactoryContract(factory)).toBe(factoryContract);
    expect(() => resolver.getRuntimeContract(runtime)).toThrow(ProductCdmRuntimeUnsupportedOperationError);
  });

  it('fails closed when a configured package address does not match the requested address', () => {
    const resolver = createProductCdmRuntimeContractResolver({
      manager: {
        getContract: vi.fn(() => ({})),
        getAddress: vi.fn(() => factory)
      },
      packages: {
        directory: '@dotify/directory',
        factory: '@dotify/factory',
        runtime: '@dotify/runtime'
      }
    });

    expect(() => resolver.getDirectoryContract(directory)).toThrow(ProductCdmRuntimeError);
  });
});

describe('createProductCdmRuntimeReader', () => {
  it('paginates directory runtimes and filters zero-address entries', async () => {
    const artistsPage = {
      query: vi.fn(async (offset: unknown) => {
        if (offset === 0n) {
          return { success: true as const, value: [[artist], [runtime]] };
        }
        return { success: true as const, value: [[listener], ['0x0000000000000000000000000000000000000000']] };
      })
    };
    const reader = createProductCdmRuntimeReader({
      directoryPageSize: 50n,
      contracts: {
        getDirectoryContract: () => ({ artistsPage }),
        getFactoryContract: () => ({}),
        getRuntimeContract: () => ({})
      }
    });

    await expect(reader.listArtistRuntimes(directory, 51n)).resolves.toEqual([{ artist, runtime }]);
    expect(artistsPage.query).toHaveBeenCalledTimes(2);
  });

  it('returns runtime track snapshots with royalty splits and skips unreadable splits', async () => {
    const record = baseTrackRecord();
    const musicRoySplitAt = {
      query: vi.fn(async (_contentHash: unknown, splitIndex: unknown) => {
        if (splitIndex === 1n) {
          return { success: false as const, value: 'missing split' };
        }
        return { success: true as const, value: [splitRecipient, 2500n] };
      })
    };
    const runtimeContract: ProductCdmContractHandle = {
      musicRegTrackCount: queryMethod(1n),
      musicRegTrackHashAtIndex: queryMethod(hash),
      musicRegGetTrack: queryMethod([record, runtime]),
      musicRoySplitCount: queryMethod(2n),
      musicRoySplitAt
    };
    const reader = createProductCdmRuntimeReader({
      contracts: {
        getDirectoryContract: () => ({}),
        getFactoryContract: () => ({}),
        getRuntimeContract: () => runtimeContract
      }
    });

    await expect(reader.listRuntimeTracks(runtime)).resolves.toEqual([
      {
        hash,
        record,
        royaltySplits: [{ recipient: splitRecipient, bps: 2500 }]
      }
    ]);
  });

  it('normalizes zero-address runtime lookups and rejects failed queries', async () => {
    const reader = createProductCdmRuntimeReader({
      contracts: {
        getDirectoryContract: () => ({
          runtimeOf: queryMethod('0x0000000000000000000000000000000000000000'),
          artistCount: {
            query: vi.fn(async () => ({ success: false as const, value: 'registry unavailable' }))
          }
        }),
        getFactoryContract: () => ({}),
        getRuntimeContract: () => ({})
      }
    });

    await expect(reader.resolveArtistRuntime(directory, artist)).resolves.toBeNull();
    await expect(reader.getArtistCount(directory)).rejects.toThrow(ProductCdmRuntimeError);
  });

  it('marks royalty payment history unsupported until Product events are indexed', async () => {
    const reader = createProductCdmRuntimeReader({
      contracts: {
        getDirectoryContract: () => ({}),
        getFactoryContract: () => ({}),
        getRuntimeContract: () => ({})
      }
    });

    await expect(reader.listRoyaltyPaymentLogs(runtime)).rejects.toThrow(ProductCdmRuntimeUnsupportedOperationError);
  });
});

describe('createProductCdmRuntimeWriter', () => {
  it('routes runtime writes through Product CDM contract tx methods', async () => {
    const createRuntime = txMethod();
    const installRuntimeStep = txMethod();
    const musicRegRegister = txMethod();
    const musicRoyPayAccess = txMethod();
    const musicRegSetAccessMode = txMethod();
    const musicRegDeactivate = txMethod();
    const writer = createProductCdmRuntimeWriter({
      contracts: {
        getDirectoryContract: () => ({}),
        getFactoryContract: () => ({ createRuntime, installRuntimeStep }),
        getRuntimeContract: () => ({
          musicRegRegister,
          musicRoyPayAccess,
          musicRegSetAccessMode,
          musicRegDeactivate
        })
      }
    });

    await expect(writer.createRuntime(factory)).resolves.toBe(txHash);
    await expect(writer.installRuntimeStep(factory)).resolves.toBe(txHash);
    await expect(
      writer.registerTrack(runtime, {
        contentHash: hash,
        title: 'Product song',
        artistName: 'Product artist',
        description: 'Published through CDM',
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
    ).resolves.toBe(txHash);
    await expect(
      writer.payForAccess(
        createNativeRuntimeAccessPaymentIntent({
          runtimeAddress: runtime,
          contentHash: hash,
          amountPlanck: 3n
        })
      )
    ).resolves.toBe(txHash);
    await expect(
      writer.setAccessMode(runtime, {
        contentHash: hash,
        accessMode: 2,
        pricePlanck: 0n,
        requiredPersonhood: 1
      })
    ).resolves.toBe(txHash);
    await expect(writer.setReleaseActive(runtime, hash, false)).resolves.toBe(txHash);
    await expect(writer.waitForTransaction(txHash)).resolves.toBeUndefined();

    expect(musicRoyPayAccess.tx).toHaveBeenCalledWith(hash, { value: 3n });
    expect(musicRegSetAccessMode.tx).toHaveBeenCalledWith(hash, 2, 0n, 1);
    expect(musicRegDeactivate.tx).toHaveBeenCalledWith(hash);
  });

  it('throws when Product tx submission returns an error or invalid hash', async () => {
    const failedTx = {
      tx: vi.fn(async () => ({ ok: false as const, error: 'no signer' }))
    };
    const badHashTx = {
      tx: vi.fn(async () => ({
        ok: true as const,
        value: {
          txHash: '0x123',
          ok: true
        }
      }))
    };

    const failedWriter = createProductCdmRuntimeWriter({
      contracts: {
        getDirectoryContract: () => ({}),
        getFactoryContract: () => ({ createRuntime: failedTx }),
        getRuntimeContract: () => ({})
      }
    });
    const badHashWriter = createProductCdmRuntimeWriter({
      contracts: {
        getDirectoryContract: () => ({}),
        getFactoryContract: () => ({ createRuntime: badHashTx }),
        getRuntimeContract: () => ({})
      }
    });

    await expect(failedWriter.createRuntime(factory)).rejects.toThrow(ProductCdmRuntimeError);
    await expect(badHashWriter.createRuntime(factory)).rejects.toThrow(ProductCdmRuntimeError);
  });
});
