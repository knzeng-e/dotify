import { parseEther } from 'viem';

export const MAX_REGISTRY_PRICE = (1n << 128n) - 1n;

/** parseEther rounds excess decimal places; publication must never round. */
export function parseExactEvmAmount(input: string): bigint {
  const text = input.trim() || '0';
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || (text.split('.')[1]?.length ?? 0) > 18) {
    throw new Error('Enter a non-negative decimal amount with at most 18 decimal places.');
  }
  return parseEther(text);
}

export function assertClassicPrice(accessMode: number, price: bigint, nativeDecimals: number): void {
  if (!Number.isInteger(nativeDecimals) || nativeDecimals < 0 || nativeDecimals > 18) {
    throw new Error('The artist space payment precision is unavailable or unsupported. Refresh its configuration before publishing or paying.');
  }
  if (accessMode !== 1) return;
  if (price <= 0n || price > MAX_REGISTRY_PRICE) throw new Error('The listening price must be positive and within the supported amount limit.');
  const quantum = 10n ** BigInt(18 - nativeDecimals);
  if (price % quantum !== 0n) {
    throw new Error(`This price cannot be paid exactly on this network. Use at most ${nativeDecimals} decimal places. No transaction was submitted.`);
  }
}
