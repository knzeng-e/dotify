// Wallet network - pure EIP-1193 chain helpers and the chain-mismatch message.
//
// Extracted from useWallet (chain-id parsing / provider error codes) and
// de-duplicated from App.tsx + useArtistConsole (the mismatch message) so the
// network plumbing is testable without a wallet provider.

/** Parse an EIP-1193 chain id (number, decimal string, or 0x-hex) to a number. */
export function parseChainId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = value.startsWith('0x') ? Number.parseInt(value, 16) : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Encode a numeric chain id as the 0x-hex form EIP-1193 expects. */
export function toEip155ChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

/** Best-effort extraction of a provider error code (number or numeric string). */
export function getProviderErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'number') return code;
  if (typeof code === 'string') return Number.parseInt(code, 10);
  return undefined;
}

/**
 * User-facing message when the connected wallet is on the wrong network.
 * Matches the wording used before signing in App.tsx and useArtistConsole.
 */
export function chainMismatchMessage(expectedChainId: number, currentChainId: number | undefined): string {
  return `Switch your wallet to chain ${expectedChainId}. Your wallet is currently on chain ${currentChainId}.`;
}
