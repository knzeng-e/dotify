// Short finalized-state reads and a signed store have different lifetimes.
// A store must allow inclusion + finality + receipt readback. All remain bounded
// by the caller's cancellation signal and the publication's five-minute cap.
export const BULLETIN_RPC_READ_MS = 25_000;
export const BULLETIN_CUSTODY_READ_MS = 30_000;
export const BULLETIN_FINALITY_MS = 90_000;
export const BULLETIN_STORE_MS = 120_000;
