import { musicRegistryAbi } from '../generated/musicRegistry.js';
import { runtimeArtistAbi } from '../generated/runtimeArtist.js';
import { catalogContent } from './catalog/content.js';
// On-chain access checks for content-key delivery.
//
// The backend never trusts frontend-provided access booleans or runtime
// allowlists. For every key request it:
//   1. resolves one canonical catalog release from the confirmed read model;
//   2. validates that release against ArtistDirectory.runtimeOf(artist);
//   3. validates the stable runtime artist identity;
//   4. validates the runtime track/audioRef/key version;
//   5. calls musicAccCanAccess(contentHash, requester) on that target runtime.
//
// Full v3 release identity is required. Short-lived verdicts are bound to the
// observed finalized/current block pair; ambiguous, stale or unreachable evidence gets no key.

import { createPublicClient, fallback, http, type Address, type PublicClient } from 'viem';
import { config } from '../config.js';
import { catalogReadModel as defaultCatalogReadModel, type CatalogMetadata, type CatalogRelease, type CatalogSnapshot } from './catalog/index.js';
import { contentKeyVersionForAudioRef, isSupportedContentKeyVersion, type ContentKeyDerivationScope, type ContentKeyVersion } from './keyVault.js';

const artistDirectoryAbi = [
  {
    type: 'function',
    name: 'runtimeOf',
    inputs: [{ name: 'artist', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  }
] as const;

const musicAccessAbi = [
  {
    type: 'function',
    name: 'musicAccCanAccess',
    inputs: [
      { name: 'contentHash', type: 'bytes32' },
      { name: 'listener', type: 'address' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  }
] as const;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

type ChainReadClient = Pick<PublicClient, 'readContract' | 'getBlock'>;

type CatalogReader = {
  getSnapshot(): CatalogSnapshot | null;
  getMetadata(): CatalogMetadata;
};

type OnchainTrack = {
  artist: Address;

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

export type AccessDenialCode =
  | 'RPC_UNAVAILABLE'
  | 'CATALOG_UNAVAILABLE'
  | 'ACCESS_PENDING_FINALITY'
  | 'TRACK_NOT_FOUND'
  | 'AMBIGUOUS_RUNTIME'
  | 'RELEASE_IDENTITY_MISMATCH'
  | 'RELEASE_NOT_ENCRYPTED'
  | 'RELEASE_INACTIVE'
  | 'KEY_VERSION_UNSUPPORTED'
  | 'LISTENER_ACCESS_REQUIRED'
  | 'HOST_ACCESS_REQUIRED'
  | 'NOT_FREE';

export type ReleaseKeyIdentity = {
  releaseId: string;
  runtimeAddress: string;
  artistAddress: string;
  audioRef: string;
  keyVersion: string;
};

export type CanonicalRelease = {
  releaseId: string;
  contentHash: `0x${string}`;
  runtimeAddress: Address;
  artistAddress: Address;
  audioRef: string;
  keyVersion: ContentKeyVersion;
  sourceBlock: number | null;
};

export type TrackAccessRequest = {
  contentHash: string;
  requester: string;
  purpose: 'individual' | 'room_host';
  release?: ReleaseKeyIdentity;
};

export type PublicTrackAccessRequest = {
  contentHash: string;
  release?: ReleaseKeyIdentity;
};

export type TrackAccessResult =
  | { allowed: true; runtime: Address; release: CanonicalRelease; keyScope: ContentKeyDerivationScope; validUntil?: number }
  | { allowed: false; code: AccessDenialCode; reason: string };

export type ArtistAuthorityResult =
  | { allowed: true; runtime: Address }
  | { allowed: false; code: 'RPC_UNAVAILABLE' | 'ARTIST_RUNTIME_REQUIRED' | 'ARTIST_IDENTITY_MISMATCH'; reason: string };

export type ChainAccessService = {
  checkArtistAuthority(requester: string): Promise<ArtistAuthorityResult>;
  checkTrackAccess(request: TrackAccessRequest): Promise<TrackAccessResult>;
  checkPublicAccess(request: string | PublicTrackAccessRequest): Promise<TrackAccessResult>;
};

export type ChainAccessServiceOptions = {
  getClient?: () => ChainReadClient | null;
  getDirectoryAddress?: () => Address | undefined;
  getChainId?: () => number;
  catalog?: CatalogReader;
  now?: () => number;
};

let clientCache: PublicClient | null = null;

function getClient(): PublicClient | null {
  if (!config.PASEO_ASSET_HUB_RPC) return null;
  if (!clientCache) {
    // Access checks sit in front of first sound: bound each read instead of
    // the library defaults (10 s and three retries), then try the fallback.
    const rpc = (url: string) => http(url, { timeout: 4_000, retryCount: 1 });
    const fallbackUrl = config.PASEO_ASSET_HUB_RPC_FALLBACK;
    clientCache = createPublicClient({
      transport: fallbackUrl ? fallback([rpc(config.PASEO_ASSET_HUB_RPC), rpc(fallbackUrl)]) : rpc(config.PASEO_ASSET_HUB_RPC)
    });
  }
  return clientCache;
}

function normalizeAddress(value: string): Address {
  return value.toLowerCase() as Address;
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function normalizeHash(value: string): `0x${string}` {
  return value.toLowerCase() as `0x${string}`;
}

function releaseId(runtimeAddress: string, contentHash: string): string {
  return `${runtimeAddress.toLowerCase()}:${contentHash.toLowerCase()}`;
}

function fail(code: AccessDenialCode, reason: string): TrackAccessResult {
  return { allowed: false, code, reason };
}

function snapshotIsAuthoritative(
  snapshot: CatalogSnapshot | null,
  meta: CatalogMetadata,
  chainId: number,
  directoryAddress: Address
): snapshot is CatalogSnapshot {
  return snapshot !== null && meta.state === 'fresh' && snapshot.chainId === chainId && sameAddress(snapshot.directoryAddress, directoryAddress);
}

function canonicalFromCatalogRelease(release: CatalogRelease, keyVersion: ContentKeyVersion): CanonicalRelease {
  return {
    releaseId: release.id.toLowerCase(),
    contentHash: normalizeHash(release.hash),
    runtimeAddress: normalizeAddress(release.runtimeAddress),
    artistAddress: normalizeAddress(release.artistAddress),
    audioRef: release.audioRef,
    keyVersion,
    sourceBlock: release.sourceBlock
  };
}

function resolveKeyVersion(audioRef: string): ContentKeyVersion | TrackAccessResult {
  const keyVersion = contentKeyVersionForAudioRef(audioRef);
  if (!keyVersion) {
    return fail('RELEASE_NOT_ENCRYPTED', 'This release does not point to a Dotify encrypted audio object.');
  }
  return keyVersion;
}

function compareProvidedIdentity(
  provided: ReleaseKeyIdentity,
  candidate: CatalogRelease,
  keyVersion: ContentKeyVersion,
  contentHash: string
): TrackAccessResult | null {
  if (!isSupportedContentKeyVersion(provided.keyVersion)) {
    return fail('KEY_VERSION_UNSUPPORTED', 'The requested content-key version is not supported by this key service.');
  }

  const expectedReleaseId = releaseId(provided.runtimeAddress, contentHash);
  if (
    provided.releaseId.toLowerCase() !== expectedReleaseId ||
    candidate.id.toLowerCase() !== expectedReleaseId ||
    !sameAddress(candidate.runtimeAddress, provided.runtimeAddress) ||
    !sameAddress(candidate.artistAddress, provided.artistAddress) ||
    candidate.hash.toLowerCase() !== contentHash.toLowerCase() ||
    candidate.audioRef !== provided.audioRef ||
    keyVersion !== provided.keyVersion
  ) {
    return fail('RELEASE_IDENTITY_MISMATCH', 'The requested release identity does not match the canonical catalog release.');
  }
  return null;
}

function resolveCatalogRelease(input: {
  contentHash: string;
  provided?: ReleaseKeyIdentity;
  catalog: CatalogReader;
  chainId: number;
  directoryAddress: Address;
}): TrackAccessResult | { allowed: true; release: CanonicalRelease } {
  const snapshot = input.catalog.getSnapshot();
  const meta = input.catalog.getMetadata();
  if (!snapshotIsAuthoritative(snapshot, meta, input.chainId, input.directoryAddress)) {
    return fail('CATALOG_UNAVAILABLE', 'Canonical release evidence is unavailable or stale; retry after the catalog catches up.');
  }

  const index = catalogContent(snapshot);

  if (input.provided) {
    const expectedId = releaseId(input.provided.runtimeAddress, input.contentHash);
    const candidate = index.byId.get(expectedId);
    if (!candidate) return fail('TRACK_NOT_FOUND', 'Release is not present in the confirmed catalog.');

    const version = resolveKeyVersion(candidate.audioRef);
    if (typeof version !== 'string') return version;

    const mismatch = compareProvidedIdentity(input.provided, candidate, version, input.contentHash);
    if (mismatch) return mismatch;

    if (!candidate.active) return fail('RELEASE_INACTIVE', 'This release is inactive and cannot receive new key grants.');
    return { allowed: true, release: canonicalFromCatalogRelease(candidate, version) };
  }

  return fail('RELEASE_IDENTITY_MISMATCH', 'The full streaming release identity is required.');
}

/** Independent reads use one observed block. No multicall deployment is assumed
 * on Product DevNet; every identity and policy check must succeed. */
async function readReleaseVerdict(
  client: ChainReadClient,
  directoryAddress: Address,
  release: CanonicalRelease,
  requester: Address,
  purpose: 'individual' | 'room_host' | 'public',
  blockHash: `0x${string}`,
  chainId: number
): Promise<TrackAccessResult> {
  try {
    const [directoryRuntime, record, canAccess, runtimeArtist] = await Promise.all([
      client.readContract({
        address: directoryAddress,
        abi: artistDirectoryAbi,
        functionName: 'runtimeOf',
        args: [release.artistAddress],
        blockHash,
        requireCanonical: true
      }),
      client.readContract({
        address: release.runtimeAddress,
        abi: musicRegistryAbi,
        functionName: 'musicRegGetTrack',
        args: [release.contentHash],
        blockHash,
        requireCanonical: true
      }),
      client.readContract({
        address: release.runtimeAddress,
        abi: musicAccessAbi,
        functionName: 'musicAccCanAccess',
        args: [release.contentHash, requester],
        blockHash,
        requireCanonical: true
      }),
      client.readContract({ address: release.runtimeAddress, abi: runtimeArtistAbi, functionName: 'runtimeArtist', blockHash, requireCanonical: true })
    ]);
    if (!directoryRuntime || directoryRuntime.toLowerCase() === ZERO_ADDRESS || !sameAddress(directoryRuntime, release.runtimeAddress))
      return fail('RELEASE_IDENTITY_MISMATCH', 'ArtistDirectory no longer maps this artist to the requested runtime.');
    if (!sameAddress(runtimeArtist, release.artistAddress)) return fail('RELEASE_IDENTITY_MISMATCH', 'The runtime artist does not match this release.');
    const track = record as OnchainTrack;
    if (
      !sameAddress(track.artist, release.artistAddress) ||
      track.audioRef !== release.audioRef ||
      contentKeyVersionForAudioRef(track.audioRef) !== release.keyVersion ||
      releaseId(release.runtimeAddress, release.contentHash) !== release.releaseId
    )
      return fail('RELEASE_IDENTITY_MISMATCH', 'Runtime release data no longer matches the canonical catalog release.');
    if (!track.active) return fail('RELEASE_INACTIVE', 'This release is inactive and cannot receive new key grants.');
    if (!canAccess) {
      if (purpose === 'public') return fail('NOT_FREE', 'This track is not free; its access policy requires payment or verification.');
      return purpose === 'room_host'
        ? fail('HOST_ACCESS_REQUIRED', "The room host does not satisfy this track's access policy.")
        : fail('LISTENER_ACCESS_REQUIRED', "This listener does not satisfy this track's access policy.");
    }
    return { allowed: true, runtime: release.runtimeAddress, release, keyScope: keyScopeForRelease(release, chainId) };
  } catch {
    return fail('RPC_UNAVAILABLE', 'Access checks are unavailable: chain verification failed.');
  }
}

function keyScopeForRelease(release: CanonicalRelease, chainId: number): ContentKeyDerivationScope {
  return {
    contentHash: release.contentHash,
    keyVersion: release.keyVersion,
    chainId,
    runtimeAddress: release.runtimeAddress
  };
}

export function createChainAccessService(options: ChainAccessServiceOptions = {}): ChainAccessService {
  const getServiceClient = options.getClient ?? getClient;
  const getDirectoryAddress = options.getDirectoryAddress ?? (() => config.DOTIFY_DIRECTORY_ADDRESS as Address | undefined);
  const getChainId = options.getChainId ?? (() => config.DOTIFY_CHAIN_ID);
  const catalog = options.catalog ?? defaultCatalogReadModel;
  const now = options.now ?? Date.now;
  // Verdicts, never keys. Bounded per process; restart only makes access cold.
  const verdicts = new Map<string, { result: TrackAccessResult; until: number }>();
  const pending = new Map<string, Promise<TrackAccessResult>>();
  type ObservedBlock = { number: bigint; hash: `0x${string}` };
  let headRequest: { client: ChainReadClient; promise: Promise<{ finalized: ObservedBlock; latest: ObservedBlock }> } | undefined;
  function observedBlocks(client: ChainReadClient) {
    if (headRequest?.client === client) return headRequest.promise;
    const promise = (async () => {
      // A canonical latest hash is not finality. No fallback tag or numeric
      // confirmation heuristic is allowed at irreversible key delivery.
      const [finalized, latest] = await Promise.all([
        client.getBlock({ blockTag: 'finalized', includeTransactions: false }),
        client.getBlock({ blockTag: 'latest', includeTransactions: false })
      ]);
      for (const block of [finalized, latest])
        if (typeof block.number !== 'bigint' || block.number < 0n || !block.hash || !/^0x[0-9a-fA-F]{64}$/.test(block.hash))
          throw new Error('Missing block authority');
      if (
        finalized.number! > latest.number! ||
        (finalized.number === latest.number && finalized.hash!.toLowerCase() !== latest.hash!.toLowerCase()) ||
        (finalized.number !== latest.number && finalized.hash!.toLowerCase() === latest.hash!.toLowerCase())
      )
        throw new Error('Inconsistent finalized/current observations');
      return { finalized: { number: finalized.number!, hash: finalized.hash! }, latest: { number: latest.number!, hash: latest.hash! } };
    })();
    headRequest = { client, promise };
    void promise
      .finally(() => {
        if (headRequest?.promise === promise) headRequest = undefined;
      })
      .catch(() => {});
    return promise;
  }
  const pendingFinality = () =>
    fail('ACCESS_PENDING_FINALITY', 'Your release or listening access is still being confirmed. Please wait and try again; no new payment is needed.');

  async function checkRelease(
    contentHash: string,
    requester: Address,
    purpose: 'individual' | 'room_host' | 'public',
    provided?: ReleaseKeyIdentity
  ): Promise<TrackAccessResult> {
    const client = getServiceClient();
    const directoryAddress = getDirectoryAddress();
    if (!client || !directoryAddress) return fail('RPC_UNAVAILABLE', 'Access checks are unavailable: chain RPC or directory is not configured.');
    const chainId = getChainId();
    // Canonical identity/freshness is checked even on a warm verdict.
    const canonical = resolveCatalogRelease({ contentHash, provided, catalog, chainId, directoryAddress });
    if (!canonical.allowed) return canonical;
    const started = now();
    let blocks;
    try {
      blocks = await observedBlocks(client);
    } catch {
      return fail('RPC_UNAVAILABLE', 'Access checks are unavailable: finalized and current state could not be verified.');
    }
    if (canonical.release.sourceBlock === null || !Number.isSafeInteger(canonical.release.sourceBlock) || canonical.release.sourceBlock < 0)
      return fail('CATALOG_UNAVAILABLE', 'Confirmed release evidence is unavailable. Please try again.');
    if (BigInt(canonical.release.sourceBlock) > blocks.finalized.number) return pendingFinality();
    const key = JSON.stringify([
      chainId,
      directoryAddress.toLowerCase(),
      requester.toLowerCase(),
      purpose,
      canonical.release,
      blocks.finalized.number.toString(),
      blocks.finalized.hash,
      blocks.latest.number.toString(),
      blocks.latest.hash
    ]);
    const cached = verdicts.get(key);
    if (cached && cached.until > now() + 10_000) return cached.result;
    const existing = pending.get(key);
    if (existing) return existing;
    // Share the processed result, including its original expiry. Sharing only
    // the raw RPC promise would let a second caller extend that grant window.
    const request = (async (): Promise<TrackAccessResult> => {
      const finalized = readReleaseVerdict(client, directoryAddress, canonical.release, requester, purpose, blocks.finalized.hash, chainId);
      // A newly observed revocation must not wait for finality. Positive access
      // must hold at BOTH hashes. Same-block observations share three reads.
      const latest =
        blocks.latest.hash.toLowerCase() === blocks.finalized.hash.toLowerCase()
          ? finalized
          : readReleaseVerdict(client, directoryAddress, canonical.release, requester, purpose, blocks.latest.hash, chainId);
      const [settled, current] = await Promise.all([finalized, latest]);
      let raw: TrackAccessResult;
      if (!settled.allowed && settled.code === 'RPC_UNAVAILABLE') raw = settled;
      else if (!current.allowed) raw = current;
      else raw = settled.allowed ? settled : pendingFinality();
      if (started + 30_000 <= now()) return fail('RPC_UNAVAILABLE', 'Access verification took too long. Please try again.');
      const result = raw.allowed ? { ...raw, validUntil: started + 30_000 } : raw;
      if (result.allowed || result.code !== 'RPC_UNAVAILABLE') {
        for (const [id, entry] of verdicts) if (entry.until <= now()) verdicts.delete(id);
        verdicts.delete(key);
        verdicts.set(key, { result, until: started + 30_000 });
        while (verdicts.size > 512) verdicts.delete(verdicts.keys().next().value!);
      }
      return result;
    })();
    pending.set(key, request);
    try {
      return await request;
    } finally {
      if (pending.get(key) === request) pending.delete(key);
    }
  }

  return {
    async checkArtistAuthority(requester: string): Promise<ArtistAuthorityResult> {
      const client = getServiceClient();
      const directory = getDirectoryAddress();
      if (!client || !directory) {
        return { allowed: false, code: 'RPC_UNAVAILABLE', reason: 'Artist verification is unavailable: chain RPC or directory is not configured.' };
      }

      try {
        const blocks = await observedBlocks(client);
        const artistAt = async (blockHash: `0x${string}`) => {
          const runtime = await client.readContract({
            address: directory,
            abi: artistDirectoryAbi,
            functionName: 'runtimeOf',
            args: [requester as Address],
            blockHash,
            requireCanonical: true
          });
          if (!runtime || sameAddress(runtime, ZERO_ADDRESS)) return null;
          const artist = await client.readContract({
            address: runtime,
            abi: runtimeArtistAbi,
            functionName: 'runtimeArtist',
            blockHash,
            requireCanonical: true
          });
          return { runtime, artist };
        };
        const settled = artistAt(blocks.finalized.hash);
        const current = blocks.finalized.hash.toLowerCase() === blocks.latest.hash.toLowerCase() ? settled : artistAt(blocks.latest.hash);
        const [finalized, latest] = await Promise.all([settled, current]);
        if (!finalized && !latest)
          return { allowed: false, code: 'ARTIST_RUNTIME_REQUIRED', reason: 'Create an artist runtime before uploading release assets.' };
        if (!finalized || !latest || !sameAddress(finalized.runtime, latest.runtime))
          return { allowed: false, code: 'RPC_UNAVAILABLE', reason: 'Your artist profile is still being confirmed. Please wait and retry.' };
        if (!sameAddress(finalized.artist, requester) || !sameAddress(latest.artist, requester))
          return {
            allowed: false,
            code: 'ARTIST_IDENTITY_MISMATCH',
            reason: 'This account does not match the runtime artist. Check your selected artist account.'
          };
        return { allowed: true, runtime: finalized.runtime };
      } catch {
        return { allowed: false, code: 'RPC_UNAVAILABLE', reason: 'Artist verification is unavailable. Please try again.' };
      }
    },

    checkTrackAccess(request: TrackAccessRequest): Promise<TrackAccessResult> {
      return checkRelease(request.contentHash, request.requester as Address, request.purpose, request.release);
    },
    checkPublicAccess(request: string | PublicTrackAccessRequest): Promise<TrackAccessResult> {
      return checkRelease(
        typeof request === 'string' ? request : request.contentHash,
        ZERO_ADDRESS,
        'public',
        typeof request === 'string' ? undefined : request.release
      );
    }
  };
}

const defaultChainAccessService = createChainAccessService();

/** Verify the bound artist in finalized/current state; upgrade ownership is a separate role. */
export async function checkArtistAuthority(requester: string): Promise<ArtistAuthorityResult> {
  return defaultChainAccessService.checkArtistAuthority(requester);
}

/** Check whether `requester` may receive the content key for `contentHash`. */
export async function checkTrackAccess(request: TrackAccessRequest): Promise<TrackAccessResult> {
  return defaultChainAccessService.checkTrackAccess(request);
}

/** Check whether `contentHash` is publicly listenable with no requester identity. */
export async function checkPublicAccess(request: string | PublicTrackAccessRequest): Promise<TrackAccessResult> {
  return defaultChainAccessService.checkPublicAccess(request);
}
