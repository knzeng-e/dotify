const configuredBlockscoutBaseUrl = import.meta.env.VITE_BLOCKSCOUT_BASE_URL;

export const blockscoutBaseUrl = (configuredBlockscoutBaseUrl || 'https://blockscout-testnet.polkadot.io').replace(/\/$/, '');

export function getBlockscoutAddressUrl(address: `0x${string}`) {
  return `${blockscoutBaseUrl}/address/${address}`;
}

export function getBlockscoutTxUrl(txHash: `0x${string}`) {
  return `${blockscoutBaseUrl}/tx/${txHash}`;
}

export function getBlockscoutBlockUrl(blockNumber: bigint | number) {
  return `${blockscoutBaseUrl}/block/${blockNumber.toString()}`;
}
