import { z } from 'zod';

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

export const catalogRoyaltySplitSchema = z.object({
  label: z.string(),
  recipient: addressSchema,
  bps: z.number().int().min(0).max(10_000)
});

export const catalogReleaseSchema = z.object({
  id: z.string(),
  hash: hashSchema,
  runtimeAddress: addressSchema,
  artistAddress: addressSchema,
  tokenId: z.string().regex(/^\d+$/),
  title: z.string(),
  artist: z.string(),
  description: z.string(),
  imageRef: z.string(),
  coverVariants: z.array(z.string()),
  audioRef: z.string(),
  metadataRef: z.string(),
  bulletinRef: z.string(),
  artistContractRef: z.string(),
  accessMode: z.enum(['human-free', 'classic', 'free']),
  priceWei: z.string().regex(/^\d+$/),
  priceDot: z.string(),
  personhoodLevel: z.enum(['DIM1', 'DIM2']),
  active: z.boolean(),
  encrypted: z.boolean(),
  royaltyBps: z.number().int().min(0).max(10_000),
  royaltySplits: z.array(catalogRoyaltySplitSchema),
  registeredAtBlock: z.number().int().nonnegative(),
  sourceBlock: z.number().int().nonnegative()
});

export const catalogArtistSchema = z.object({
  artistAddress: addressSchema,
  runtimeAddress: addressSchema,
  name: z.string(),
  releaseCount: z.number().int().nonnegative(),
  activeReleaseCount: z.number().int().nonnegative(),
  latestReleaseBlock: z.number().int().nonnegative()
});

export const catalogSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  chainId: z.number().int().nonnegative(),
  directoryAddress: addressSchema,
  lastIndexedBlock: z.number().int().nonnegative(),
  lastIndexedBlockHash: hashSchema,
  chainHeadBlock: z.number().int().nonnegative(),
  indexedAt: z.string().datetime(),
  reconciledAt: z.string().datetime(),
  artists: z.array(catalogArtistSchema),
  releases: z.array(catalogReleaseSchema)
});

export type CatalogRoyaltySplit = z.infer<typeof catalogRoyaltySplitSchema>;
export type CatalogRelease = z.infer<typeof catalogReleaseSchema>;
export type CatalogArtist = z.infer<typeof catalogArtistSchema>;
export type CatalogSnapshot = z.infer<typeof catalogSnapshotSchema>;

export type CatalogState = 'fresh' | 'stale-cache' | 'indexer-outage' | 'rpc-outage' | 'empty';

export type CatalogMetadata = {
  state: CatalogState;
  cacheAvailable: boolean;
  indexedAt: string | null;
  lastIndexedBlock: number | null;
  chainHeadBlock: number | null;
  blockLag: number | null;
  staleAfterMs: number;
  lastErrorCode: 'CATALOG_INDEXER_UNAVAILABLE' | 'CHAIN_RPC_UNAVAILABLE' | null;
};

export type CatalogChange = {
  runtimeAddress: `0x${string}`;
  contentHash: `0x${string}`;
  sourceBlock: number;
};

export type CatalogChangeSet = {
  directoryChanged: boolean;
  releases: CatalogChange[];
};

export type DirectoryArtist = {
  artistAddress: `0x${string}`;
  runtimeAddress: `0x${string}`;
};

export type CatalogChainIdentity = {
  chainId: number;
  directoryAddress: `0x${string}`;
};

export interface CatalogChainGateway {
  readonly identity: CatalogChainIdentity;
  getHeadBlock(): Promise<number>;
  getBlockHash(blockNumber: number): Promise<`0x${string}`>;
  listArtists(): Promise<DirectoryArtist[]>;
  listTrackHashes(runtimeAddress: `0x${string}`): Promise<`0x${string}`[]>;
  readRelease(artistAddress: `0x${string}`, runtimeAddress: `0x${string}`, contentHash: `0x${string}`): Promise<CatalogRelease>;
  getChanges(fromBlock: number, toBlock: number, runtimeAddresses: `0x${string}`[]): Promise<CatalogChangeSet>;
}
