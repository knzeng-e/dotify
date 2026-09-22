import { createPublicClient, http, parseAbiItem, zeroAddress, type Address, type Hash } from 'viem';
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
  type RuntimeTrackRegistration,
  type RuntimeTrackSnapshot,
  type RuntimeWritePort
} from './runtimePorts';
import type { OnchainTrackRecord } from '../../shared/types';

type ViemPublicClient = ReturnType<typeof getPublicClient>;
type ViemWalletClient = Awaited<ReturnType<typeof getWalletClient>>;

const musicRoyRoyaltyPaidEvent = parseAbiItem(
  'event MusicRoyRoyaltyPaid(bytes32 indexed contentHash, address indexed listener, address indexed recipient, uint256 amount)'
);
const musicRoyRoyaltyClaimableEvent = parseAbiItem(
  'event MusicRoyRoyaltyClaimable(bytes32 indexed contentHash, address indexed listener, address indexed recipient, uint256 amount, uint256 pendingTotal)'
);
const musicRoyRoyaltyClaimedEvent = parseAbiItem('event MusicRoyRoyaltyClaimed(address indexed recipient, uint256 amount)');
const musicRoyAccessPaidEvent = parseAbiItem('event MusicRoyAccessPaid(bytes32 indexed contentHash, address indexed listener, uint256 amount)');

const PRODUCT_HUB_TESTNET_CHAIN_ID = 420420417;
const PRODUCT_HUB_TESTNET_RPC_URLS = ['https://eth-rpc-testnet.polkadot.io/', 'https://services.polkadothub-rpc.com/testnet/'] as const;
const PRODUCT_HUB_TESTNET_GAS_FEE_MULTIPLIER = 2n;
const TRANSACTION_RECEIPT_TIMEOUT_MS = 240_000;
const TRANSACTION_RECEIPT_POLLING_INTERVAL_MS = 6_000;
const TRANSACTION_LOOKUP_TIMEOUT_MS = 12_000;
const REGISTER_TRACK_GAS_BUFFER_NUMERATOR = 130n;
const REGISTER_TRACK_GAS_BUFFER_DENOMINATOR = 100n;

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

function registerTrackArgs(registration: RuntimeTrackRegistration) {
  return [
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
  ] as const;
}

function walletAccountAddress(walletClient: ViemWalletClient): Address | undefined {
  const account = walletClient.account;
  if (!account) return undefined;
  if (typeof account === 'string') return account as Address;
  return 'address' in account ? (account.address as Address | undefined) : undefined;
}

async function currentWalletChainId(walletClient: ViemWalletClient): Promise<number | undefined> {
  try {
    return await walletClient.getChainId();
  } catch {
    return walletClient.chain?.id;
  }
}

async function assertWalletChainMatchesRpc(publicClient: ViemPublicClient, walletClient: ViemWalletClient): Promise<number> {
  const expectedChainId = await publicClient.getChainId();
  const walletChainId = await currentWalletChainId(walletClient);

  if (walletChainId !== undefined && walletChainId !== expectedChainId) {
    throw new Error(
      `Wallet is connected to chain ${walletChainId}, but Dotify is configured for chain ${expectedChainId}. Switch the wallet network and try again.`
    );
  }

  return expectedChainId;
}

function gasWithBuffer(estimatedGas: bigint): bigint {
  return (estimatedGas * REGISTER_TRACK_GAS_BUFFER_NUMERATOR + REGISTER_TRACK_GAS_BUFFER_DENOMINATOR - 1n) / REGISTER_TRACK_GAS_BUFFER_DENOMINATOR;
}

async function productHubTestnetFeeOverrides(
  publicClient: ViemPublicClient,
  chainId: number
): Promise<{ maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }> {
  if (chainId !== PRODUCT_HUB_TESTNET_CHAIN_ID) return {};
  const gasPrice = await publicClient.getGasPrice();
  return {
    maxFeePerGas: gasPrice * PRODUCT_HUB_TESTNET_GAS_FEE_MULTIPLIER,
    maxPriorityFeePerGas: gasPrice
  };
}

async function prepareRegisterTrackOverrides(
  publicClient: ViemPublicClient,
  walletClient: ViemWalletClient,
  runtimeAddress: Address,
  args: ReturnType<typeof registerTrackArgs>
): Promise<{ gas: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }> {
  const account = walletAccountAddress(walletClient);
  if (!account) {
    throw new Error('Unable to prepare the registration transaction because no wallet account is selected.');
  }

  const chainId = await assertWalletChainMatchesRpc(publicClient, walletClient);

  try {
    const gas = await publicClient.estimateContractGas({
      account,
      address: runtimeAddress,
      abi: musicRegistryAbi,
      functionName: 'musicRegRegister',
      args
    });
    return { gas: gasWithBuffer(gas), ...(await productHubTestnetFeeOverrides(publicClient, chainId)) };
  } catch (error) {
    throw new Error(`Unable to prepare the registration transaction on the configured EVM network. ${describeError(error)}`);
  }
}

type TransactionLookup =
  | { kind: 'confirmed'; rpcUrl: string }
  | { kind: 'reverted'; rpcUrl: string }
  | { kind: 'pending'; rpcUrl: string }
  | { kind: 'unknown'; checkedRpcUrls: string[] };

function normalizeRpcUrl(rpcUrl: string): string {
  return rpcUrl.trim().replace(/\/+$/, '').toLowerCase();
}

function isLocalRpcUrl(rpcUrl: string): boolean {
  try {
    const { hostname } = new URL(rpcUrl);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function transactionLookupRpcUrls(primaryRpcUrl: string): string[] {
  if (isLocalRpcUrl(primaryRpcUrl)) return [primaryRpcUrl];

  const urls = [primaryRpcUrl, ...PRODUCT_HUB_TESTNET_RPC_URLS];
  const seen = new Set<string>();
  return urls.filter(url => {
    const key = normalizeRpcUrl(url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function lookupClientForRpc(deps: ViemRuntimeReaderDeps, rpcUrl: string): ViemPublicClient {
  if (normalizeRpcUrl(rpcUrl) === normalizeRpcUrl(deps.ethRpcUrl)) return resolvePublicClient(deps);
  return createPublicClient({
    transport: http(rpcUrl, {
      timeout: TRANSACTION_LOOKUP_TIMEOUT_MS,
      retryCount: 0
    })
  }) as ViemPublicClient;
}

async function lookupTransaction(deps: ViemRuntimeReaderDeps, txHash: Hash): Promise<TransactionLookup> {
  const checkedRpcUrls: string[] = [];

  for (const rpcUrl of transactionLookupRpcUrls(deps.ethRpcUrl)) {
    checkedRpcUrls.push(rpcUrl);
    const publicClient = lookupClientForRpc(deps, rpcUrl);

    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      if (receipt.status === 'success') return { kind: 'confirmed', rpcUrl };
      if (receipt.status === 'reverted') return { kind: 'reverted', rpcUrl };
    } catch {
      // `TransactionReceiptNotFoundError` is the expected response while the
      // transaction is pending or was dropped; continue with the cheaper hash
      // lookup before trying the next RPC.
    }

    try {
      const transaction = await publicClient.getTransaction({ hash: txHash });
      if (transaction) return { kind: 'pending', rpcUrl };
    } catch {
      // Try the next configured RPC before concluding the wallet hash is absent.
    }
  }

  return { kind: 'unknown', checkedRpcUrls };
}

function transactionWaitTimedOut(error: unknown): boolean {
  return describeError(error).toLowerCase().includes('timed out while waiting for transaction');
}

function shortHash(txHash: Hash): string {
  return `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
}

function receiptRevertedMessage(txHash: Hash, rpcUrl?: string): string {
  const suffix = rpcUrl ? ` on ${rpcUrl}` : '';
  return `Transaction ${shortHash(txHash)} was included${suffix}, but the runtime reverted it. The release was not registered.`;
}

function pendingTransactionMessage(txHash: Hash, rpcUrl: string): string {
  return `Transaction ${shortHash(txHash)} is still pending on ${rpcUrl}. Product DevNet did not include it within ${
    TRANSACTION_RECEIPT_TIMEOUT_MS / 1_000
  } seconds. Keep the wallet on chain ${PRODUCT_HUB_TESTNET_CHAIN_ID}; if the wallet still shows this nonce as pending, cancel or speed it up before retrying.`;
}

function droppedTransactionMessage(txHash: Hash, checkedRpcUrls: string[]): string {
  return `The wallet returned transaction ${shortHash(txHash)}, but Dotify could not find it on the configured Product DevNet RPCs (${checkedRpcUrls.join(
    ', '
  )}) after ${TRANSACTION_RECEIPT_TIMEOUT_MS / 1_000} seconds. It was likely dropped before inclusion. Confirm the wallet is on chain ${
    PRODUCT_HUB_TESTNET_CHAIN_ID
  }, then submit the release again; if your wallet still lists a pending transaction for this account, cancel or speed it up first.`;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function blockTimestampMs(client: ViemPublicClient, blockNumber: bigint): Promise<number | null> {
  const block = await client.getBlock({ blockNumber });
  return Number(block.timestamp) * 1000;
}

type ClaimSettlementLog = {
  recipient: Address;
  amountWei: bigint;
  paidAtMs: number | null;
  transactionHash: Hash;
  blockNumber: bigint;
  logIndex: number;
};

function accessSettlementKey(transactionHash: Hash, trackHash: Hash, listener: Address): string {
  return `${transactionHash.toLowerCase()}:${trackHash.toLowerCase()}:${listener.toLowerCase()}`;
}

function compareLogOrder(left: { blockNumber: bigint; logIndex: number }, right: { blockNumber: bigint; logIndex: number }): number {
  if (left.blockNumber !== right.blockNumber) return left.blockNumber < right.blockNumber ? -1 : 1;
  return left.logIndex - right.logIndex;
}

function reconcileClaimablePayments(claimablePayments: RuntimeRoyaltyPaymentLog[], claimLogs: ClaimSettlementLog[]): RuntimeRoyaltyPaymentLog[] {
  const claimsByRecipient = new Map<string, Array<ClaimSettlementLog & { remainingWei: bigint }>>();

  for (const claim of [...claimLogs].sort(compareLogOrder)) {
    const key = claim.recipient.toLowerCase();
    const claims = claimsByRecipient.get(key) ?? [];
    claims.push({ ...claim, remainingWei: claim.amountWei });
    claimsByRecipient.set(key, claims);
  }

  return [...claimablePayments].sort(compareLogOrder).map(payment => {
    const claims = claimsByRecipient.get(payment.recipient.toLowerCase()) ?? [];
    let remainingPaymentWei = payment.amountWei;
    let lastClaim: ClaimSettlementLog | null = null;

    while (remainingPaymentWei > 0n && claims.length > 0) {
      const claim = claims[0];
      if (!claim) break;
      lastClaim = claim;

      if (claim.remainingWei >= remainingPaymentWei) {
        claim.remainingWei -= remainingPaymentWei;
        remainingPaymentWei = 0n;
        if (claim.remainingWei === 0n) claims.shift();
        break;
      }

      remainingPaymentWei -= claim.remainingWei;
      claims.shift();
    }

    if (remainingPaymentWei > 0n || !lastClaim) return payment;

    return {
      ...payment,
      settlement: 'claimed',
      claimedAtMs: lastClaim.paidAtMs,
      claimTransactionHash: lastClaim.transactionHash
    };
  });
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

    async listRoyaltyPaymentLogs(runtimeAddress, recipientAddress) {
      const eventArgs = recipientAddress ? { recipient: recipientAddress } : undefined;
      const [paidLogs, claimableLogs, claimedLogs, legacyAccessLogs] = await Promise.all([
        client().getLogs({
          address: runtimeAddress,
          event: musicRoyRoyaltyPaidEvent,
          args: eventArgs,
          fromBlock: 0n,
          toBlock: 'latest'
        }),
        client().getLogs({
          address: runtimeAddress,
          event: musicRoyRoyaltyClaimableEvent,
          args: eventArgs,
          fromBlock: 0n,
          toBlock: 'latest'
        }),
        client().getLogs({
          address: runtimeAddress,
          event: musicRoyRoyaltyClaimedEvent,
          args: eventArgs,
          fromBlock: 0n,
          toBlock: 'latest'
        }),
        client().getLogs({
          address: runtimeAddress,
          event: musicRoyAccessPaidEvent,
          fromBlock: 0n,
          toBlock: 'latest'
        })
      ]);
      const allLogs = [...paidLogs, ...claimableLogs, ...claimedLogs, ...legacyAccessLogs];
      const timestampsByBlock = new Map<string, number | null>();
      await Promise.all(
        Array.from(new Set(allLogs.map(log => log.blockNumber.toString()))).map(async blockNumber => {
          timestampsByBlock.set(blockNumber, await blockTimestampMs(client(), BigInt(blockNumber)));
        })
      );

      const payments = paidLogs
        .map((log): RuntimeRoyaltyPaymentLog | null => {
          const trackHash = log.args.contentHash;
          const listener = log.args.listener;
          const recipient = log.args.recipient;
          const amountWei = log.args.amount;
          if (!trackHash || !listener || !recipient || amountWei === undefined) return null;
          return {
            runtimeAddress,
            trackHash,
            listener,
            recipient,
            amountWei,
            settlement: 'paid',
            paidAtMs: timestampsByBlock.get(log.blockNumber.toString()) ?? null,
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex
          };
        })
        .filter((payment): payment is RuntimeRoyaltyPaymentLog => Boolean(payment));

      const claimablePayments = claimableLogs
        .map((log): RuntimeRoyaltyPaymentLog | null => {
          const trackHash = log.args.contentHash;
          const listener = log.args.listener;
          const recipient = log.args.recipient;
          const amountWei = log.args.amount;
          const pendingTotalWei = log.args.pendingTotal;
          if (!trackHash || !listener || !recipient || amountWei === undefined || pendingTotalWei === undefined) return null;
          return {
            runtimeAddress,
            trackHash,
            listener,
            recipient,
            amountWei,
            settlement: 'claimable',
            pendingTotalWei,
            paidAtMs: timestampsByBlock.get(log.blockNumber.toString()) ?? null,
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex
          };
        })
        .filter((payment): payment is RuntimeRoyaltyPaymentLog => Boolean(payment));

      const claimLogs = claimedLogs
        .map((log): ClaimSettlementLog | null => {
          const recipient = log.args.recipient;
          const amountWei = log.args.amount;
          if (!recipient || amountWei === undefined) return null;
          return {
            recipient,
            amountWei,
            paidAtMs: timestampsByBlock.get(log.blockNumber.toString()) ?? null,
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex
          };
        })
        .filter((claim): claim is ClaimSettlementLog => Boolean(claim));

      const currentSettlementKeys = new Set(
        [...paidLogs, ...claimableLogs]
          .map(log => {
            const trackHash = log.args.contentHash;
            const listener = log.args.listener;
            return trackHash && listener ? accessSettlementKey(log.transactionHash, trackHash, listener) : null;
          })
          .filter((key): key is string => Boolean(key))
      );

      const legacyPayments = legacyAccessLogs
        .map((log): RuntimeRoyaltyPaymentLog | null => {
          const trackHash = log.args.contentHash;
          const listener = log.args.listener;
          const amountWei = log.args.amount;
          if (!trackHash || !listener || amountWei === undefined) return null;
          if (currentSettlementKeys.has(accessSettlementKey(log.transactionHash, trackHash, listener))) return null;
          return {
            runtimeAddress,
            trackHash,
            listener,
            recipient: recipientAddress ?? zeroAddress,
            amountWei,
            settlement: 'legacy',
            paidAtMs: timestampsByBlock.get(log.blockNumber.toString()) ?? null,
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex
          };
        })
        .filter((payment): payment is RuntimeRoyaltyPaymentLog => Boolean(payment));

      return [...payments, ...reconcileClaimablePayments(claimablePayments, claimLogs), ...legacyPayments];
    },

    async getRoyaltyClaimable(runtimeAddress, recipientAddress) {
      return (await client().readContract({
        address: runtimeAddress,
        abi: musicRoyaltiesAbi,
        functionName: 'musicRoyClaimable',
        args: [recipientAddress]
      })) as bigint;
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

    async registerTrack(runtimeAddress, registration) {
      const args = registerTrackArgs(registration);
      const overrides = await prepareRegisterTrackOverrides(client(), walletClient, runtimeAddress, args);
      return walletClient.writeContract({
        address: runtimeAddress,
        abi: musicRegistryAbi,
        functionName: 'musicRegRegister',
        args,
        ...overrides
      });
    },

    payForAccess(intent) {
      return walletClient.writeContract({
        address: intent.runtimeAddress,
        abi: musicRoyaltiesAbi,
        functionName: 'musicRoyPayAccess',
        args: [intent.contentHash],
        value: intent.amountPlanck
      });
    },

    claimRoyalty(runtimeAddress, recipientAddress) {
      return walletClient.writeContract({
        address: runtimeAddress,
        abi: musicRoyaltiesAbi,
        functionName: 'musicRoyClaim',
        args: [recipientAddress]
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
      try {
        const receipt = await client().waitForTransactionReceipt({
          hash: txHash,
          timeout: TRANSACTION_RECEIPT_TIMEOUT_MS,
          pollingInterval: TRANSACTION_RECEIPT_POLLING_INTERVAL_MS
        });
        if (receipt.status === 'reverted') throw new Error(receiptRevertedMessage(txHash));
      } catch (error) {
        const lookup = await lookupTransaction(deps, txHash);
        if (lookup.kind === 'confirmed') return;
        if (lookup.kind === 'reverted') throw new Error(receiptRevertedMessage(txHash, lookup.rpcUrl));

        if (transactionWaitTimedOut(error)) {
          if (lookup.kind === 'pending') throw new Error(pendingTransactionMessage(txHash, lookup.rpcUrl));
          throw new Error(droppedTransactionMessage(txHash, lookup.checkedRpcUrls));
        }

        throw error;
      }
    }
  };
}
