# Product room discovery evidence — 2026-09-22

## Delivery identity

- Branch: `feat/product-room-discovery`
- Reviewed base: `dev` at `7dcd72954c0f6a24b742282aa7c8d8098cf43a05`
- Scope: complete the dormant Statement Store beacon loop by reading recent
  host announcements into Dotify's existing room discovery surfaces.
- Backlog: Product SDK epic #85.

## Behavior and boundaries

- An opt-in Product build subscribes to Statement Store room beacons and shows
  them beside rooms discovered through the signaling service.
- The same room code is shown once. Socket.IO wins a duplicate because it is
  authoritative for capacity, playback state, and joining.
- Beacon-only records are marked in the application model as Statement Store
  discovery. They contain no audio URL, protected reference, listener identity,
  wallet, chat, SDP, ICE, or durable history.
- Room joining remains the ordinary Socket.IO/WebRTC path. A recent beacon is
  evidence of an announcement, not evidence that the media connection works.
- Expiry and malformed-record rejection remain owned by the existing bounded
  Statement Store subscriber.

## Validation

| Check | Result |
| --- | --- |
| Full frontend unit suite | 599 passed, including 26 focused beacon publisher/discovery tests |
| Playwright browser suite | 118 passed, including room discovery, join, sync, continuity, and responsive workspace journeys |
| Frontend production build | Passed; existing Rollup annotation, mixed static/dynamic import, and chunk-size warnings only |
| Product beacons build | Passed with `VITE_DOTIFY_ROOM_BEACONS=on`; Statement Store publisher chunk emitted and production guards accepted the Product profile |
| ESLint / Prettier | 0 errors and 3 pre-existing hook-dependency warnings; formatting passed |
| Backlog offline consistency / diff check | Passed |
| Live Product host publish/discover/expire round trip | Not run; tracked profile remains `off` |

## Operational state and rollback

`web/.env.product-devnet` keeps `VITE_DOTIFY_ROOM_BEACONS=off`. The feature is
therefore absent from the standard Product candidate until the runbook's live
round trip succeeds. Rollback is a build with the same flag off; already
published announcements expire without a revocation transaction.

## Remaining gate

Run the opt-in Product build in two host clients, capture publish, discovery,
deduplication, expiry, and wallet-free share-link join evidence, then decide
whether the tracked Product profile should enable the feature. Chat, reactions,
lineup state, SDP/ICE, and audio remain outside Statement Store scope.
