import { createPublicClient, formatEther, http, parseAbiItem, type Address, type Hash, type PublicClient } from 'viem';
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
    name: 'musicRegTrackHashAtIndex',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
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

  constructor(options: { rpcUrl: string; chainId: number; directoryAddress: `0x${string}`; client?: PublicClient }) {
    this.identity = {
      chainId: options.chainId,
      directoryAddress: options.directoryAddress
    };
    this.client = options.client ?? createPublicClient({ transport: http(options.rpcUrl) });
  }

  async getHeadBlock(): Promise<number> {
    return asBlockNumber(await this.client.getBlockNumber());
  }

  async getBlockHash(blockNumber: number): Promise<`0x${string}`> {
    const block = await this.client.getBlock({ blockNumber: BigInt(blockNumber) });
    if (!block.hash) throw new Error(`Block ${blockNumber} has no canonical hash`);
    return block.hash;
  }

  async listArtists(): Promise<DirectoryArtist[]> {
    const directory = this.identity.directoryAddress;
    const total = (await this.client.readContract({
      address: directory,
      abi: artistDirectoryAbi,
      functionName: 'artistCount'
    })) as bigint;

    const entries: DirectoryArtist[] = [];
    for (let offset = 0n; offset < total; offset += DIRECTORY_PAGE_SIZE) {
      const limit = total - offset > DIRECTORY_PAGE_SIZE ? DIRECTORY_PAGE_SIZE : total - offset;
      const [artists, runtimes] = (await this.client.readContract({
        address: directory,
        abi: artistDirectoryAbi,
        functionName: 'artistsPage',
        args: [offset, limit]
      })) as [Address[], Address[]];

      for (let index = 0; index < artists.length; index += 1) {
        const artistAddress = artists[index];
        const runtimeAddress = runtimes[index];
        if (!artistAddress || !runtimeAddress || runtimeAddress.toLowerCase() === ZERO_ADDRESS) continue;
        entries.push({ artistAddress, runtimeAddress });
      }
    }
    return entries;
  }

  async listTrackHashes(runtimeAddress: `0x${string}`): Promise<`0x${string}`[]> {
    const count = (await this.client.readContract({
      address: runtimeAddress,
      abi: musicRegistryAbi,
      functionName: 'musicRegTrackCount'
    })) as bigint;

    return Promise.all(
      Array.from({ length: Number(count) }, async (_, index) => {
        return (await this.client.readContract({
          address: runtimeAddress,
          abi: musicRegistryAbi,
          functionName: 'musicRegTrackHashAtIndex',
          args: [BigInt(index)]
        })) as Hash;
      })
    );
  }

  async readRelease(artistAddress: `0x${string}`, runtimeAddress: `0x${string}`, contentHash: `0x${string}`): Promise<CatalogRelease> {
    const [[track], splitCount] = (await Promise.all([
      this.client.readContract({
        address: runtimeAddress,
        abi: musicRegistryAbi,
        functionName: 'musicRegGetTrack',
        args: [contentHash]
      }),
      this.client.readContract({
        address: runtimeAddress,
        abi: musicRoyaltiesAbi,
        functionName: 'musicRoySplitCount',
        args: [contentHash]
      })
    ])) as [[OnchainTrack, Address], bigint];

    const royaltySplits = await Promise.all(
      Array.from({ length: Number(splitCount) }, async (_, index) => {
        const [recipient, bps] = (await this.client.readContract({
          address: runtimeAddress,
          abi: musicRoyaltiesAbi,
          functionName: 'musicRoySplitAt',
          args: [contentHash, BigInt(index)]
        })) as [Address, number];
        return {
          label: index === 0 ? 'Primary recipient' : `Split ${index + 1}`,
          recipient,
          bps: Number(bps)
        };
      })
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
    if (fromBlock > toBlock) return { directoryChanged: false, releases: [] };

    const directoryLogsPromise = this.client.getLogs({
      address: this.identity.directoryAddress,
      event: artistRegisteredEvent,
      fromBlock: BigInt(fromBlock),
      toBlock: BigInt(toBlock),
      strict: true
    });

    if (runtimeAddresses.length === 0) {
      const directoryLogs = await directoryLogsPromise;
      return { directoryChanged: directoryLogs.length > 0, releases: [] };
    }

    const eventLogs = await Promise.all([
      this.client.getLogs({
        address: runtimeAddresses,
        event: trackRegisteredEvent,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
        strict: true
      }),
      this.client.getLogs({
        address: runtimeAddresses,
        event: trackDeactivatedEvent,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
        strict: true
      }),
      this.client.getLogs({
        address: runtimeAddresses,
        event: trackReactivatedEvent,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
        strict: true
      }),
      this.client.getLogs({
        address: runtimeAddresses,
        event: trackAccessModeChangedEvent,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
        strict: true
      })
    ]);
    const directoryLogs = await directoryLogsPromise;

    const byRelease = new Map<string, CatalogChange>();
    for (const log of eventLogs.flat()) {
      const contentHash = log.args.contentHash;
      if (!contentHash) continue;
      const change = {
        runtimeAddress: log.address,
        contentHash,
        sourceBlock: asBlockNumber(log.blockNumber)
      };
      const key = `${change.runtimeAddress.toLowerCase()}:${change.contentHash.toLowerCase()}`;
      const previous = byRelease.get(key);
      if (!previous || change.sourceBlock >= previous.sourceBlock) byRelease.set(key, change);
    }

    return {
      directoryChanged: directoryLogs.length > 0,
      releases: [...byRelease.values()]
    };
  }
}
