import { createPublicClient, createWalletClient, defineChain, http, type Address, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const musicRightsAbi = [
  {
    type: 'function',
    name: 'registerTrack',
    inputs: [
      {
        name: 'registration',
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
    name: 'deactivateTrack',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'transferTrack',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'to', type: 'address' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'payForAccess',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'recordHumanFreeListen',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'setPersonhoodLevel',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'level', type: 'uint8' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'canAccess',
    inputs: [
      { name: 'contentHash', type: 'bytes32' },
      { name: 'listener', type: 'address' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getTrack',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [
      {
        name: 'track',
        type: 'tuple',
        components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'artist', type: 'address' },
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
          { name: 'registeredAtBlock', type: 'uint256' },
          { name: 'active', type: 'bool' }
        ]
      },
      { name: 'tokenOwner', type: 'address' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getRoyaltySplitCount',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getRoyaltySplitAt',
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
    name: 'getTrackCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getTrackHashAtIndex',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view'
  }
] as const;

export const evmDevAccounts = [
  {
    name: 'Alice',
    account: privateKeyToAccount('0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133')
  },
  {
    name: 'Bob',
    account: privateKeyToAccount('0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b')
  }
];

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
    account: evmDevAccounts[accountIndex].account,
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
