import { config } from '../config.js';

export type ChainDomainCheck = { ok: true } | { ok: false; code: 'CHAIN_ID_MISMATCH'; reason: string };

/** Keep every authentication credential bound to the configured Dotify chain. */
export function checkDotifyChainId(chainId: number): ChainDomainCheck {
  if (chainId === config.DOTIFY_CHAIN_ID) return { ok: true };
  return {
    ok: false,
    code: 'CHAIN_ID_MISMATCH',
    reason: `This request targets the wrong network (chain ID ${chainId}). Switch to the Dotify network (chain ID ${config.DOTIFY_CHAIN_ID}) and try again.`
  };
}
