// Maintenance/admitted-repair check only. No catalog absence or RPC error is
// evidence that a runtime release has not been registered.
import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import { artistDirectoryLookupAbi as directoryAbi } from '../generated/artistDirectoryLookup.js';
import { musicRegistryStatusAbi as registryAbi } from '../generated/musicRegistryStatus.js';
import { config } from '../config.js';
import type { PublicAssetPolicy } from './bulletinPublicAssets.js';
type Release = { owner: string; scope: Pick<PublicAssetPolicy['scope'], 'chainId' | 'runtimeAddress' | 'contentHash'> };
type Client = Pick<PublicClient, 'getChainId' | 'getBlock' | 'readContract'>;
export async function verifyUnregisteredRelease(client: Client, directory: Address, policy: Release): Promise<boolean> {
  try {
    if ((await client.getChainId()) !== policy.scope.chainId) return false;
    // Refuse both finalized registrations and a just-included registration
    // that has not reached finality yet. Every pair uses its own pinned hash.
    for (const blockTag of ['finalized', 'latest'] as const) {
      const head = await client.getBlock({ blockTag });
      if (!head.hash) return false;
      const [runtime, registered] = await Promise.all([
        client.readContract({
          address: directory,
          abi: directoryAbi,
          functionName: 'runtimeOf',
          args: [policy.owner as Address],
          blockHash: head.hash,
          requireCanonical: true
        }),
        client.readContract({
          address: policy.scope.runtimeAddress as Address,
          abi: registryAbi,
          functionName: 'musicRegIsRegistered',
          args: [policy.scope.contentHash as `0x${string}`],
          blockHash: head.hash,
          requireCanonical: true
        })
      ]);
      if (runtime.toLowerCase() !== policy.scope.runtimeAddress || registered !== false) return false;
    }
    return true;
  } catch {
    return false;
  }
}
export async function checkUnregisteredRelease(policy: Release): Promise<boolean> {
  if (!config.PASEO_ASSET_HUB_RPC || !config.DOTIFY_DIRECTORY_ADDRESS || policy.scope.chainId !== config.DOTIFY_CHAIN_ID) return false;
  const client = createPublicClient({ transport: http(config.PASEO_ASSET_HUB_RPC, { timeout: 4000, retryCount: 1 }) });
  return verifyUnregisteredRelease(client, config.DOTIFY_DIRECTORY_ADDRESS as Address, policy);
}
