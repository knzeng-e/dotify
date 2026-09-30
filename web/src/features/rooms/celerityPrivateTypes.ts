export type RealtimePeer = { id: string; role: 'host' | 'listener'; publicKey: string };
export type RealtimeRoster = { scope: string; revision: number; peers: RealtimePeer[] };
export type RealtimeRegistration = { ok: true; self: string; roster: RealtimeRoster } | { ok: false; error: string };
