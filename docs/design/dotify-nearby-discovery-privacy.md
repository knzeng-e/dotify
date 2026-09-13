# Dotify Nearby Discovery Privacy Contract

Status: W18 design proposal, not implemented at runtime.

Last reviewed: 2026-09-13.

## Decision

Nearby discovery may be built only as an explicit opt-in layer over ordinary
room links. It must never collect, transmit, log, store, publish, or render
precise coordinates. The network protocol carries coarse area cells, rotating
discovery identifiers, short expiries, room metadata already visible in the
current room list, and canonical room URLs. It does not carry wallet addresses,
IP addresses, exact distances, geohashes, or latitude/longitude fields.

This is not anonymity. Coarse cells reduce precision, but repeated queries,
small crowds, timing, IP metadata, and host behavior can still leak context.
The product copy must say "approximate area", not "anonymous location".

## Sources Checked

- W3C Geolocation Recommendation, privacy considerations and user consent:
  https://www.w3.org/TR/geolocation/#privacy_considerations
- MDN Permissions API, including `geolocation` permission state and browser
  revocation limits:
  https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API
- MDN Permissions-Policy `geolocation`, including secure-context and policy
  behavior:
  https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/geolocation
- Polkadot Desktop permissions reference, including static manifest permission
  declarations and denial UX:
  https://docs.polkadot.com/reference/apps/hosts/polkadot-desktop/permissions/
- Product SDK host API reference for `requestPermission`,
  `requestDevicePermission`, `navigateTo`, and host-container detection:
  https://paritytech.github.io/product-sdk/api/host/

## Consent Model

Nearby has two independent choices:

| Actor | Control | Default | Result |
| --- | --- | --- | --- |
| Host | "Appear nearby for this room" | Off | Publishes a coarse, expiring presence for the current room only. |
| Listener | "Find rooms near me" | Off | Sends a coarse search area after browser or host permission. |
| Listener | "Choose an area manually" | Available without location permission | Searches a named coarse area chosen by the user. |
| Venue or facilitator | QR/link poster | Available without location permission | Opens the same canonical room link or a manually selected venue area. |

Host opt-in is per room, not an account preference. Listener opt-in is per
search session, not a background listener. Permission denial leaves ordinary
room discovery, room codes, and shared links usable.

Copy that can ship later:

- Host toggle: "Appear in approximate nearby discovery for this room"
- Host disclosure: "Dotify shares a broad area for this live room for about two
  minutes. It does not share your exact location."
- Listener action: "Find rooms near me"
- Listener disclosure: "Dotify uses your location on this device to choose a
  broad search area. The server receives only the area, not your coordinates."
- Denied state: "Nearby search is off. You can still enter a room code, open a
  shared link, or choose an area manually."
- Sparse state: "Few rooms are nearby, so Dotify is showing a wider area."

## Protocol Proposal

The proposal is mirrored in
`web/src/features/rooms/nearbyDiscoveryProtocol.ts`. The runtime must not import
or use it until W19 explicitly implements nearby discovery.

```typescript
type NearbyAreaCell = `dotify-nearby-v1:${number}:${number}:${number}`;
type NearbyAreaScale = 'standard' | 'expanded';
type NearbyDiscoveryMode = 'browser-geolocation' | 'manual-area' | 'venue-qr';
type NearbyHostSurface =
  | 'standalone-browser'
  | 'product-desktop'
  | 'product-web-gateway'
  | 'product-ios-external-browser';

type NearbyHostPresence = {
  schemaVersion: 1;
  roomId: string;
  discoveryId: string;
  areaCell: NearbyAreaCell;
  areaScale: NearbyAreaScale;
  hostSurface: NearbyHostSurface;
  canonicalRoomUrl: string;
  expiresAt: string;
  listenerCountBucket: '0' | '1' | '2-3' | '4-9' | '10+';
  capabilities: {
    walletlessJoin: true;
    sourceKeysExposed: false;
    exactLocationShared: false;
  };
  nowPlaying?: {
    title: string;
    artist: string;
    playbackMode: 'full' | 'preview';
  };
};

type NearbySearchRequest = {
  schemaVersion: 1;
  mode: NearbyDiscoveryMode;
  listenerDiscoveryId: string;
  areaCells: NearbyAreaCell[];
  requestedAt: string;
  maxResults: number;
  manualAreaLabel?: string;
};
```

Forbidden field names at every protocol level: `lat`, `latitude`,
`longitude`, `lon`, `lng`, `coordinates`, `coordinate`, `geohash`,
`distanceMeters`, `exactDistanceMeters`, `walletAddress`, `evmAddress`,
`ss58Address`, and `ipAddress`.

Authentication rules for W19:

- Host publication is authenticated by the existing room host session and, when
  available, the Product host account. Public payloads still use a rotating
  `discoveryId`, never the wallet or Product public key.
- Listener search is anonymous to other users. Operators may see coarse area,
  request time, and ordinary network metadata, but must not log exact location
  or durable listener IDs.
- Joining still uses the canonical room URL and existing Socket.IO room flow.
  Nearby never replaces room links, WebRTC signaling, or host-based key access.

## Tunables

| Tunable | Value | Why |
| --- | --- | --- |
| Standard cell size | 1,800 m | Coarse enough to avoid venue/block-level precision while still useful in a city. |
| Expanded cell size | 7,200 m | Used when density is low so sparse areas do not expose one precise room area. |
| Neighbor ring | 1 | Queries include the center cell plus eight neighbors to soften grid boundaries. |
| Minimum useful density | 4 rooms | Below this, use expanded area and suppress exact counts. |
| Max results | 20 rooms | Keeps repeated searches from enumerating every room. |
| Host TTL | 90 seconds | Short enough for stale room cleanup, long enough for 30-second refresh jitter. |
| Host refresh interval | 30 seconds | Three chances to refresh before expiry. |
| Expiry grace | 30 seconds | Avoids one missed refresh immediately dropping the room. |
| Discovery ID rotation | 15 minutes, on new room, on coarse-cell change, and on revocation | Limits cross-session linking while keeping a room stable during ordinary browsing. |
| Query rate limit | 6 searches per 60 seconds per session/network key | Damps triangulation by repeated adjacent queries without blocking ordinary use. |

These are defaults for pilot testing. W19 may tune them only with recorded
evidence and must keep the same privacy shape unless this document is revised.

## Threat Model

| Actor | Risk | Mitigation | Residual exposure |
| --- | --- | --- | --- |
| Other listeners | Infer host neighborhood from result area or timing. | Coarse cells, neighbor-ring queries, expanded sparse areas, no exact distances. | A determined observer can still infer broad area and active time. |
| Abusive host | Publish misleading nearby presence or use room titles to target people. | Bind publication to authenticated room host, rate limit, moderation/report path before broad launch. | A host can still choose public room copy; abuse response is operational. |
| Discovery operator | Correlate coarse area, IP, request time, and room metadata. | No exact coordinates in payload/logs, short retention, aggregate logs only, data deletion on room end. | Operator still sees network metadata and coarse-area demand. |
| Public beacon reader | Read globally visible Statement Store records if nearby moved there. | Do not publish nearby cells to Statement Store in W19; keep server-side ephemeral memory first. | If a future chain beacon exists, cells and timing become public. |
| Query triangulator | Repeated adjacent searches narrow the likely area. | Rate limits, max results, neighbor-ring responses, no exact distance sort, sparse-area expansion. | Multiple accounts/networks can still sample over time. |
| Cross-session linker | Link the same host across rooms or days. | Rotating discovery IDs, no wallet/address fields, no persistent nearby profile. | Room title, host display name, and listening habits may still identify someone. |

## Scenario Walkthroughs

| Scenario | Expected behavior |
| --- | --- |
| Sparse rural area | One or two active rooms trigger a 7,200 m expanded area, count buckets, and no exact distance. |
| Crowded venue | Users can use a venue QR/manual area. Nearby may show standard cells, but labels are bucketed and not sorted by exact distance. |
| Grid boundary | Search covers the center cell plus eight neighbors, so crossing a cell border does not create a sharp result cliff. |
| Moving host | Host refreshes only the current coarse area. Changing coarse cell rotates `discoveryId` and deletes the old record. |
| Repeated adversarial queries | More than six searches per minute are throttled; responses never reveal exact room count below density threshold. |
| Permission revocation | Host presence is deleted immediately. Listener search stops and falls back to manual area/link/code paths. |
| Expired presence | Unrefreshed presence disappears after 90 seconds plus 30 seconds grace. |
| Galaxy placement | Room positions are derived from room/discovery identity and current room data, not physical cells or coordinates. |

## Product And Browser Capability Matrix

| Surface | Location capability | Product/host permission impact | W18 decision |
| --- | --- | --- | --- |
| Standalone HTTPS browser | Browser Geolocation API after explicit user permission; Permissions API can query state where supported. | No Product host involved. Permissions can be denied or revoked in browser settings. | Eligible for W19 prototype with device-side coarsening. |
| Manual area in any browser | No device location needed. | No special permission. | Must ship as the no-location fallback. |
| Venue QR/link | No device location needed. | No special permission. | Preferred for events and sparse communities. |
| Product Desktop | Current Product docs require declared/static host permissions for network/host resources. The host SDK exposes remote/WebRTC/device permission APIs, but no confirmed location device permission is documented for Dotify use. | A new host capability would require manifest/deploy review and user re-approval. | Treat host location as unknown/unsupported until official API evidence exists; use manual area or external browser. |
| Product Web gateway | Ordinary HTTPS browser rules, subject to gateway/browser policy. | No extra Product Desktop permission. | Same privacy protocol as standalone browser if browser geolocation exists. |
| Product iOS current path | Dotify already routes in-app room audio to external browser when host WebRTC is unavailable. | No claim of Product-native location. | Use external browser/manual area only until Product host APIs are verified. |

## Storage, Logs, And Expiry

The first implementation must use an ephemeral server-side store. It must not
write nearby presence to chain, Statement Store, durable catalog snapshots,
analytics, crash reports, or browser local storage. If operational logs are
needed, log event type, coarse result bucket, and status only. Do not log
`areaCell`, `discoveryId`, IP address, wallet address, or coordinates.

Deletion semantics:

- host leaves room: delete immediately;
- host disables nearby: delete immediately;
- browser permission becomes denied: delete immediately;
- room expires or host timeout fires: delete with the room;
- unrefreshed presence: invisible after 120 seconds total;
- listener revokes search: clear client memory immediately.

## Abuse And Safety Cases

- A host can publish offensive names or room descriptions. W19 needs report and
  hide controls before broad launch; W18 does not add moderation.
- Nearby can create unwanted attention around venues or small communities.
  Manual area and QR are safer defaults for facilitated events.
- Count buckets can still reveal that a room is active in a broad area. The UI
  must show a host toggle and avoid enabling it by default.
- Coarse cells are not proof of physical presence. Do not use nearby as
  personhood, attendance, royalty, or reward evidence.

## W19 Implementation Gate

W19 may start only if reviewers accept this contract or revise it explicitly.
The first shipped build must stay behind a feature flag, keep exact coordinates
device-side, pass protocol safety tests, and record manual smoke for permission
denial, sparse area expansion, revocation, expiry, and wallet-free joining.
