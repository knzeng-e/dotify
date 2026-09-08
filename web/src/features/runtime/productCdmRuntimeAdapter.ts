import { zeroAddress, type Address, type Hash } from 'viem';
import {
  MAX_ROYALTY_SPLITS,
  MAX_RUNTIME_TRACKS,
  assertBoundedCount,
  type RuntimeAccessPolicyUpdate,
  type RuntimeDirectoryEntry,
  type RuntimeReadPort,
  type RuntimeRoyaltyPaymentLog,
  type RuntimeTrackRegistration,
  type RuntimeTrackSnapshot,
  type RuntimeWritePort
} from './runtimePorts';
import type { OnchainTrackRecord } from '../../shared/types';

export type ProductCdmQueryResult<T = unknown> =
  | {
      success: true;
      value: T;
      gasRequired?: unknown;
    }
  | {
      success: false;
      value: unknown;
      gasRequired?: unknown;
    };

export type ProductCdmTxResult = {
  txHash: string;
  ok: boolean;
  dispatchError?: unknown;
};

export type ProductCdmResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: unknown;
    };

export type ProductCdmContractMethod = {
  query?: (...args: unknown[]) => Promise<ProductCdmQueryResult>;
  tx?: (...args: unknown[]) => Promise<ProductCdmResult<ProductCdmTxResult>>;
};

// Structural mirror of @parity/product-sdk-contracts handles. Keeping this
// local lets unit tests exercise the adapter without opening a Product host.
export type ProductCdmContractHandle = Record<string, ProductCdmContractMethod | undefined>;

export type ProductCdmRuntimePackages = {
  directory: string;
  factory: string;
  runtime: string;
};

export type ProductCdmContractManagerLike = {
  getContract(packageName: string): ProductCdmContractHandle;
  getAddress?: (packageName: string) => Address;
};

export type ProductCdmRuntimeContractFactory = (runtimeAddress: Address, runtimePackage: string) => ProductCdmContractHandle;

export type ProductCdmRuntimeContractResolver = {
  hasContract?: (address: Address) => Promise<boolean>;
  getDirectoryContract(directoryAddress: Address): ProductCdmContractHandle;
  getFactoryContract(factoryAddress: Address): ProductCdmContractHandle;
  getRuntimeContract(runtimeAddress: Address): ProductCdmContractHandle;
};

export type ProductCdmRuntimeAdapterDeps = {
  contracts: ProductCdmRuntimeContractResolver;
  directoryPageSize?: bigint;
};

export class ProductCdmRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductCdmRuntimeError';
  }
}

export class ProductCdmRuntimeUnsupportedOperationError extends ProductCdmRuntimeError {
  constructor(message: string) {
    super(message);
    this.name = 'ProductCdmRuntimeUnsupportedOperationError';
  }
}

export function createProductCdmRuntimeContractResolver(input: {
  manager: ProductCdmContractManagerLike;
  packages: ProductCdmRuntimePackages;
  runtimeContractFactory?: ProductCdmRuntimeContractFactory;
  hasContract?: (address: Address) => Promise<boolean>;
}): ProductCdmRuntimeContractResolver {
  const { manager, packages, runtimeContractFactory } = input;

  return {
    async hasContract(address) {
      if (input.hasContract) return input.hasContract(address);
      return [packages.directory, packages.factory].some(packageName => {
        try {
          return sameAddress(manager.getAddress?.(packageName), address);
        } catch {
          return false;
        }
      });
    },

    getDirectoryContract(directoryAddress) {
      assertPackageAddress(manager, packages.directory, directoryAddress, 'ArtistDirectory');
      return manager.getContract(packages.directory);
    },

    getFactoryContract(factoryAddress) {
      assertPackageAddress(manager, packages.factory, factoryAddress, 'ArtistRuntimeFactory');
      return manager.getContract(packages.factory);
    },

    getRuntimeContract(runtimeAddress) {
      if (!runtimeContractFactory) {
        throw new ProductCdmRuntimeUnsupportedOperationError(
          'Product CDM runtime instance resolution is not configured. Run cdm install for the SmartRuntime ABI and pass a runtimeContractFactory that binds that ABI to the artist runtime address.'
        );
      }
      return runtimeContractFactory(runtimeAddress, packages.runtime);
    }
  };
}

export function createProductCdmRuntimeReader(deps: ProductCdmRuntimeAdapterDeps): RuntimeReadPort {
  const pageSize = deps.directoryPageSize ?? 50n;

  return {
    async ensureContract(address) {
      return deps.contracts.hasContract ? deps.contracts.hasContract(address) : false;
    },

    async resolveArtistRuntime(directoryAddress, artistAddress) {
      const runtimeAddress = await queryContract<Address>(deps.contracts.getDirectoryContract(directoryAddress), 'runtimeOf', [artistAddress]);
      return runtimeAddress === zeroAddress ? null : runtimeAddress;
    },

    async getArtistCount(directoryAddress) {
      return toBigInt(await queryContract<bigint | number | string>(deps.contracts.getDirectoryContract(directoryAddress), 'artistCount'));
    },

    async listArtistRuntimes(directoryAddress, artistCount) {
      const directory = deps.contracts.getDirectoryContract(directoryAddress);
      const entries: RuntimeDirectoryEntry[] = [];

      for (let offset = 0n; offset < artistCount; offset += pageSize) {
        const limit = artistCount - offset > pageSize ? pageSize : artistCount - offset;
        const [artists, runtimes] = await queryContract<[Address[], Address[]]>(directory, 'artistsPage', [offset, limit]);

        for (let index = 0; index < artists.length; index += 1) {
          const artist = artists[index];
          const runtime = runtimes[index];
          if (!artist || !runtime || runtime === zeroAddress) continue;
          entries.push({ artist, runtime });
        }
      }

      return entries;
    },

    async listRuntimeTracks(runtimeAddress) {
      const runtime = deps.contracts.getRuntimeContract(runtimeAddress);
      const trackCount = toBigInt(await queryContract<bigint | number | string>(runtime, 'musicRegTrackCount'));
      const trackTotal = assertBoundedCount(trackCount, MAX_RUNTIME_TRACKS, `Runtime ${runtimeAddress}`);

      return Promise.all(
        Array.from({ length: trackTotal }, async (_, index): Promise<RuntimeTrackSnapshot> => {
          const hash = await queryContract<Hash>(runtime, 'musicRegTrackHashAtIndex', [BigInt(index)]);
          const trackResult = await queryContract<OnchainTrackRecord | [OnchainTrackRecord, Address]>(runtime, 'musicRegGetTrack', [hash]);
          const record = Array.isArray(trackResult) ? trackResult[0] : trackResult;
          const splitCount = await queryContract<bigint | number | string>(runtime, 'musicRoySplitCount', [hash]).catch(() => 0n);
          const splitTotal = assertBoundedCount(toBigInt(splitCount), MAX_ROYALTY_SPLITS, `Track ${hash} royalty splits`);
          const royaltySplits = (
            await Promise.all(
              Array.from({ length: splitTotal }, async (_, splitIndex) => {
                try {
                  const [recipient, bps] = await queryContract<[Address, bigint | number | string]>(runtime, 'musicRoySplitAt', [hash, BigInt(splitIndex)]);
                  return { recipient, bps: toNumber(bps) };
                } catch {
                  return null;
                }
              })
            )
          ).filter((split): split is { recipient: Address; bps: number } => Boolean(split));

          return { hash, record, royaltySplits };
        })
      );
    },

    canAccess(runtimeAddress, contentHash, listenerAddress) {
      return queryContract<boolean>(deps.contracts.getRuntimeContract(runtimeAddress), 'musicAccCanAccess', [contentHash, listenerAddress]);
    },

    hasPaid(runtimeAddress, contentHash, listenerAddress) {
      return queryContract<boolean>(deps.contracts.getRuntimeContract(runtimeAddress), 'musicAccHasPaid', [contentHash, listenerAddress]);
    },

    async pendingRuntimeOf(factoryAddress, artistAddress) {
      const runtimeAddress = await queryContract<Address>(deps.contracts.getFactoryContract(factoryAddress), 'pendingRuntimeOf', [artistAddress]);
      return runtimeAddress === zeroAddress ? null : runtimeAddress;
    },

    async pendingRuntimeStageOf(factoryAddress, artistAddress) {
      return toNumber(
        await queryContract<bigint | number | string>(deps.contracts.getFactoryContract(factoryAddress), 'pendingRuntimeStageOf', [artistAddress])
      );
    },

    async listRoyaltyPaymentLogs(): Promise<RuntimeRoyaltyPaymentLog[]> {
      throw new ProductCdmRuntimeUnsupportedOperationError(
        'Product CDM runtime payment history is not available through the current contract handle API. Use the catalog/read-model indexer until a Product event API or backend indexer is wired.'
      );
    },

    async getRoyaltyClaimable(runtimeAddress, recipientAddress) {
      return toBigInt(await queryContract<bigint | number | string>(deps.contracts.getRuntimeContract(runtimeAddress), 'musicRoyClaimable', [recipientAddress]));
    }
  };
}

export function createProductCdmRuntimeWriter(deps: ProductCdmRuntimeAdapterDeps): RuntimeWritePort {
  return {
    createRuntime(factoryAddress) {
      return txContract(deps.contracts.getFactoryContract(factoryAddress), 'createRuntime');
    },

    installRuntimeStep(factoryAddress) {
      return txContract(deps.contracts.getFactoryContract(factoryAddress), 'installRuntimeStep');
    },

    registerTrack(runtimeAddress, registration: RuntimeTrackRegistration) {
      return txContract(deps.contracts.getRuntimeContract(runtimeAddress), 'musicRegRegister', [
        {
          contentHash: registration.contentHash,
          title: registration.title,
          artistName: registration.artistName,
          description: registration.description,
          imageRef: registration.imageRef,
          audioRef: registration.audioRef,
          metadataRef: registration.metadataRef,
          artistContractRef: registration.artistContractRef,
          accessMode: registration.accessMode,
          pricePlanck: registration.pricePlanck,
          requiredPersonhood: registration.requiredPersonhood
        },
        registration.royaltyRecipients,
        registration.royaltyShares
      ]);
    },

    // Verified against @parity/product-sdk-contracts: contract methods take
    // positional args followed by an optional options object, and `TxOptions`
    // carries `value?: bigint`. txContract spreads this array, so the call is
    // `musicRoyPayAccess.tx(contentHash, { value })` - the CDM equivalent of
    // the viem writer's sibling `value` field. Only native runtime intents are
    // accepted here; Product CASH settlement needs a separate receipt path.
    payForAccess(intent) {
      return txContract(deps.contracts.getRuntimeContract(intent.runtimeAddress), 'musicRoyPayAccess', [intent.contentHash, { value: intent.amountPlanck }]);
    },

    claimRoyalty(runtimeAddress, recipientAddress) {
      return txContract(deps.contracts.getRuntimeContract(runtimeAddress), 'musicRoyClaim', [recipientAddress]);
    },

    setAccessMode(runtimeAddress, update: RuntimeAccessPolicyUpdate) {
      return txContract(deps.contracts.getRuntimeContract(runtimeAddress), 'musicRegSetAccessMode', [
        update.contentHash,
        update.accessMode,
        update.pricePlanck,
        update.requiredPersonhood
      ]);
    },

    setReleaseActive(runtimeAddress, contentHash, active) {
      return txContract(deps.contracts.getRuntimeContract(runtimeAddress), active ? 'musicRegReactivate' : 'musicRegDeactivate', [contentHash]);
    },

    // Intentionally a no-op, and safe by construction: `.tx()` resolves at
    // best-block by default and its `TxResult` carries the including block, so
    // txContract has already awaited inclusion by the time it returns a hash.
    // That is the same point viem's waitForTransactionReceipt resolves at, so
    // a caller that writes and then re-reads (the artist console does) sees
    // post-inclusion state on both adapters. Verified against
    // @parity/product-sdk-tx `SubmitOptions.waitFor` and `TxResult`.
    async waitForTransaction() {
      return;
    }
  };
}

function assertPackageAddress(manager: ProductCdmContractManagerLike, packageName: string, requestedAddress: Address, label: string): void {
  const resolvedAddress = manager.getAddress?.(packageName);
  if (resolvedAddress && !sameAddress(resolvedAddress, requestedAddress)) {
    throw new ProductCdmRuntimeError(`${label} address ${requestedAddress} does not match CDM package ${packageName} at ${resolvedAddress}.`);
  }
}

function sameAddress(left: Address | undefined, right: Address): boolean {
  return Boolean(left && left.toLowerCase() === right.toLowerCase());
}

function getMethod(contract: ProductCdmContractHandle, methodName: string): ProductCdmContractMethod {
  const method = contract[methodName];
  if (!method) {
    throw new ProductCdmRuntimeError(`Product CDM contract method "${methodName}" is missing from the installed ABI.`);
  }
  return method;
}

async function queryContract<T>(contract: ProductCdmContractHandle, methodName: string, args: unknown[] = []): Promise<T> {
  const method = getMethod(contract, methodName);
  if (!method.query) {
    throw new ProductCdmRuntimeError(`Product CDM contract method "${methodName}" does not support query.`);
  }

  const result = await method.query(...args);
  if (!result.success) {
    throw new ProductCdmRuntimeError(`Product CDM query "${methodName}" failed: ${formatUnknown(result.value)}`);
  }
  return result.value as T;
}

async function txContract(contract: ProductCdmContractHandle, methodName: string, args: unknown[] = []): Promise<Hash> {
  const method = getMethod(contract, methodName);
  if (!method.tx) {
    throw new ProductCdmRuntimeError(`Product CDM contract method "${methodName}" does not support transactions.`);
  }

  const result = await method.tx(...args);
  if (!result.ok) {
    throw new ProductCdmRuntimeError(`Product CDM transaction "${methodName}" failed: ${formatUnknown(result.error)}`);
  }
  if (!result.value.ok) {
    throw new ProductCdmRuntimeError(`Product CDM transaction "${methodName}" was rejected by the runtime: ${formatUnknown(result.value.dispatchError)}`);
  }
  return asHash(result.value.txHash, methodName);
}

function asHash(value: string, methodName: string): Hash {
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value as Hash;
  throw new ProductCdmRuntimeError(`Product CDM transaction "${methodName}" returned an invalid transaction hash.`);
}

function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  return BigInt(value);
}

function toNumber(value: bigint | number | string): number {
  return Number(value);
}

function formatUnknown(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
