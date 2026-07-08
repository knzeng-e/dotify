// On-chain access checks for content-key delivery.
//
// The backend never trusts frontend-provided access booleans. For every key
// request it independently:
//   1. resolves which artist SmartRuntime registered the contentHash by
//      enumerating the ArtistDirectory;
//   2. calls musicAccCanAccess(contentHash, requester) on that runtime.
//
// Fail-closed rules (per CLAUDE.md and docs/backlog/03):
//   - RPC not configured or unreachable  -> denied (RPC_UNAVAILABLE)
//   - directory not configured            -> denied (RPC_UNAVAILABLE)
//   - contentHash registered nowhere      -> denied (TRACK_NOT_FOUND)
//   - contentHash registered in 2+ runtimes -> denied (AMBIGUOUS_RUNTIME)
//
// Trust note: musicAccCanAccess lives behind an artist-upgradeable diamond.
// An artist can change their own access policy at any time; that is artist
// sovereignty, not a backend guarantee. This service answers "does the
// artist's current policy allow this listener", nothing stronger.

import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import { config } from '../config.js';

const artistDirectoryAbi = [
  { type: 'function', name: 'artistCount', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  {
    type: 'function',
    name: 'artistsPage',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      { name: 'artists', type: 'address[]' },
      { name: 'runtimes', type: 'address[]' },
    ],
    stateMutability: 'view',
  },
] as const;

const musicRegistryAbi = [
  {
    type: 'function',
    name: 'musicRegIsRegistered',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

const musicAccessAbi = [
  {
    type: 'function',
    name: 'musicAccCanAccess',
    inputs: [
      { name: 'contentHash', type: 'bytes32' },
      { name: 'listener', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DIRECTORY_PAGE_SIZE = 50n;

export type AccessDenialCode =
  | 'RPC_UNAVAILABLE'
  | 'TRACK_NOT_FOUND'
  | 'AMBIGUOUS_RUNTIME'
  | 'LISTENER_ACCESS_REQUIRED'
  | 'HOST_ACCESS_REQUIRED'
  | 'NOT_FREE';

export type TrackAccessRequest = {
  contentHash: string;
  requester: string;
  purpose: 'individual' | 'room_host';
};

export type TrackAccessResult =
  | { allowed: true; runtime: Address }
  | { allowed: false; code: AccessDenialCode; reason: string };

let clientCache: PublicClient | null = null;

// contentHash registration is immutable per runtime, so positive lookups can
// be cached for the process lifetime. Negative lookups are never cached: a
// track can be registered at any moment.
const runtimeByContentHash = new Map<string, Address>();

function getClient(): PublicClient | null {
  if (!config.PASEO_ASSET_HUB_RPC) return null;
  if (!clientCache) {
    clientCache = createPublicClient({ transport: http(config.PASEO_ASSET_HUB_RPC) });
  }
  return clientCache;
}

async function listRuntimes(client: PublicClient, directory: Address): Promise<Address[]> {
  const total = (await client.readContract({
    address: directory,
    abi: artistDirectoryAbi,
    functionName: 'artistCount',
  })) as bigint;

  const runtimes: Address[] = [];
  for (let offset = 0n; offset < total; offset += DIRECTORY_PAGE_SIZE) {
    const limit = total - offset > DIRECTORY_PAGE_SIZE ? DIRECTORY_PAGE_SIZE : total - offset;
    const [, pageRuntimes] = (await client.readContract({
      address: directory,
      abi: artistDirectoryAbi,
      functionName: 'artistsPage',
      args: [offset, limit],
    })) as [Address[], Address[]];

    for (const runtime of pageRuntimes) {
      if (runtime && runtime !== ZERO_ADDRESS) runtimes.push(runtime);
    }
  }
  return runtimes;
}

async function findOwningRuntimes(client: PublicClient, contentHash: string): Promise<Address[]> {
  const directory = config.DOTIFY_DIRECTORY_ADDRESS as Address | undefined;
  if (!directory) throw new Error('DOTIFY_DIRECTORY_ADDRESS is not configured');

  const runtimes = await listRuntimes(client, directory);
  const flags = await Promise.all(
    runtimes.map(runtime =>
      client.readContract({
        address: runtime,
        abi: musicRegistryAbi,
        functionName: 'musicRegIsRegistered',
        args: [contentHash as `0x${string}`],
      }) as Promise<boolean>,
    ),
  );
  return runtimes.filter((_, index) => flags[index]);
}

/** Resolve the single SmartRuntime that registered `contentHash`, or null. */
async function resolveRuntime(client: PublicClient, contentHash: string): Promise<{ runtime: Address | null; ambiguous: boolean }> {
  const cacheKey = contentHash.toLowerCase();
  const cached = runtimeByContentHash.get(cacheKey);
  if (cached) return { runtime: cached, ambiguous: false };

  const owners = await findOwningRuntimes(client, contentHash);
  if (owners.length === 1) {
    runtimeByContentHash.set(cacheKey, owners[0]);
    return { runtime: owners[0], ambiguous: false };
  }
  return { runtime: null, ambiguous: owners.length > 1 };
}

/**
 * Check whether `requester` may receive the content key for `contentHash`.
 * Both purposes use the same on-chain policy; the purpose only changes the
 * denial code so the frontend can phrase the right CTA (listener unlock vs
 * host unlock).
 */
export async function checkTrackAccess(request: TrackAccessRequest): Promise<TrackAccessResult> {
  const client = getClient();
  if (!client || !config.DOTIFY_DIRECTORY_ADDRESS) {
    return { allowed: false, code: 'RPC_UNAVAILABLE', reason: 'Access checks are unavailable: chain RPC or directory is not configured.' };
  }

  try {
    const { runtime, ambiguous } = await resolveRuntime(client, request.contentHash);
    if (ambiguous) {
      return { allowed: false, code: 'AMBIGUOUS_RUNTIME', reason: 'Track is claimed by multiple runtimes; refusing to pick one.' };
    }
    if (!runtime) {
      return { allowed: false, code: 'TRACK_NOT_FOUND', reason: 'Track is not registered in any artist runtime.' };
    }

    const canAccess = (await client.readContract({
      address: runtime,
      abi: musicAccessAbi,
      functionName: 'musicAccCanAccess',
      args: [request.contentHash as `0x${string}`, request.requester as Address],
    })) as boolean;

    if (!canAccess) {
      return request.purpose === 'room_host'
        ? { allowed: false, code: 'HOST_ACCESS_REQUIRED', reason: 'The room host does not satisfy this track\'s access policy.' }
        : { allowed: false, code: 'LISTENER_ACCESS_REQUIRED', reason: 'This listener does not satisfy this track\'s access policy.' };
    }

    return { allowed: true, runtime };
  } catch {
    return { allowed: false, code: 'RPC_UNAVAILABLE', reason: 'Access checks are unavailable: chain RPC request failed.' };
  }
}

/**
 * Check whether `contentHash` is publicly listenable (access mode Free), with
 * no requester identity at all.
 *
 * Probe: musicAccCanAccess(contentHash, address(0)). The zero address is never
 * the artist, never the NFT owner, never paid, never personhood-verified - so
 * the call returns true if and only if the track's current mode grants access
 * to everyone (Free). Same fail-closed rules as checkTrackAccess.
 */
export async function checkPublicAccess(contentHash: string): Promise<TrackAccessResult> {
  const client = getClient();
  if (!client || !config.DOTIFY_DIRECTORY_ADDRESS) {
    return { allowed: false, code: 'RPC_UNAVAILABLE', reason: 'Access checks are unavailable: chain RPC or directory is not configured.' };
  }

  try {
    const { runtime, ambiguous } = await resolveRuntime(client, contentHash);
    if (ambiguous) {
      return { allowed: false, code: 'AMBIGUOUS_RUNTIME', reason: 'Track is claimed by multiple runtimes; refusing to pick one.' };
    }
    if (!runtime) {
      return { allowed: false, code: 'TRACK_NOT_FOUND', reason: 'Track is not registered in any artist runtime.' };
    }

    const publiclyListenable = (await client.readContract({
      address: runtime,
      abi: musicAccessAbi,
      functionName: 'musicAccCanAccess',
      args: [contentHash as `0x${string}`, ZERO_ADDRESS as Address],
    })) as boolean;

    if (!publiclyListenable) {
      return { allowed: false, code: 'NOT_FREE', reason: 'This track is not free; its access policy requires payment or verification.' };
    }

    return { allowed: true, runtime };
  } catch {
    return { allowed: false, code: 'RPC_UNAVAILABLE', reason: 'Access checks are unavailable: chain RPC request failed.' };
  }
}
