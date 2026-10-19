# Dotify Nearby Discovery Privacy Contract

Status: W19 is available by default in Web and Product builds. V4 supplies room identity, stable host choices and authenticated artist activity. The October 18 v5 live-presence follow-up below is a candidate, not deployed. Physical native-location validation remains open. Hosts explicitly choose publication. W18 v1 is inert historical scaffolding.

Last reviewed: 2026-10-18. The newest amendment governs room visibility, public presence and artist activity; older dated sections are historical where they conflict.

## Live invitations and background continuity, 2026-10-18

Owner-approved follow-up, not deployed. This amendment supersedes earlier
background/disconnect rules below.

Search v5 subscribes to a scoped, in-memory snapshot on the existing Socket.IO
connection. A random watch ID and increasing sequence reject stale replies.
Nearby and Worldwide remain separate; both Nearby radii must match. Each socket
has at most one watch per mode, each expires after 45 seconds, and the service
accepts at most 2,000 watching sockets. Changed public snapshots are coalesced for
200 ms. Invalidation is scoped to a changed room's old/new public areas; private
rooms and unchanged public fields trigger no watch work. Identical queries share
one snapshot/enrichment per batch. Private or out-of-scope activity does not emit
frames or sequence gaps.
Foreground reads still renew every 15/30 seconds. Unwatch, disconnect, expiry and
hidden listener pages end the subscription. Pushes cannot extend the client's
last acknowledged query lease. V2/v3/v4 retain their response shapes.

A host who backgrounds Dotify may explicitly hold the last published area through
`nearby:hold`. Live transport pongs/host activity renew that existing 90-second
lease without a new location read. This is continued publication at the last
consented area, not movement tracking. Returning to foreground requests a fresh
fix. Denial, explicit Link only and room closure revoke visibility. Native Hosts
without a silent permission observer can only recheck an OS revocation on return;
this limitation must be included in device acceptance. A missing hold, failed
connection or expired lease cannot be renewed by a later heartbeat alone.

After a detected host disconnect, v5 shows Reconnecting for at most eight seconds
and disables Join. Authenticated host resumption inside that window preserves
visibility. After expiry it requires fresh publication. Old clients omit offline
rooms. Explicit close/removal is pushed immediately after the 200 ms coalescing
window; network failure detection still depends on transport timeouts. This does
not promise uninterrupted background audio on a suspended operating system.

V5 adds optional host-written name (60 characters) and invitation (240), plus
connection state and a boolean `artistPresent`. The boolean requires an existing
server-verified, explicitly announced artist member still connected to the exact
currently playing runtime/release. It reveals that presence in the public room;
it never exports the member's identity, token or wallet. A pink verified seal is
visible without hover. Link-only rooms remain absent from public discovery.
Profile text stays only for the room lifetime and grants no identity/artist role.

Hide is local to this mounted discovery session and reversible in Hidden rooms.
Restoring removes the local exclusion; it cannot restore an expired or private
invitation. Report remains an aggregate counter, not a moderation inbox: no
moderator is notified, and the UI states that limitation. Neither action changes
what other listeners see.

## Room identity, stable choices and artist activity — 2026-10-17

Following physical tests, the owner explicitly requests exact listener counts,
cover-based room nodes and artist activity across visibility scopes. Public
v4 discovery therefore exposes an exact connected listener count (excluding the
host) and a validated public artwork reference. It never exposes audio/source
references, participant identities, wallets, coordinates or cell IDs. V2/v3 retain
their exact earlier response shape. Exact counts reveal changes in attendance;
this is a deliberate change from bucketed counts. It is not a unique-human or
verified-listen metric. Orbits represent these counts, never invented listeners.

A host's explicit Nearby/Everyone choice lasts for the current room. Transient
lease expiry, disconnect or backgrounding suspends live publication without
rewriting that choice to Link only. Foreground recovery may renew the previously
chosen scope only after fresh permission/location validation. Denial or missing
native coordinates leaves a visible unavailable/retry state, never a falsely
published invitation. Location remains ephemeral and background collection is
disabled. Explicit Link only clears the choice and follows acknowledged removal
semantics; no late renewal may undo it. New rooms still start Link only.

Artist Overview uses a separate authenticated view. Server-verified runtime
ownership and canonical release matching authorize aggregate counts across all
rooms playing that artist's releases. Private/link-only rooms contribute only
to the aggregate: no code, host, participant, location, track-per-room record or
join action is disclosed. Opted-in Nearby and Worldwide rooms may be listed to
the verified artist regardless of distance, with no location disclosed. This is
an explicit exception for the artist, not a global public room-list API. Public
visibility copy must disclose that the track's artist can discover the room from
anywhere. Counts cover current connected sessions, not historical analytics.

The existing TTL, disconnect cleanup and moderation boundaries still apply.
Artwork must be public and canonical, with unsafe/unverified references omitted.
The owner's own room marker is based on the current authoritative room ID, not a
match on title, cover, distance or alias. The radar remains an illustration.

## Automatic foreground discovery — 2026-10-16 (historical where superseded above)

The owner requested discovery on app entry without an extra scan button.
`useRoomDiscovery` owns two independent ephemeral readers in the listener shell:
Nearby uses device location; Worldwide never does. This is **search consent**,
not consent to make a room public. A new host remains Link only until explicitly
choosing Nearby or Everyone. The client never widens either participant's radius.
Host opt-out remains unconfirmed until the server acknowledges removal: the
compact control says Updating visibility and retains the 90-second lease warning
while a reply is pending, refused or interrupted. Selecting Link only is a desired
mode, not proof that a previously published invitation is already gone.

With the feature enabled, entering the app may request OS/Product location
permission. A refusal is remembered for this page lifetime and prevents automatic
re-prompts; retry is explicit. Listener reads resume after foreground return or
reconnect, respecting the request cooldown. Pause stops nearby reads; immersive
room playback suspends both listener readers. Hidden/pagehide/disconnect abort
in-flight native watches and clear results. Host publication always requires
explicit re-enablement after interruption. No coordinates or permission decision
are persisted in browser storage. Removing the feature flag stops all effects.

Nearby search refreshes every 15 seconds and Worldwide every 30. Every Product
native fix is preceded by the SDK `requestDevicePermission('Location')` gate;
a previous successful gate is not a permanent grant. The synchronous Electron
Permissions result is not used to contradict that gate. Native denial, timeout
or uncertainty still fails closed. The watch allows up to 32 seconds, requests
high accuracy, accepts a cached fix at most 15 seconds old, and rejects fixes
older than 30 seconds or less accurate than 1 km. Browser environments without
an observable permission state retain bounded snapshot behavior. Product has no
public silent revocation observer: a Host-only revocation is checked at the next
refresh, not instantaneously. Devices must verify actual prompt/revocation behavior.

Search requests accept v2 or v3. Publication stays v2. A v3 geographical reply
adds only `distanceBand`, one of `0–5 km` through `40–45 km`, calculated between
coarse cell centres. Worldwide returns `null`: no distance is fabricated and
worldwide hosts need not share location. Five-kilometre bands avoid false
precision but disclose additional relative-area information; repeated probes
can still narrow a host's area. Existing quotas and coarsening bound, but do not
eliminate, this inference risk. No cells, coordinates, bearings, source refs or
wallets are returned. Replies remain ordered by discovery ID, not distance.

Each channel returns at most 20 invitations; the combined list can contain 40.
Replies are independent and render immediately; this is incremental display
across channels/polls, not streaming individual records from one response.
Unexpired cards stay usable during background reads. Relative result leases are
at most 45 seconds and never exceed remaining host presence, with network time
subtracted locally. Each card expires independently. The radar plots up to eight
stable illustrative positions; the complete accessible list retains all results,
Hide/Report and Join. Joining does not wait for a location fix or scan completion.

Search range and publication settings use dismissible keyboard-accessible sheets.
Range drafts do not query before Done; publication drafts do not publish before
Done/Open the room. City exploration is removed. Worldwide and invitation links
are the no-location alternatives. Sharing Wi-Fi is neither a location source nor
proof of physical proximity: discovery still needs fresh, authorized device fixes.

Deploy signaling with v3 read support before the client; old v2 clients keep their
exact response shape. All discovery acknowledgements are reliable while connected,
never buffered across disconnect. Single-worker memory, expiry, moderation limits,
legacy empty global listings and the no-wallet/key boundary remain unchanged.
See [evidence and remaining device gates](../backlog/implementation/evidence/W19-automatic-room-radar-2026-10-16.md).

## Historical amendments

The following dated notes record prior releases. In particular, manual scan,
city exploration and Product snapshot-only wording is superseded above.

## Discovery choice amendment (W31), 2026-10-16

The two mutually exclusive switches are replaced by one choice, **Who can find
this room?**, with three options: **Link only** (the default for every new
room), **Nearby**, and **Everyone**. The protocol, lease, revocation and
privacy rules below are unchanged; Everyone is the worldwide mode. Choosing
Everyone states that the host name and current track become visible to anyone
on Dotify. When a host's visibility attempt fails or stops, the panel does not
claim link-only availability until the server acknowledges revocation. While
revocation is pending, refused, or interrupted, it warns that the previous
publication may remain discoverable for up to its 90-second lease. A repeated
opt-out keeps that warning; a late acknowledgement cannot overwrite a newer
publication. The radio reflects the chosen mode, while the status and heading
explain whether its removal is still unconfirmed.
Worldwide cards offer the same Hide and Report actions as nearby cards.

## Discovery recovery amendment — 2026-10-15

The next build adds an explicit **Visible worldwide** choice alongside Nearby.
Both switches start off for each new room and are mutually exclusive. Worldwide
publication carries `{schemaVersion: 2, worldwide: true}` only: no location,
radius, account or wallet. The Rooms page reads these opted-in public invitations
by default, separately from location-based scanning. Private link rooms and
nearby-only rooms never enter this list. Legacy global enumeration remains empty.
Worldwide discovery uses the same ephemeral host-owned 90-second lease, refresh,
revocation and disconnect cleanup; backgrounding stops publication. Foreground
listeners may resume public reads, but host publication never resumes without consent.

The slider now accepts every integer kilometre from **5 through 42**, including
intermediate distances. Five kilometres remains the minimum because coarse-cell
uncertainty cannot support a promise of street-level precision. Both geographical
radii still constrain matches. Device and city-centre searches remain distinct.

Scan progress distinguishes locating, scanning and completed/empty results. Pending
clicks coalesce; a 10-second cooldown bounds repeat scans (60 seconds after a server
throttle). Per-minute socket search/publish/report quotas remain 6/12/3; shared-network
quotas become 60/120/30 so a few listeners on one Wi-Fi do not exhaust each other's
budget. Worldwide reads have a separate search budget. This remains bounded abuse
resistance, not a guarantee against distributed scraping.

Product uses its explicit SDK Location gate followed by a bounded native fix.
Desktop's synchronous Permissions API denial is not treated as the result of that
asynchronous gate. Native geolocation denial still fails closed; mobile gets up to
32 seconds for a sufficiently accurate fresh fix. Only a coarse cell leaves the
device. Product remains snapshot-only with explicit renewal; a missing browser
permission observer never enables continuous tracking.

See [recovery evidence](../backlog/implementation/evidence/W19-discovery-host-recovery-2026-10-15.md)
for live failures, source evidence and outstanding physical-device checks.

## Discovery consent correction — 2026-10-15

Creating a room no longer advertises it globally. `rooms:list`,
`rooms:updated` and `/status.rooms` retain their legacy empty-array response
shape; even a Nearby lease does not add a room to those global endpoints.
Only `nearby:search` can enumerate opted-in rooms: geographical matches respect both selected areas; the explicit worldwide mode is separate.
The application no longer publishes or consumes global Statement Store room
announcements: that transport cannot enforce this radius or immediate opt-out.
The operator still knows room membership; this is discoverability control,
not anonymity or authenticated room admission.
Public builds must keep the separate experimental Celerity observation setting
`VITE_DOTIFY_ROOM_REALTIME=off`; authorized measurement builds can still publish
public presence and do not share this private-room release guarantee.

The creation sheet offers **Visible nearby**, off for each new room. A slider selects each integer distance from approximately 5 through 42 km. Selecting the switch/radius does
not request permission: **Open the room** creates the room, then consumes that
explicit choice once against the acknowledged room ID. Failed/denied location
leaves the room accessible by link/code with discovery off. Reconnect, expiry
and navigation never repeat that creation choice. The in-room switch can stop
visibility independently of playback. Listener search uses the same compact
radius control and displays only bounded Nearby replies.

Direct room links/codes are checked by the join acknowledgement, not by absence
from a discovery list. Detailed room state and exact member counts are returned to
admitted participants. Home/artist summaries must not interpret an empty global
list as no listening activity; private rooms are not exposed to artists either.
An artist can still join an invited room and announce their verified presence.
Restoring broader artist discovery requires a distinct consented design.

## W19 v2 implementation contract — 2026-10-14

`web/shared/nearby-v2.mjs` is the shared geometry/validation boundary;
`web/server/nearby.mjs` owns short-lived presence independently from public
room state. The frontend and server include Nearby when their respective
`VITE_DOTIFY_NEARBY` / `SIGNAL_NEARBY` setting is unset or exact `on`.
Explicit `off` or an invalid value disables it for operational rollback.
There is no additional Product feature flag. Availability never starts
location collection, permission requests, geographical search or visibility by itself. The Rooms page reads explicit worldwide invitations without location.
No collection, permission query or nearby traffic occurs with the frontend
flag off. The server rejects all Nearby events with its flag off.

Supported approximate radii are every integer from **5 through 42 km**, selected
independently by host and listener. The proposed 2 km value is not offered:
cells are about 2.22 km across and cannot honestly support that precision.
The client converts a fix into a latitude band and a longitude sector whose
width adapts to that band's latitude, including polar caps. This is a spherical
grid, not Web Mercator. Fixtures cover the dateline, poles and cross-cell edges.
Only the string `n2:<band>:<sector>` leaves the device. There is no variable
scale and no cell list to enumerate or disperse.

Both publish and search accept exactly `{schemaVersion: 2, cell, radiusKm}`.
Matching compares spherical cell-centre distance to the **minimum of both
radii**; sparse results never widen either area automatically. Coarsening
makes the boundary approximate (several kilometres of uncertainty across two
cells, plus up to 1 km fix error per device). This is discovery, not a physical
admission fence. A wider listener search never changes the host radius.

The server binds publication to the existing room-host socket, derives display
metadata from its room, and sets the expiry itself. No client timestamp,
credential, room ID or metadata is accepted in publication. Discovery IDs
rotate on area/radius change, after 15 minutes, and after opt-out/disconnect.
Search returns at most 20 room IDs, rotating discovery IDs, host name, title,
artist, bucketed presence, capacity state and expiry. **No host cell IDs,
exact counts, distances, source refs or wallets** are returned. Results are
ordered by discovery ID, not distance. The existing Join handler owns entry.
The public room ID remains linkable for that room's lifetime; rotation does
not make an already public room untraceable. Replies use bounded relative
leases (`expiresInMs`); the client subtracts the round trip rather than relying
on its clock agreeing with the server's clock.

Presence expires after **90 seconds, with no grace period**, refreshes every
30 seconds in the foreground, and disappears immediately at room end or
socket disconnect. Clients stop and clear memory on opt-out, permission
revocation, background/pagehide or disconnect. Resuming publication or geographical discovery always needs an explicit
action; public worldwide reads may resume in the foreground. Cancellable single-fix watches discard exact fixes immediately after
coarsening; fixes with accuracy worse than 1 km or older than 30 seconds are ignored until a fresh fix arrives or the bounded timeout expires.
Permission state is checked afresh before refresh so it cannot trigger a new
background permission prompt. Offline opt-out explicitly explains the possible
90-second remote expiry. Connected revocation uses a reliable (non-volatile)
packet so polling backpressure does not discard it; disconnected revocation is
never buffered for replay after reconnect. Device mode requires secure Geolocation.
Without a browser permission observer, ordinary Web also uses snapshot-only access.
Product requires an explicit SDK `Location` grant followed by a native fix; it does
not consult the unreliable synchronous Electron permission state between them. A grant
does not prove the WebView can return coordinates. Missing APIs, failed
handshakes and denied/unanswered permission checks fail closed.

Product uses a single position snapshot with a maximum 90-second lease, never
automatic movement tracking or automatic SDK permission requests. **Update my
location** explicitly starts a new grant/fix cycle. Each room card expires
independently; a short room lease does not end the position snapshot or discard
other live results. Response-level expiry clears the results
and withdraws visibility. The public SDK currently exposes no silent observer
of Product-only permission revocation. Browser/OS permission changes stop
immediately when observable; a Host-only revocation is bounded by the snapshot
expiry rather than claimed to be observable. Native continuous refresh remains
unsupported until this boundary is resolved and physically verified. Neither
default availability nor an SDK grant relaxes secure-context/API prerequisites.

**Explore a city** is a separate, explicit option, never a default or an
automatic fallback after a failed location request. Manual areas are an offline starter list of city centres; there is no external
geocoder. The selected label and precise centre are not sent. This intentionally
does not cover every locality yet. Host and listener choose their area separately.

Ephemeral per-socket and per-network budgets allow 6 searches, 12 publications
and 3 reports per minute. Network keys are HMACs with a process-local random key,
expire after a minute, and are never logged. Revocation bypasses rate limits.
Budgets and presence have hard memory caps; restart empties both. NAT users share
a network budget; reconnects cannot reset it. Multiple networks and forged
locations remain possible. No attendance/personhood/value claim uses Nearby.

Hide stays in page memory (max 200 room IDs). Report hides the room and records
only an aggregate safety counter, without location, identity, free text or a
durable moderation case. The interface says so. A staffed abuse workflow remains
a public-enable review concern. `/health` exposes only cumulative event counters,
not areas or a location index. Global room enumeration is disabled. Someone
with the room code can still join and learn its metadata and exact connected
session count: Nearby is not anonymity or an admission fence.

The v1 sections below are historical: automatic sparse expansion, 2-minute
expiry, area-bearing responses and the old schemas are superseded by v2.
Physical browser/Product permission checks remain required before release.
Browser consent behaviour was checked against the
[W3C specification](https://www.w3.org/TR/geolocation/); the
[Product Host API](https://paritytech.github.io/product-sdk/api/host/) does not
constitute device evidence. No Product manifest permission is changed here;
the Product adapter requests `Location` only following a Nearby action.

## Radius amendment — 2026-10-14

The owner selects W19 as the next product expansion, before optional 3D,
activity, further realtime migration and stablecoins. Initial flagged implementation
may start before W13 aggregate acceptance; public enablement still requires
W19 privacy/device evidence and applicable reliability gates.

Owner clarification on 2026-10-14: Product must carry Dotify features by default.
Nearby availability is now the same default in Web and Product; operational
disables remain possible. User consent, physical capability evidence and release
validation are separate from feature availability. This amendment does not
authorize collecting real positions or publishing a build.

Add separate host discovery-radius and listener search-radius controls in km.
Initial proposal: 2 / 5 / 10 / 25 km with 5 km selected inside the control,
subject to matching/uncertainty review. Matching respects both coarse areas;
a wide query cannot enlarge host consent. Location is a discovery aid, not a
secure room-admission fence, and links still work from elsewhere.

The v1 protocol/tunables below are historical scaffolding. They have no radius
field and are not an implementation of this amendment. W19 must version/review
allowlisted schemas, bounded query coverage, projection and uncertainty before
collection. Reconsider publishing host cell IDs in responses; return only the
minimum metadata needed to join. Exact coordinates stay device-side.

The new explicit-radius contract supersedes automatic sparse-area expansion in
v1: do not silently widen either actor's area. Offer **Widen search** to the
listener; preserve host consent. If coarse privacy requirements cannot support
an advertised radius, explain the limitation or offer a larger area before
search. Review count/coverage leakage and repeated radius probes with synthetic
data. Default-off visibility, foreground-only collection, expiry, revocation,
manual-area/QR paths and operator-visibility caveats remain required.

This amendment changes planning, not runtime code or deployed permissions.
See [W19](../backlog/implementation/W19-nearby-rooms.md) for current acceptance.
Browser consent/security behavior was rechecked against the
[W3C Geolocation specification](https://www.w3.org/TR/geolocation/) on 2026-10-14;
actual Product location support still needs capability and device evidence.

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
  listenerCountBucket: '0' | '1-3' | '4-9' | '10+';
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

W19 must validate incoming JSON against the allowlisted `NearbyHostPresence`,
`NearbySearchRequest`, and `NearbySearchResponse` schemas and reject unknown
fields. A denylist alone is not enough: payloads such as `position: [lat, lon]`
must fail even though the field name is not one of the known coordinate names.

Forbidden field names at every protocol level remain defense in depth: `lat`,
`latitude`, `longitude`, `lon`, `lng`, `coordinates`, `coordinate`, `geohash`,
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
| Minimum useful density | 4 rooms | Below this, use expanded area and suppress exact counts into the non-exact `1-3` bucket. |
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
