/**
 * Dotify — Smart Runtime contract ABIs and viem client helpers.
 *
 * Architecture change: each artist owns a personal SmartRuntime.
 * The ArtistRuntimeFactory deploys one SmartRuntime per artist;
 * the ArtistDirectory indexes artist address → runtime address.
 *
 * Contract interaction pattern:
 *
 *   // 1. Look up (or create) the artist's runtime
 *   const runtime = await directory.runtimeOf(artistAddress)   // read
 *   if (runtime === ZERO_ADDR) await factory.createRuntime()   // write (once)
 *
 *   // 2. Call music pallets on the runtime address
 *   await walletClient.writeContract({ address: runtime, abi: musicRegistryAbi, functionName: 'musicRegRegister', ... })
 *   await walletClient.writeContract({ address: runtime, abi: musicRoyaltiesAbi, functionName: 'musicRoyPayAccess', ... })
 *   await publicClient.readContract({ address: runtime, abi: musicAccessAbi, functionName: 'musicAccCanAccess', ... })
 */

import { createPublicClient, createWalletClient, defineChain, http, type Address, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ─────────────────────────────────────────────────────────────────────────────
// ArtistDirectory ABI
// ─────────────────────────────────────────────────────────────────────────────

export const artistDirectoryAbi = [
  { type: 'function', name: 'runtimeOf', inputs: [{ name: 'artist', type: 'address' }], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'artistCount', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'artistAtIndex', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
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
  },
  { type: 'function', name: 'factory', inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  {
    type: 'event',
    name: 'ArtistRegistered',
    inputs: [
      { name: 'artist', type: 'address', indexed: true },
      { name: 'runtime', type: 'address', indexed: true }
    ]
  }
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ArtistRuntimeFactory ABI
// ─────────────────────────────────────────────────────────────────────────────

export const artistRuntimeFactoryAbi = [
  { type: 'function', name: 'createRuntime', inputs: [], outputs: [{ name: 'runtime', type: 'address' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'runtimeOf', inputs: [{ name: 'artist', type: 'address' }], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'directory', inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  {
    type: 'event',
    name: 'ArtistRuntimeCreated',
    inputs: [
      { name: 'artist', type: 'address', indexed: true },
      { name: 'runtime', type: 'address', indexed: true }
    ]
  }
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// MusicRegistryPallet ABI  (called on each artist's SmartRuntime)
// ─────────────────────────────────────────────────────────────────────────────

export const musicRegistryAbi = [
  {
    type: 'function',
    name: 'musicRegRegister',
    inputs: [
      {
        name: 'reg',
        type: 'tuple',
        components: [
          { name: 'contentHash', type: 'bytes32' },
          { name: 'title', type: 'string' },
          { name: 'artistName', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'imageRef', type: 'string' },
          { name: 'audioRef', type: 'string' },
          { name: 'metadataRef', type: 'string' },
          { name: 'artistContractRef', type: 'string' },
          { name: 'accessMode', type: 'uint8' },
          { name: 'pricePlanck', type: 'uint128' },
          { name: 'requiredPersonhood', type: 'uint8' }
        ]
      },
      { name: 'recipients', type: 'address[]' },
      { name: 'bps', type: 'uint16[]' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'musicRegDeactivate',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable'
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
  },
  {
    type: 'function',
    name: 'musicRegIsRegistered',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'musicRegIsActive',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  { type: 'function', name: 'musicRegTrackCount', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  {
    type: 'function',
    name: 'musicRegTrackHashAtIndex',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'TrackRegistered',
    inputs: [
      { name: 'contentHash', type: 'bytes32', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'artist', type: 'address', indexed: true },
      { name: 'title', type: 'string', indexed: false },
      { name: 'accessMode', type: 'uint8', indexed: false },
      { name: 'pricePlanck', type: 'uint128', indexed: false },
      { name: 'requiredPersonhood', type: 'uint8', indexed: false }
    ]
  }
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// MusicRoyaltiesPallet ABI
// ─────────────────────────────────────────────────────────────────────────────

export const musicRoyaltiesAbi = [
  { type: 'function', name: 'musicRoyPayAccess', inputs: [{ name: 'contentHash', type: 'bytes32' }], outputs: [], stateMutability: 'payable' },
  { type: 'function', name: 'musicRoyRecordListen', inputs: [{ name: 'contentHash', type: 'bytes32' }], outputs: [], stateMutability: 'nonpayable' },
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
  },
  {
    type: 'function',
    name: 'musicRoyTotalBps',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint16' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'MusicRoyAccessPaid',
    inputs: [
      { name: 'contentHash', type: 'bytes32', indexed: true },
      { name: 'listener', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false }
    ]
  }
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// MusicAccessPallet ABI
// ─────────────────────────────────────────────────────────────────────────────

export const musicAccessAbi = [
  { type: 'function', name: 'musicAccSetRegistrar', inputs: [{ name: 'registrar', type: 'address' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'musicAccRotateRegistrar', inputs: [{ name: 'next', type: 'address' }], outputs: [], stateMutability: 'nonpayable' },
  {
    type: 'function',
    name: 'musicAccSetPersonhoodLevel',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'level', type: 'uint8' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'musicAccCanAccess',
    inputs: [
      { name: 'contentHash', type: 'bytes32' },
      { name: 'listener', type: 'address' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'musicAccHasPaid',
    inputs: [
      { name: 'contentHash', type: 'bytes32' },
      { name: 'listener', type: 'address' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'musicAccPersonhoodLevel',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'musicAccHasPersonhood',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'required', type: 'uint8' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  { type: 'function', name: 'musicAccGetRegistrar', inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' }
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// MusicNFTPallet ABI
// ─────────────────────────────────────────────────────────────────────────────

export const musicNFTAbi = [
  {
    type: 'function',
    name: 'musicNFTTransfer',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'to', type: 'address' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'musicNFTApprove',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'musicNFTSetApprovalForAll',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'musicNFTOwnerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'musicNFTBalanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'musicNFTGetApproved',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'musicNFTIsApprovedForAll',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  }
] as const;

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

async function resolveChain(ethRpcUrl: string): Promise<Chain> {
  if (!chainCache) {
    const chainId = await getPublicClient(ethRpcUrl).getChainId();
    chainCache = defineChain({
      id: chainId,
      name: ethRpcUrl.includes('localhost') ? 'Local Polkadot Devnet' : 'Polkadot Hub TestNet',
      nativeCurrency: { name: 'Unit', symbol: 'UNIT', decimals: 18 },
      rpcUrls: { default: { http: [ethRpcUrl] } }
    });
  }
  return chainCache;
}
