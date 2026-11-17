// Short finalized-state reads and a signed store have different lifetimes.
// A store must allow inclusion + finality + receipt readback. All remain bounded
// by caller cancellation and an explicit overall publication cap.
export const BULLETIN_RPC_READ_MS = 25_000;
export const BULLETIN_CUSTODY_READ_MS = 30_000;
export const BULLETIN_FINALITY_MS = 90_000;
export const BULLETIN_STORE_MS = 120_000;

// The synthetic pilot retains its cap. Complete artist graphs require many
// finalized waves; the opt-in multi-release publisher owns the longer deadline.
export const BULLETIN_PUBLICATION_MS = 2 * 60 * 60_000;
export type BulletinPublicationProgress = { storedBlocks: number; totalBlocks: number };
