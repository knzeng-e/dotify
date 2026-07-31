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

export type BeaconClient = {
  publish: (data: unknown, options: { channel: string; topic2: string; ttlSeconds: number }) => Promise<{ ok: boolean }>;
  subscribe: (callback: (statement: { data: unknown }) => void, options?: { topic2?: string }) => { unsubscribe: () => void };
  destroy: () => void;
};

export type BeaconDeps = {
  createClient: () => Promise<BeaconClient>;
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

export type RoomBeaconPublisher = {
  /** Publish or refresh the beacon for one room. Resolves false when it did not land. */
  announce: (input: RoomBeaconInput) => Promise<boolean>;
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
      if (stopped) return false;

      const beacon = buildRoomBeacon(input);
      if (!beacon) return false;

      // Check the account budget against what would be live *after* this write,
      // not what is live now, so the overflowing beacon is the one refused.
      const next = new Map(live);
      next.set(beacon.room, beacon);
      const budget = assertBeaconBudget([...next.values()]);
      if (!budget.ok) return false;

      try {
        const result = await client.publish(beacon, {
          channel: roomBeaconChannel(beacon.room),
          topic2: roomBeaconTopic(beacon.room),
          ttlSeconds: BEACON_TTL_SECONDS
        });
        if (!result.ok) return false;
        live.set(beacon.room, beacon);
        return true;
      } catch {
        return false;
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

  const seen = new Map<string, RoomBeacon>();

  const subscription = client.subscribe(
    statement => {
      const beacon = parseRoomBeacon(statement.data);
      if (!beacon) return;
      if (options.roomCode && beacon.room !== options.roomCode.toUpperCase()) return;
      seen.set(beacon.room, beacon);
      options.onChange?.([...seen.values()]);
    },
    options.roomCode ? { topic2: roomBeaconTopic(options.roomCode) } : undefined
  );

  return {
    beacons: () => [...seen.values()],
    stop() {
      try {
        subscription.unsubscribe();
        client.destroy();
      } catch {
        // Already gone.
      }
    }
  };
}
