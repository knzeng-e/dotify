# W19 discovery and Host recovery — 2026-10-15

Branch: `fix/discovery-host-recovery`, based on tested `origin/dev`
`99658622d120c043854a75c071de6e790623ad47`. Refs #274, #88, #89.
This is implementation evidence, not a record of a new deployment.

## Observed failures and corrections

| Observation | Evidence and change | Limit |
| --- | --- | --- |
| Desktop says location is off without a native prompt | User confirmed Desktop 0.1.3 / App 0.10.0. Official Desktop source at `7843fae`, `main/sandbox/index.ts`, returns false for synchronous geolocation checks while deferring permission to its asynchronous handler. Dotify no longer aborts on that intermediate query after its SDK Location gate. | Source inspection and fake-Host tests do not prove the installed device grants/returns a fix. Native denial still fails closed. |
| Mobile location times out | Wait for a fresh fix with accuracy ≤1 km for up to 32 seconds; ignore an inaccurate/stale first fix instead of failing immediately. | No physical-device GPS test was possible here. Product remains a 90-second snapshot with explicit renewal. |
| Repeated scans throttle, unclear progress | Separate locating/scanning/completed states, empty-result explanation, coalesced clicks, 10-second cooldown and 60 seconds after rate limiting. Shared-network quotas allow ten socket budgets. | No precise coordinates or city name inferred/reported. Single-process limits remain. |
| Room creation visibility can disappear | A real E2E creation/publication attempt timed out while the transport was busy. Publication now uses a connected-only reliable packet, like revocation, instead of volatile delivery. | Neither is buffered across disconnection. A lost revocation expires within the lease. |
| Audio interruption | A live Web run on Mogongo produced `Unable to fetch DAV2 range 2098024-2622327` and an abort, then recovered to a complete decrypt and continued beyond 156 seconds. The 12-second timer previously covered the entire range body. Header timeout and 15-second body inactivity are now separate, with an exact requested-range byte bound. | The observed Web run recovered; it does not establish the exact cause of every terminal Host failure. Physical Host playback remains unverified. |
| Missing Mogongo cover | Public CID `QmdxH6J193N7kF22fqhmnSRPvoG7c4rWJia2q8kcJxib3S` returned a valid 2,209,914-byte PNG, above the old 1 MiB limit. Accept originals up to 8 MiB in bounded memory; persist only images ≤1 MiB. Cosmetic fallback no longer aborts native loading after 1.2 seconds. | Memory remains 16 MiB/48 entries, disk 48 × ≤1 MiB; no Redis is added. |
| Missing Le Singe Fou cover | CID `Qmc1s9HahFvSTuKk23KXpToF8PBaJraj5Re8qKMU1Ntxdq` lists `640.webp` at its root. Recorded `/cover/640.webp` returns 404; `/640.webp` returns 200, 20,332 bytes. Uploads now add a transport envelope so `cover/` remains below the returned root. Existing pins get a narrow same-CID flat-path fallback. | New authenticated Pinata upload/read-back remains an integration gate; local tests verify multipart paths and actual browser 404 recovery. |
| Host account cannot be verified | An API 401 is now classified as `SESSION_INVALID`. Discard only that cached token and establish a fresh signed session once; other errors never cause reauthorization loops. Live signal/API chain configuration was consistent. | The user's rejected token was not inspected; this fixes a reproducible stale-token trap, not a proven diagnosis of that particular session. |

## Discovery choices

Every new room is link/code-only until its host opts in. The host can choose
Nearby (every integer radius 5–42 km, still constrained by both coarse areas) or
Worldwide (no coordinates at all). Modes replace one another atomically in the
same ephemeral presence record. The Rooms page reads worldwide invitations by
default without geolocation. It never lists private or nearby-only rooms there.
Legacy `rooms:list`, `rooms:updated` and `/status.rooms` remain empty.

World and geographical search quotas are independent. Presence lives only in
memory, expires after 90 seconds, refreshes in foreground, and is withdrawn on
stop/disconnect/room closure. Returning listeners can resume public reads;
returning hosts must explicitly restore visibility. The existing operator
disable suppresses both modes. No new environment variable is required.

## Validation

- Frontend: 943 unit tests / 120 files passed, including mobile first-fix recovery,
  unreliable Product permission query, cooldown, long progressing audio range,
  artwork size, flat-path recovery helpers and single-renewal host binding.
- Signaling: 100 tests passed, including independent shared-Wi-Fi budgets,
  strict worldwide payloads, mode separation, arbitrary integer radii and expiry.
- API: 170 tests passed and TypeScript typecheck passed. The new multipart test
  checks the path below the provider's outer upload folder and rejects traversal.
- Nearby browser journeys: three ordinary-Web and two Product-fixture tests passed;
  ordinary Nearby joins real guest audio without key requests. Operator-off test passed.
- Audio continuity: 26 tests passed across Chromium and WebKit, covering slow
  segments, recovery, pause/seek, track changes and fail-closed authentication.
- Catalog: six browser tests passed, including native fallback from the recorded
  nested 404 to the real same-CID flat image and cached-blob rejection recovery.
- Web and frozen Product builds passed; formatting passed; lint has zero errors
  and two pre-existing App.tsx hook warnings. Mobile screenshot inspected: world
  invitations precede the radar, with an accessible Join action and no overflow.
- An additional worldwide journey passed after extending it to verify foreground
  recovery during cooldown and actual guest synchronization.

## Remaining acceptance and rollout

Review/merge first. Deploy signaling before new Web/Product clients because old
servers reject worldwide payloads and radii outside their presets. Deploy the API
upload-envelope fix as part of this release. No data migration, new secret or
service is required. Do not roll back to an older globally enumerating signal
server while promising private link rooms.

Physically retest Desktop 0.1.3 / App 0.10.0 and mobile: permission grant/denial,
location timeout, completed scan, nearby match between two devices, 42 km slider,
worldwide opt-in/out, background/return, host-account renewal and several complete
tracks. Publish one new cover and fetch its returned canonical reference.
#274 remains open until those checks are recorded.

## Primary references

- [Product Desktop permission implementation](https://github.com/paritytech/polkadot-desktop-community/blob/7843fae/main/sandbox/index.ts).
- [Product SDK Host permission API](https://paritytech.github.io/product-sdk/api/host/).
- [Pinata directory upload API](https://docs.pinata.cloud/api-reference/endpoint/ipfs/pin-file-to-ipfs), and the observed public CID directory above.

## PR #283 review and CI follow-up

The review identified a second foreground recovery case: a socket reconnecting
within the ten-second worldwide scan cooldown kept the `disconnected` phase.
At zero, only `off` sessions restarted, leaving the public list stopped. The
resume effect now accepts connected `disconnected` sessions too; it does not
retry while offline or start geographical scans/host publication.

A real routed-WebSocket browser test closes the connection immediately after
an empty worldwide scan, verifies reconnection within ten seconds and waits for
an automatic completed scan without pressing Try again. It failed before the
fix (the countdown ended with the list still disconnected) and passed afterward.

The initial CI failure was in the older adaptive-radar suite: ArrowRight still
expected 5 → 10 km rather than 5 → 6 km. Its consent assertion now observes
geographical discovery traffic separately from the consent-free public worldwide
read, and its repeated manual scan honors the visible cooldown. No CI gate or
privacy assertion was removed. Final validation is recorded on the PR.
