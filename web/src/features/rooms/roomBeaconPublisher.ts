// Publishes and reads room beacons over the Statement Store.
//
// Scope, deliberately narrow:
//
//   - only a host publishes, and only for rooms it is hosting;
//   - a beacon is discovery, never a join path - the share link stays the way in,
//     with no wallet, no account, and no chain;
//   - a failure here is silent by design. Discovery is an enhancement, so a
//     statement store that is unreachable must degrade to "no beacons" and never
//     interrupt hosting a room.
//
// Two constraints from the SDK shape everything below.
//
// The client "is designed to run exclusively inside a host container", so this
// path only works inside the Polkadot Product host. Standalone builds keep
// Socket.IO discovery and lose nothing they had.
//
// Host mode signs through the product's allowance account via the RFC-10
// sponsored path, so the listener does not need an Individuality allowance of
// their own. That is what keeps hosting from becoming an identity gate.
//
// The client tree is loaded lazily and behind a build-time flag so a build that
// did not opt in never carries it. Same discipline as the Product contract
// adapter, for the same reason: unused chain code is not free, it is published
// weight against a finite Bulletin quota.

import { assertBeaconBudget, buildRoomBeacon, parseRoomBeacon, roomBeaconChannel, roomBeaconTopic, type RoomBeacon, type RoomBeaconInput } from './roomBeacon';

/** Application namespace, hashed into topic1. Scopes Dotify traffic. */
const BEACON_APP_NAME = 'dotify-rooms';

/**
 * Republish interval. The statement TTL is a chain-side expiry, so a beacon has
 * to be refreshed to stay live; refreshing well inside the TTL means one missed
 * beat does not drop a room from discovery.
 */
export const BEACON_TTL_SECONDS = 90;
export const BEACON_REFRESH_MS = 30_000;

const BEACONS_ENABLED = import.meta.env.VITE_DOTIFY_ROOM_BEACONS === 'on';

/**
 * A received statement, keeping the metadata the reader needs.
 *
 * `expiry` is carried deliberately. The Statement Store drops an expired record
 * on its side but sends no deletion event, so a subscriber that discards this
 * would show a room forever after its host stopped. It packs a timestamp in the
 * upper 32 bits and a sequence number in the lower 32.
 */
export type BeaconStatement = { data: unknown; expiry?: bigint };

export type BeaconClient = {
  publish: (data: unknown, options: { channel: string; topic2: string; ttlSeconds: number }) => Promise<{ ok: boolean }>;
  subscribe: (callback: (statement: BeaconStatement) => void, options?: { topic2?: string }) => { unsubscribe: () => void };
  destroy: () => void;
};

/** Seconds since epoch encoded in a statement expiry, or null when absent. */
export function beaconExpirySeconds(expiry: bigint | undefined): number | null {
  if (typeof expiry !== 'bigint') return null;
  const seconds = Number(expiry >> 32n);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export type BeaconDeps = {
  createClient: () => Promise<BeaconClient>;
  /** Injectable clock, so expiry behaviour can be tested without real time. */
  now?: () => number;
};

async function createSdkClient(): Promise<BeaconClient> {
  const { StatementStoreClient } = await import('@parity/product-sdk-statement-store');
  const client = new StatementStoreClient({ appName: BEACON_APP_NAME, defaultTtlSeconds: BEACON_TTL_SECONDS });

  // Host mode only. Local mode would need an Sr25519 signer and an allowance,
  // which is precisely the identity gate this feature must not introduce.
  await client.connect({ mode: 'host' });

  return {
    publish: async (data, options) => {
      const result = await client.publish(data, options);
      return { ok: result.ok };
    },
    subscribe: (callback, options) => client.subscribe(callback as never, options),
    destroy: () => client.destroy()
  };
}

const defaultDeps: BeaconDeps = { createClient: createSdkClient };

/** Why an announce did not land. `quota-local` is this instance only; see below. */
export type AnnounceOutcome = { ok: true } | { ok: false; reason: 'unbuildable' | 'stopped' | 'quota-local' | 'rejected' | 'transport'; detail: string };

export type RoomBeaconPublisher = {
  /** Publish or refresh the beacon for one room. */
  announce: (input: RoomBeaconInput) => Promise<AnnounceOutcome>;
  /** Stop announcing and release the connection. */
  stop: () => void;
};

/**
 * Start publishing beacons.
 *
 * Returns null when beacons are disabled at build time or the host is
 * unavailable, so callers can treat discovery as simply absent rather than
 * branching on an error.
 */
export async function createRoomBeaconPublisher(deps: BeaconDeps = defaultDeps): Promise<RoomBeaconPublisher | null> {
  if (!BEACONS_ENABLED) return null;

  let client: BeaconClient;
  try {
    client = await deps.createClient();
  } catch {
    // No host container, no allowance, no transport: hosting still works.
    return null;
  }

  const live = new Map<string, RoomBeacon>();
  let stopped = false;

  return {
    async announce(input) {
      if (stopped) return { ok: false, reason: 'stopped', detail: 'publisher already stopped' };

      const beacon = buildRoomBeacon(input);
      if (!beacon) return { ok: false, reason: 'unbuildable', detail: `room code "${input.roomCode}" is not announceable` };

      // A per-instance guard, not an account-wide preflight.
      //
      // `live` only knows about writes this publisher made. It cannot see another
      // tab, another Dotify instance, or any other use of the same allowance
      // account, so the real account-wide total can be higher than this and a
      // write can still be rejected by the chain. Keeping the check is still
      // worthwhile - it catches the one case this instance can cause - but the
      // authoritative answer is the network's, which is why `rejected` below is
      // reported separately rather than folded into this branch.
      const next = new Map(live);
      next.set(beacon.room, beacon);
      const budget = assertBeaconBudget([...next.values()]);
      if (!budget.ok) {
        return { ok: false, reason: 'quota-local', detail: budget.reason };
      }

      try {
        const result = await client.publish(beacon, {
          channel: roomBeaconChannel(beacon.room),
          topic2: roomBeaconTopic(beacon.room),
          ttlSeconds: BEACON_TTL_SECONDS
        });
        if (!result.ok) {
          // Most likely the account-wide quota this instance cannot observe.
          return {
            ok: false,
            reason: 'rejected',
            detail: `the statement store rejected the beacon for ${beacon.room}, commonly an account-wide quota this client cannot see`
          };
        }
        live.set(beacon.room, beacon);
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: 'transport', detail: error instanceof Error ? error.message : String(error) };
      }
    },

    stop() {
      stopped = true;
      live.clear();
      try {
        client.destroy();
      } catch {
        // Already gone; nothing to release.
      }
    }
  };
}

export type RoomBeaconListener = {
  beacons: () => RoomBeacon[];
  stop: () => void;
};

/**
 * How often expired beacons are swept.
 *
 * A beacon whose host stopped simply goes quiet; nothing tells the subscriber.
 * Sweeping is therefore the only way a discovery list stops showing dead rooms.
 */
export const BEACON_SWEEP_MS = 15_000;

/**
 * Fallback lifetime for a beacon that arrives with no usable expiry.
 *
 * Without this a transport that omits the field would reintroduce the
 * never-evicted behaviour. Slightly longer than the publish TTL so a live room
 * is not swept between refreshes.
 */
const ASSUMED_LIFETIME_MS = (BEACON_TTL_SECONDS + 30) * 1000;

/**
 * Subscribe to beacons, optionally for a single room.
 *
 * Everything received is untrusted and re-parsed; a malformed beacon is dropped
 * rather than allowed to break the list.
 */
export async function subscribeRoomBeacons(
  options: { roomCode?: string; onChange?: (beacons: RoomBeacon[]) => void } = {},
  deps: BeaconDeps = defaultDeps
): Promise<RoomBeaconListener | null> {
  if (!BEACONS_ENABLED) return null;

  let client: BeaconClient;
  try {
    client = await deps.createClient();
  } catch {
    return null;
  }

  const seen = new Map<string, { beacon: RoomBeacon; expiresAtMs: number }>();
  const now = () => (deps.now ?? Date.now)();

  function live(): RoomBeacon[] {
    const current = now();
    return [...seen.values()].filter(entry => entry.expiresAtMs > current).map(entry => entry.beacon);
  }

  /** Drop expired entries, and report only when the visible set actually changed. */
  function sweep(): void {
    const current = now();
    let removed = false;
    for (const [room, entry] of seen) {
      if (entry.expiresAtMs <= current) {
        seen.delete(room);
        removed = true;
      }
    }
    if (removed) options.onChange?.(live());
  }

  const subscription = client.subscribe(
    statement => {
      const beacon = parseRoomBeacon(statement.data);
      if (!beacon) return;
      if (options.roomCode && beacon.room !== options.roomCode.toUpperCase()) return;

      const expirySeconds = beaconExpirySeconds(statement.expiry);
      const expiresAtMs = expirySeconds !== null ? expirySeconds * 1000 : now() + ASSUMED_LIFETIME_MS;

      // An already-expired statement is ignored rather than shown then swept.
      if (expiresAtMs <= now()) return;

      seen.set(beacon.room, { beacon, expiresAtMs });
      options.onChange?.(live());
    },
    options.roomCode ? { topic2: roomBeaconTopic(options.roomCode) } : undefined
  );

  const sweeper = setInterval(sweep, BEACON_SWEEP_MS);

  return {
    beacons: live,
    stop() {
      clearInterval(sweeper);
      try {
        subscription.unsubscribe();
        client.destroy();
      } catch {
        // Already gone.
      }
    }
  };
}

export type BeaconLoopDeps = {
  createPublisher?: () => Promise<RoomBeaconPublisher | null>;
  setInterval?: (handler: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearInterval?: (handle: ReturnType<typeof setInterval>) => void;
  onOutcome?: (outcome: AnnounceOutcome) => void;
};

/**
 * Announce a room until stopped, refreshing before the statement expires.
 *
 * Extracted from the React hook so the lifecycle - start, refresh, cancellation,
 * and the race where a caller stops before the publisher finishes connecting -
 * is testable as plain logic, without a DOM or a renderer.
 *
 * `readInput` is called per announce rather than captured once, so a changing
 * listener count reaches the next beacon without restarting the connection.
 */
export function startRoomBeaconLoop(readInput: () => RoomBeaconInput | null, deps: BeaconLoopDeps = {}): () => void {
  const create = deps.createPublisher ?? (() => createRoomBeaconPublisher());
  const schedule = deps.setInterval ?? ((handler, ms) => setInterval(handler, ms));
  const unschedule = deps.clearInterval ?? (handle => clearInterval(handle));

  let cancelled = false;
  let publisher: RoomBeaconPublisher | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  async function announce(): Promise<void> {
    const input = readInput();
    if (!publisher || cancelled || !input) return;
    const outcome = await publisher.announce(input);
    if (!outcome.ok) deps.onOutcome?.(outcome);
  }

  void (async () => {
    const created = await create();
    // A caller that stopped while we were connecting must not leave a live
    // publisher behind; this is the window where a room closes during connect.
    if (cancelled) {
      created?.stop();
      return;
    }
    publisher = created;
    if (!publisher) return;

    await announce();
    if (cancelled) return;
    timer = schedule(() => void announce(), BEACON_REFRESH_MS);
  })();

  return () => {
    cancelled = true;
    if (timer !== undefined) unschedule(timer);
    publisher?.stop();
    publisher = null;
  };
}
