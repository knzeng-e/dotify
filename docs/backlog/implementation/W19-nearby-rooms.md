# W19 — Find and open listening rooms nearby

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W19** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/nearby-rooms` created from the latest tested `origin/dev` when work starts.
- Dependencies: delivered W09, W10 and W18; review the radius amendment before collecting location. W13 remains a public release gate, not a prerequisite for starting flagged implementation.
- Release stage: Now implementation, selected by the owner on 2026-10-14 as the next product expansion.
- Priority: P1. Track: Room reliability. Phase: Now. Type: Work.
- Existing issue: #274.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

People can find live rooms around them and hosts can open a listening moment to
people in a chosen surrounding area. Discover opted-in rooms, not every person
or device nearby. Ordinary room links and wallet-free guest access remain usable.

## User journeys and radius contract

1. Listener opens **Nearby**, chooses **Find rooms near me** or a manual area,
   sets a search radius in kilometres, sees live rooms and uses **Join**.
   Cards show public host name, track, artist and available presence context.
2. Host opens or manages a room, explicitly enables **Visible nearby**, chooses
   its discovery radius and sees its approximate-area status. Visibility can
   stop immediately without ending the room.
3. Denied, unavailable or timed-out location offers manual area, QR/link and
   ordinary discovery. No permission prompt on app launch.

Initial UX proposal: 2 / 5 / 10 / 25 km presets, with 5 km selected inside the
control. Validate available values against coarse-cell uncertainty; these are
planned values, not supported capabilities in the current app. Selecting a
radius never enables visibility or grants permission by itself.

Host and listener radii are independent. Matching must respect both approximate
discovery areas: a wide search cannot override a host's smaller visibility area.
Define cell matching and boundary uncertainty in synthetic fixtures before
collection. Exact geographic circles cannot be enforced with coarse cells;
label the radius as approximate, without exact distances, bearings or pins.
Sparse areas offer **Widen search** explicitly rather than silently expanding
past consent. Widening listener search cannot widen host consent.

Radius governs discovery, not proof of physical presence or room admission.
Shared links still work remotely; manual areas and spoofable device locations
cannot prove attendance, personhood or entitlement. No Bluetooth/Wi-Fi scan,
background tracking or automatic discovery of non-participants.

## Read first

- `web/src/features/rooms`
- `web/src/features/productHost`
- `web/server/signaling.mjs`
- `docs/reference/socket-events.md`
- `docs/operations/deployment-configuration.md`
- `docs/backlog/polkadot-alignment-and-nearby-priority.md`
- `docs/design/dotify-nearby-discovery-privacy.md`, including the 2026-10-14 amendment
- `web/src/features/rooms/nearbyDiscoveryProtocol.ts` and its tests

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Review/version W18's inert v1 schema for radius controls and bounded search.
   Test matching, uncertainty, sparse density and abuse first. Reject unknown
   fields, non-finite/out-of-range radii, oversized/dispersed cell lists and
   mixed scales. Review whether responses need host cell IDs at all; do not
   expose them in public room state. Prepare responsive inactive, locating,
   active, empty, denied, stale and disconnected states.
2. Implement behind a feature flag. Coarsen on-device before every outbound
   request. Bind publication to the existing authenticated room-host session
   without requiring a wallet, use rotating public identifiers and derive
   displayed room metadata server-side. Keep Socket.IO authoritative and WebRTC
   as media transport; Celerity and 3D are not dependencies.
3. Add ephemeral presence, bounded queries, rate limits, expiry, hide/report
   controls and aggregate diagnostics. W18's TTL/refresh defaults are starting
   proposals, to validate on devices. No location in logs, analytics, crash
   payloads or durable stores. Restart empties nearby results safely; document
   shared-store/rate-limit coordination if deployed with multiple workers.
   Redis may be justified by that topology, not as a location archive.
4. Expose separate host/listener opt-ins, manual-area/QR alternatives and
   visibility-off. Stop collection and refreshes on revocation, backgrounding,
   room end or disconnect. Resume only with fresh permission state and an
   explicit action. Offline opt-out clears device state immediately and
   explains that remote presence may take up to the documented TTL to expire.
5. Integrate the existing accessible 2D/list discovery surface. Measure an
   independent-client discover → Join → audible stream round trip. Verify
   location support and permissions on each exact Product Host/device version;
   unsupported Hosts offer manual area or explicit continuation. Record new
   flag, manifest, policy, origin, storage/scaling and rollback settings in the
   deployment configuration before enablement.

## Acceptance and meaningful verification

- Inspect network/log/storage output with synthetic coordinates to prove precise location never leaves the device.
- Opt-out, permission revocation, crash/TTL, replay/spoof, multiple nearby-cell queries, sparse density, and cross-cell boundary discovery.
- End-to-end tests using simulated locations plus an authorized real-device permission check; avoid publishing anyone’s real position in test artifacts.
- Different host/listener radii, boundary uncertainty, inaccurate fixes, sparse
  area widening, coordinate projection/high latitude and dateline fixtures.
- Two independent clients: opted-in host found, non-opted-in host absent,
  wallet/signature-free Join with audible guest playback and no source key.
- Forged host session/room metadata, oversized/dispersed queries, repeated
  radius probes and stale/restarted presence. Record residual inference risks.
- Accessible keyboard/screen-reader and mobile touch paths. Feature-off stops
  every collection/search/publication effect as well as hiding the UI.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No public geographic Statement Store beacon, permanent location history, wallet-location index, or claim the operator learns nothing.

## Release condition

The owner has prioritized W19 ahead of optional galaxy/activity work, further
realtime migration and stablecoins. Implementation may proceed before W13's
aggregate acceptance. Default enablement still requires reviewed privacy,
device, room and applicable W13/#89 reliability evidence. Planning priority
does not authorize deployment, participant contact, collecting real locations,
spending funds or changing permissions in a published build.

## Handoff

Implementation review: see [W19 evidence](evidence/W19.md). The default-off v2
uses 5 / 10 / 25 km; 2 km is intentionally withheld because the coarse cells
are approximately 2.22 km across. Public enablement still needs the physical
device/privacy and room reliability gates listed in that handoff.
Product location continuation: [capability and snapshot evidence](evidence/W19-product-location.md).
It separates current-position discovery from explicit city exploration and
keeps native location behind an additional default-off build flag.

Write `docs/backlog/implementation/evidence/W19.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
