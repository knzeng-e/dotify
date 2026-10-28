import { CatalogBoundsError } from './bounds.js';
import { musicRegistryPageAbi } from '../../generated/musicRegistryPage.js';
import { createPublicClient, formatEther, http, parseAbiItem, type Address, type Hash, type PublicClient } from 'viem';
import { concurrencyGate, mapConcurrent } from './concurrency.js';
import type { CatalogChainGateway, CatalogChange, CatalogChangeSet, CatalogRelease, DirectoryArtist } from './types.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DIRECTORY_PAGE_SIZE = 50n;

const artistDirectoryAbi = [
  {
    type: 'function',
    name: 'artistCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'artistsPage',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' }
    ],
    outputs: [
      { name: 'artists', type: 'address[]' },
      { name: 'runtimes', type: 'address[]' }
    ],
    stateMutability: 'view'
  }
] as const;

const musicRegistryAbi = [
  {
    type: 'function',
    name: 'musicRegTrackCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'musicRegGetTrack',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [
      {
        name: 'track',
        type: 'tuple',
        components: [
          { name: 'artist', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'title', type: 'string' },
          { name: 'artistName', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'imageRef', type: 'string' },
          { name: 'audioRef', type: 'string' },
          { name: 'metadataRef', type: 'string' },
          { name: 'artistContractRef', type: 'string' },
          { name: 'royaltyBps', type: 'uint16' },
          { name: 'accessMode', type: 'uint8' },
          { name: 'pricePlanck', type: 'uint128' },
          { name: 'requiredPersonhood', type: 'uint8' },
          { name: 'registeredAtBlock', type: 'uint64' },
          { name: 'active', type: 'bool' }
        ]
      },
      { name: 'tokenOwner', type: 'address' }
    ],
    stateMutability: 'view'
  }
] as const;

const musicRoyaltiesAbi = [
  {
    type: 'function',
    name: 'musicRoySplitCount',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'musicRoySplitAt',
    inputs: [
      { name: 'contentHash', type: 'bytes32' },
      { name: 'index', type: 'uint256' }
    ],
    outputs: [
      { name: 'recipient', type: 'address' },
      { name: 'bps', type: 'uint16' }
    ],
    stateMutability: 'view'
  }
] as const;

const artistRegisteredEvent = parseAbiItem('event ArtistRegistered(address indexed artist, address indexed runtime)');
const trackRegisteredEvent = parseAbiItem(
  'event TrackRegistered(bytes32 indexed contentHash, uint256 indexed tokenId, address indexed artist, string title, uint8 accessMode, uint128 pricePlanck, uint8 requiredPersonhood)'
);
const trackDeactivatedEvent = parseAbiItem('event TrackDeactivated(bytes32 indexed contentHash, address indexed artist)');
const trackMetadataUpdatedEvent = parseAbiItem('event TrackMetadataUpdated(bytes32 indexed contentHash, address indexed artist, string metadataRef)');
const trackReactivatedEvent = parseAbiItem('event TrackReactivated(bytes32 indexed contentHash, address indexed artist)');
const trackAccessModeChangedEvent = parseAbiItem(
  'event TrackAccessModeChanged(bytes32 indexed contentHash, address indexed artist, uint8 accessMode, uint128 pricePlanck, uint8 requiredPersonhood)'
);

type OnchainTrack = {
  artist: Address;
  tokenId: bigint;
  title: string;
  artistName: string;
  description: string;
  imageRef: string;
  audioRef: string;
  metadataRef: string;
  artistContractRef: string;
  royaltyBps: number;
  accessMode: number;
  pricePlanck: bigint;
  requiredPersonhood: number;
  registeredAtBlock: bigint;
  active: boolean;
};

function accessMode(value: number): CatalogRelease['accessMode'] {
  if (value === 1) return 'classic';
  if (value === 2) return 'free';
  return 'human-free';
}

function personhoodLevel(value: number): CatalogRelease['personhoodLevel'] {
  return value === 2 ? 'DIM2' : 'DIM1';
}

function formatNativeAmount(value: bigint): string {
  const [whole = '0', fraction = ''] = formatEther(value).split('.');
  const trimmedFraction = fraction.replace(/0+$/, '').slice(0, 9);
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

function asBlockNumber(value: bigint | null): number {
  if (value === null) throw new Error('Catalog event is missing a block number');
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Catalog block number exceeds JavaScript safe integer range');
  return number;
}

export class ViemCatalogChainGateway implements CatalogChainGateway {
  readonly identity;
  private readonly client: PublicClient;
  private readonly rpc;
  private readonly concurrency;
  private readonly logBlockRange;
  private readonly addressBatchSize;

  constructor(options: {
    rpcUrl: string;
    chainId: number;
    directoryAddress: `0x${string}`;
    client?: PublicClient;
    concurrency?: number;
    logBlockRange?: number;
    addressBatchSize?: number;
  }) {
    this.concurrency = options.concurrency ?? 8;
    this.logBlockRange = options.logBlockRange ?? 1000;
    this.addressBatchSize = options.addressBatchSize ?? 100;
    if (!Number.isInteger(this.logBlockRange) || this.logBlockRange < 1 || !Number.isInteger(this.addressBatchSize) || this.addressBatchSize < 1)
      throw new Error('Invalid catalog log batch size');
    this.rpc = concurrencyGate(this.concurrency);
    this.identity = {
      chainId: options.chainId,
      directoryAddress: options.directoryAddress
    };
    this.client = options.client ?? createPublicClient({ transport: http(options.rpcUrl) });
  }

  async getHeadBlock(): Promise<number> {
    return asBlockNumber(await this.rpc(() => this.client.getBlockNumber({ cacheTime: 0 })));
  }

  async getBlockHash(blockNumber: number): Promise<`0x${string}`> {
    const block = await this.rpc(() => this.client.getBlock({ blockNumber: BigInt(blockNumber) }));
    if (!block.hash) throw new Error(`Block ${blockNumber} has no canonical hash`);
    return block.hash;
  }

  async listArtists(blockNumber?: number): Promise<DirectoryArtist[]> {
    const directory = this.identity.directoryAddress;
    const total = (await this.rpc(() =>
      this.client.readContract({
        blockNumber: blockNumber === undefined ? undefined : BigInt(blockNumber),
        address: directory,
        abi: artistDirectoryAbi,
        functionName: 'artistCount'
      })
    )) as bigint;

    const entries: DirectoryArtist[] = [];
    for (let offset = 0n; offset < total; offset += DIRECTORY_PAGE_SIZE) {
      const limit = total - offset > DIRECTORY_PAGE_SIZE ? DIRECTORY_PAGE_SIZE : total - offset;
      const [artists, runtimes] = (await this.rpc(() =>
        this.client.readContract({
          blockNumber: blockNumber === undefined ? undefined : BigInt(blockNumber),
          address: directory,
          abi: artistDirectoryAbi,
          functionName: 'artistsPage',
          args: [offset, limit]
        })
      )) as [Address[], Address[]];

      for (let index = 0; index < artists.length; index += 1) {
        const artistAddress = artists[index];
        const runtimeAddress = runtimes[index];
        if (!artistAddress || !runtimeAddress || runtimeAddress.toLowerCase() === ZERO_ADDRESS) continue;
        entries.push({ artistAddress, runtimeAddress });
      }
    }
    return entries;
  }

  async listTrackHashes(runtimeAddress: `0x${string}`, blockNumber?: number): Promise<`0x${string}`[]> {
    const count = (await this.rpc(() =>
      this.client.readContract({
        blockNumber: blockNumber === undefined ? undefined : BigInt(blockNumber),
        address: runtimeAddress,
        abi: musicRegistryAbi,
        functionName: 'musicRegTrackCount'
      })
    )) as bigint;

    if (count > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Catalog track count is not safely representable');
    if (count === 0n) return [];
    const hashes: Hash[] = [];
    for (let offset = 0n; offset < count; offset += 100n) {
      const limit = count - offset < 100n ? count - offset : 100n;
      const page = await this.rpc(() =>
        this.client.readContract({
          address: runtimeAddress,
          blockNumber: blockNumber === undefined ? undefined : BigInt(blockNumber),
          abi: musicRegistryPageAbi,
          functionName: 'musicRegTrackHashesPage',
          args: [offset, limit]
        })
      );
      if (page.length !== Number(limit)) throw new Error('Catalog track page has an unexpected length');
      hashes.push(...page);
    }
    return hashes;
  }

  async readRelease(artistAddress: `0x${string}`, runtimeAddress: `0x${string}`, contentHash: `0x${string}`, blockNumber?: number): Promise<CatalogRelease> {
    const [[track], splitCount] = (await mapConcurrent<() => Promise<unknown>, unknown>(
      [
        () =>
          this.rpc(() =>
            this.client.readContract({
              blockNumber: blockNumber === undefined ? undefined : BigInt(blockNumber),
              address: runtimeAddress,
              abi: musicRegistryAbi,
              functionName: 'musicRegGetTrack',
              args: [contentHash]
            })
          ),
        () =>
          this.rpc(() =>
            this.client.readContract({
              blockNumber: blockNumber === undefined ? undefined : BigInt(blockNumber),
              address: runtimeAddress,
              abi: musicRoyaltiesAbi,
              functionName: 'musicRoySplitCount',
              args: [contentHash]
            })
          )
      ],
      2,
      call => call()
    )) as [[OnchainTrack, Address], bigint];

    // Bound subsequent RPC work before allocating or walking untrusted splits.
    // Do not silently truncate rights or metadata from a malformed or artist-modified runtime.
    if (splitCount > 16n) throw new CatalogBoundsError(`Catalog release ${contentHash} exceeds the 16-recipient limit`);
    for (const [field, limit] of Object.entries({
      title: 800,
      artistName: 800,
      description: 8000,
      imageRef: 512,
      audioRef: 512,
      metadataRef: 512,
      artistContractRef: 512
    })) {
      if (Buffer.byteLength(track[field as keyof OnchainTrack] as string, 'utf8') > limit)
        throw new CatalogBoundsError(`Catalog release ${contentHash} exceeds the ${field} byte limit`);
    }

    const royaltySplits = await mapConcurrent(
      Array.from({ length: Number(splitCount) }, (_, index) => index),
      this.concurrency,
      async index => {
        const [recipient, bps] = (await this.rpc(() =>
          this.client.readContract({
            blockNumber: blockNumber === undefined ? undefined : BigInt(blockNumber),
            address: runtimeAddress,
            abi: musicRoyaltiesAbi,
            functionName: 'musicRoySplitAt',
            args: [contentHash, BigInt(index)]
          })
        )) as [Address, number];
        return {
          label: index === 0 ? 'Primary recipient' : `Split ${index + 1}`,
          recipient,
          bps: Number(bps)
        };
      }
    );

    const registeredAtBlock = Number(track.registeredAtBlock);
    return {
      id: `${runtimeAddress}:${contentHash}`,
      hash: contentHash,
      runtimeAddress,
      artistAddress: track.artist || artistAddress,
      tokenId: track.tokenId.toString(),
      title: track.title,
      artist: track.artistName,
      description: track.description,
      imageRef: track.imageRef,
      coverVariants: track.imageRef ? [track.imageRef] : [],
      audioRef: track.audioRef,
      metadataRef: track.metadataRef,
      bulletinRef: track.metadataRef.startsWith('paseo-bulletin:') ? track.metadataRef : '',
      artistContractRef: track.artistContractRef,
      accessMode: accessMode(Number(track.accessMode)),
      priceWei: track.pricePlanck.toString(),
      priceDot: formatNativeAmount(track.pricePlanck),
      personhoodLevel: personhoodLevel(Number(track.requiredPersonhood)),
      active: track.active,
      encrypted: track.audioRef.startsWith('dotify:enc:'),
      royaltyBps: Number(track.royaltyBps),
      royaltySplits,
      registeredAtBlock,
      sourceBlock: registeredAtBlock
    };
  }

  async getChanges(fromBlock: number, toBlock: number, runtimeAddresses: `0x${string}`[]): Promise<CatalogChangeSet> {
    const byRelease = new Map<string, CatalogChange>();
    let directoryChanged = false;
    const events = [trackRegisteredEvent, trackDeactivatedEvent, trackReactivatedEvent, trackMetadataUpdatedEvent, trackAccessModeChangedEvent];
    // The read model commits after each range. This second bound protects callers
    // that ask the gateway directly for a large gap as well.
    for (let from = fromBlock; from <= toBlock; from += this.logBlockRange) {
      const to = Math.min(toBlock, from + this.logBlockRange - 1);
      const directoryLogs = await this.rpc(() =>
        this.client.getLogs({
          address: this.identity.directoryAddress,
          event: artistRegisteredEvent,
          fromBlock: BigInt(from),
          toBlock: BigInt(to),
          strict: true
        })
      );
      directoryChanged ||= directoryLogs.length > 0;
      for (let offset = 0; offset < runtimeAddresses.length; offset += this.addressBatchSize) {
        const address = runtimeAddresses.slice(offset, offset + this.addressBatchSize);
        const groups = await mapConcurrent(events, this.concurrency, event =>
          this.rpc(() => this.client.getLogs({ address, event, fromBlock: BigInt(from), toBlock: BigInt(to), strict: true }))
        );
        for (const logs of groups)
          for (const log of logs) {
            const contentHash = log.args.contentHash;
            if (!contentHash) continue;
            const change = { runtimeAddress: log.address, contentHash, sourceBlock: asBlockNumber(log.blockNumber) };
            const key = `${change.runtimeAddress.toLowerCase()}:${change.contentHash.toLowerCase()}`;
            const previous = byRelease.get(key);
            if (!previous || change.sourceBlock >= previous.sourceBlock) byRelease.set(key, change);
          }
      }
    }
    return { directoryChanged, releases: [...byRelease.values()] };
  }
}
