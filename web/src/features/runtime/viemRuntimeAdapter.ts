import { parseAbiItem, zeroAddress, type Address, type Hash } from 'viem';
import {
  artistDirectoryAbi,
  artistRuntimeFactoryAbi,
  getPublicClient,
  getWalletClient,
  musicAccessAbi,
  musicRegistryAbi,
  musicRoyaltiesAbi
} from '../../shared/config/contracts';
import {
  MAX_ROYALTY_SPLITS,
  MAX_RUNTIME_TRACKS,
  assertBoundedCount,
  type RuntimeAccessPolicyUpdate,
  type RuntimeDirectoryEntry,
  type RuntimeReadPort,
  type RuntimeRoyaltyPaymentLog,
  type RuntimeTrackSnapshot,
  type RuntimeWritePort
} from './runtimePorts';
import type { OnchainTrackRecord } from '../../shared/types';

type ViemPublicClient = ReturnType<typeof getPublicClient>;
type ViemWalletClient = Awaited<ReturnType<typeof getWalletClient>>;

const musicRoyAccessPaidEvent = parseAbiItem('event MusicRoyAccessPaid(bytes32 indexed contentHash, address indexed listener, uint256 amount)');

export type ViemRuntimeReaderDeps = {
  ethRpcUrl: string;
  publicClient?: ViemPublicClient;
};

export type ViemRuntimeWriterDeps = ViemRuntimeReaderDeps & {
  walletClient: ViemWalletClient;
};

function resolvePublicClient(deps: ViemRuntimeReaderDeps): ViemPublicClient {
  return deps.publicClient ?? getPublicClient(deps.ethRpcUrl);
}

async function blockTimestampMs(client: ViemPublicClient, blockNumber: bigint): Promise<number | null> {
  const block = await client.getBlock({ blockNumber });
  return Number(block.timestamp) * 1000;
}

export function createViemRuntimeReader(deps: ViemRuntimeReaderDeps): RuntimeReadPort {
  const client = () => resolvePublicClient(deps);

  return {
    ensureContract(address) {
      return client()
        .getCode({ address })
        .then(code => Boolean(code && code !== '0x'));
    },

    async resolveArtistRuntime(directoryAddress, artistAddress) {
      const runtimeAddress = (await client().readContract({
        address: directoryAddress,
        abi: artistDirectoryAbi,
        functionName: 'runtimeOf',
        args: [artistAddress]
      })) as Address;
      return runtimeAddress === zeroAddress ? null : runtimeAddress;
    },

    async getArtistCount(directoryAddress) {
      return (await client().readContract({
        address: directoryAddress,
        abi: artistDirectoryAbi,
        functionName: 'artistCount'
      })) as bigint;
    },

    async listArtistRuntimes(directoryAddress, artistCount) {
      const pageSize = 50n;
      const entries: RuntimeDirectoryEntry[] = [];

      for (let offset = 0n; offset < artistCount; offset += pageSize) {
        const limit = artistCount - offset > pageSize ? pageSize : artistCount - offset;
        const [artists, runtimes] = (await client().readContract({
          address: directoryAddress,
          abi: artistDirectoryAbi,
          functionName: 'artistsPage',
          args: [offset, limit]
        })) as [Address[], Address[]];

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
      const trackCount = (await client().readContract({
        address: runtimeAddress,
        abi: musicRegistryAbi,
        functionName: 'musicRegTrackCount'
      })) as bigint;

      const trackTotal = assertBoundedCount(trackCount, MAX_RUNTIME_TRACKS, `Runtime ${runtimeAddress}`);

      return Promise.all(
        Array.from({ length: trackTotal }, async (_, index): Promise<RuntimeTrackSnapshot> => {
          const hash = (await client().readContract({
            address: runtimeAddress,
            abi: musicRegistryAbi,
            functionName: 'musicRegTrackHashAtIndex',
            args: [BigInt(index)]
          })) as Hash;

          const [record] = (await client().readContract({
            address: runtimeAddress,
            abi: musicRegistryAbi,
            functionName: 'musicRegGetTrack',
            args: [hash]
          })) as [OnchainTrackRecord, Address];

          const splitCount = (await client()
            .readContract({
              address: runtimeAddress,
              abi: musicRoyaltiesAbi,
              functionName: 'musicRoySplitCount',
              args: [hash]
            })
            .catch(() => 0n)) as bigint;
          const splitTotal = assertBoundedCount(splitCount, MAX_ROYALTY_SPLITS, `Track ${hash} royalty splits`);

          const royaltySplits = (
            await Promise.all(
              Array.from({ length: splitTotal }, async (_, splitIndex) => {
                try {
                  const [recipient, bps] = (await client().readContract({
                    address: runtimeAddress,
                    abi: musicRoyaltiesAbi,
                    functionName: 'musicRoySplitAt',
                    args: [hash, BigInt(splitIndex)]
                  })) as [Address, number];
                  return { recipient, bps: Number(bps) };
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

    async canAccess(runtimeAddress, contentHash, listenerAddress) {
      return (await client().readContract({
        address: runtimeAddress,
        abi: musicAccessAbi,
        functionName: 'musicAccCanAccess',
        args: [contentHash, listenerAddress]
      })) as boolean;
    },

    async hasPaid(runtimeAddress, contentHash, listenerAddress) {
      return (await client().readContract({
        address: runtimeAddress,
        abi: musicAccessAbi,
        functionName: 'musicAccHasPaid',
        args: [contentHash, listenerAddress]
      })) as boolean;
    },

    async pendingRuntimeOf(factoryAddress, artistAddress) {
      const pendingRuntime = (await client().readContract({
        address: factoryAddress,
        abi: artistRuntimeFactoryAbi,
        functionName: 'pendingRuntimeOf',
        args: [artistAddress]
      })) as Address;
      return pendingRuntime === zeroAddress ? null : pendingRuntime;
    },

    async pendingRuntimeStageOf(factoryAddress, artistAddress) {
      return Number(
        await client().readContract({
          address: factoryAddress,
          abi: artistRuntimeFactoryAbi,
          functionName: 'pendingRuntimeStageOf',
          args: [artistAddress]
        })
      );
    },

    async listRoyaltyPaymentLogs(runtimeAddress) {
      const logs = await client().getLogs({
        address: runtimeAddress,
        event: musicRoyAccessPaidEvent,
        fromBlock: 0n,
        toBlock: 'latest'
      });
      const timestampsByBlock = new Map<string, number | null>();
      await Promise.all(
        Array.from(new Set(logs.map(log => log.blockNumber.toString()))).map(async blockNumber => {
          timestampsByBlock.set(blockNumber, await blockTimestampMs(client(), BigInt(blockNumber)));
        })
      );

      return logs
        .map((log): RuntimeRoyaltyPaymentLog | null => {
          const trackHash = log.args.contentHash;
          const listener = log.args.listener;
          const amountWei = log.args.amount;
          if (!trackHash || !listener || amountWei === undefined) return null;
          return {
            trackHash,
            listener,
            amountWei,
            paidAtMs: timestampsByBlock.get(log.blockNumber.toString()) ?? null,
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex
          };
        })
        .filter((payment): payment is RuntimeRoyaltyPaymentLog => Boolean(payment));
    }
  };
}

export function createViemRuntimeWriter(deps: ViemRuntimeWriterDeps): RuntimeWritePort {
  const client = () => resolvePublicClient(deps);
  const { walletClient } = deps;

  return {
    createRuntime(factoryAddress) {
      return walletClient.writeContract({
        address: factoryAddress,
        abi: artistRuntimeFactoryAbi,
        functionName: 'createRuntime'
      });
    },

    installRuntimeStep(factoryAddress) {
      return walletClient.writeContract({
        address: factoryAddress,
        abi: artistRuntimeFactoryAbi,
        functionName: 'installRuntimeStep'
      });
    },

    registerTrack(runtimeAddress, registration) {
      return walletClient.writeContract({
        address: runtimeAddress,
        abi: musicRegistryAbi,
        functionName: 'musicRegRegister',
        args: [
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
        ]
      });
    },

    payForAccess(runtimeAddress, contentHash, value) {
      return walletClient.writeContract({
        address: runtimeAddress,
        abi: musicRoyaltiesAbi,
        functionName: 'musicRoyPayAccess',
        args: [contentHash],
        value
      });
    },

    setAccessMode(runtimeAddress, update: RuntimeAccessPolicyUpdate) {
      return walletClient.writeContract({
        address: runtimeAddress,
        abi: musicRegistryAbi,
        functionName: 'musicRegSetAccessMode',
        args: [update.contentHash, update.accessMode, update.pricePlanck, update.requiredPersonhood]
      });
    },

    setReleaseActive(runtimeAddress, contentHash, active) {
      return active
        ? walletClient.writeContract({
            address: runtimeAddress,
            abi: musicRegistryAbi,
            functionName: 'musicRegReactivate',
            args: [contentHash]
          })
        : walletClient.writeContract({
            address: runtimeAddress,
            abi: musicRegistryAbi,
            functionName: 'musicRegDeactivate',
            args: [contentHash]
          });
    },

    async waitForTransaction(txHash) {
      await client().waitForTransactionReceipt({ hash: txHash });
    }
  };
}
