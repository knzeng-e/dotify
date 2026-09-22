const configuredBlockscoutBaseUrl = import.meta.env.VITE_BLOCKSCOUT_BASE_URL;

export const blockscoutBaseUrl = (configuredBlockscoutBaseUrl || 'https://blockscout-testnet.polkadot.io').replace(/\/$/, '');
export const paseoAssetHubSubscanBaseUrl = 'https://assethub-paseo.subscan.io';

export function getBlockscoutAddressUrl(address: `0x${string}`) {
  return `${blockscoutBaseUrl}/address/${address}`;
}

export function getBlockscoutTxUrl(txHash: `0x${string}`) {
  return `${blockscoutBaseUrl}/tx/${txHash}`;
}

export function getSubscanExtrinsicUrl(txHash: `0x${string}`) {
  return `${paseoAssetHubSubscanBaseUrl}/extrinsic/${txHash}`;
}

export function getTransactionProofUrl(txHash: `0x${string}`, proofKind: 'evm-transaction' | 'substrate-extrinsic' = 'evm-transaction') {
  return proofKind === 'substrate-extrinsic' ? getSubscanExtrinsicUrl(txHash) : getBlockscoutTxUrl(txHash);
}

export function getBlockscoutBlockUrl(blockNumber: bigint | number) {
  return `${blockscoutBaseUrl}/block/${blockNumber.toString()}`;
}
