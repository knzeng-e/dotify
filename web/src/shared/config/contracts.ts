/**
 * Dotify — Smart Runtime contract ABIs and viem client helpers.
 *
 * Architecture change: each artist owns a personal SmartRuntime.
 * The ArtistRuntimeFactory bootstraps one SmartRuntime per artist;
 * the ArtistDirectory indexes only finalized artist address → runtime address.
 *
 * Contract interaction pattern:
 *
 *   // 1. Look up (or bootstrap) the artist's runtime
 *   const runtime = await directory.runtimeOf(artistAddress)   // read
 *   if (runtime === ZERO_ADDR) {
 *     await factory.createRuntime()       // write: create shell
 *     await factory.installRuntimeStep()  // write repeatedly until pendingRuntimeOf == ZERO_ADDR
 *   }
 *
 *   // 2. Call music pallets on the runtime address
 *   await walletClient.writeContract({ address: runtime, abi: musicRegistryAbi, functionName: 'musicRegRegister', ... })
 *   await walletClient.writeContract({ address: runtime, abi: musicRoyaltiesAbi, functionName: 'musicRoyPayAccess', ... })
 *   await publicClient.readContract({ address: runtime, abi: musicAccessAbi, functionName: 'musicAccCanAccess', ... })
 */

import { createPublicClient, createWalletClient, defineChain, http, type Address, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { blockscoutBaseUrl } from '../utils/explorer';

// Contract ABIs are generated from the Hardhat artifacts (run "npm run
// generate:abis" in contracts/evm) and re-exported here so callers keep
// importing them from one module. Do not hand-edit the files under src/generated.
export { artistDirectoryAbi, artistRuntimeFactoryAbi, musicRegistryAbi, musicRoyaltiesAbi, musicAccessAbi, musicNFTAbi } from '../../generated/contracts';

// ─────────────────────────────────────────────────────────────────────────────
// Dev accounts (local testing only — well-known Substrate keys)
// ─────────────────────────────────────────────────────────────────────────────

export const evmDevAccounts = [
  { name: 'Alice', account: privateKeyToAccount('0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133') },
  { name: 'Bob', account: privateKeyToAccount('0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b') }
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// viem client helpers
// ─────────────────────────────────────────────────────────────────────────────

let publicClientCache: ReturnType<typeof createPublicClient> | null = null;
let chainCache: Chain | null = null;
let rpcCache = '';

export function getPublicClient(ethRpcUrl: string) {
  if (!publicClientCache || rpcCache !== ethRpcUrl) {
    publicClientCache = createPublicClient({ transport: http(ethRpcUrl) });
    rpcCache = ethRpcUrl;
    chainCache = null;
  }
  return publicClientCache;
}

export async function getWalletClient(accountIndex: number, ethRpcUrl: string) {
  const chain = await resolveChain(ethRpcUrl);
  return createWalletClient({
    account: evmDevAccounts[accountIndex as 0 | 1].account,
    chain,
    transport: http(ethRpcUrl)
  });
}

export async function ensureContract(address: Address, ethRpcUrl: string) {
  const code = await getPublicClient(ethRpcUrl).getCode({ address });
  return Boolean(code && code !== '0x');
}

export async function resolveEvmChain(ethRpcUrl: string): Promise<Chain> {
  return resolveChain(ethRpcUrl);
}

async function resolveChain(ethRpcUrl: string): Promise<Chain> {
  if (!chainCache) {
    const chainId = await getPublicClient(ethRpcUrl).getChainId();
    const isLocalChain = ethRpcUrl.includes('localhost') || ethRpcUrl.includes('127.0.0.1');
    chainCache = defineChain({
      id: chainId,
      name: isLocalChain ? 'Local Polkadot Devnet' : 'Polkadot Hub TestNet',
      nativeCurrency: { name: 'Unit', symbol: 'UNIT', decimals: 18 },
      rpcUrls: { default: { http: [ethRpcUrl] } },
      ...(isLocalChain ? {} : { blockExplorers: { default: { name: 'Blockscout', url: blockscoutBaseUrl } } })
    });
  }
  return chainCache;
}
