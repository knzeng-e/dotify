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

## Physical-test feedback — 2026-10-17 (current scope)

The owner tested Product 0.1.52 and ordinary Web and requests this continuation
of #274 and #257. Base: tested `dev` `3b0bb68`.

- Restore circular album-cover room nodes, exact connected listener counts and
  orbiting listener points. Keep public scope as a small planet/radar indicator,
  use the same Dotify logo as the header at the centre, and mark the host's own
  room with a direct return action. Layout remains illustrative, not geographic.
  The visual refinement keeps the exact mark geometry/size in cyan neon. At
  rest, room labels show only title and artist; full metadata appears on hover
  or keyboard focus, with the existing touch preview and own-room badge kept.
- Keep the sweep visible throughout active discovery; short HTTP/socket replies
  must not make it appear broken. Reduced-motion, paused/error and background
  states must remain honest.
- Treat the host's visibility selection as room-lifetime intent. Expiry,
  backgrounding and transient network/permission failures may suspend actual
  publication, but must not silently select Link only. Reconnect/foreground
  recovery uses fresh permission/location checks and bounded retries. Explicit
  opt-out still requires acknowledged server removal or an honest TTL warning.
- Product permission approval and native coordinate delivery are distinct. Audit
  the installed Host path, fix application defects and document any upstream
  capability gap; passing a fake Host test is not physical location proof.
- A verified artist sees aggregate counts for every room carrying their tracks,
  including link-only rooms, with no private room identifiers. Public opted-in
  rooms are listed/joinable for the artist regardless of radius. Ordinary
  discovery remains constrained by both host and listener radius.
- V4 discovery adds exact listener counts and a validated public cover reference;
  preserve v2/v3 response compatibility and prohibit audio/key/source leakage.
  Counts are connected sessions, never verified unique humans or audible plays.

This amendment supersedes earlier count bucketing, explicit host re-enablement
and artist-visible-subset wording. See the corresponding
[privacy amendment](../../design/dotify-nearby-discovery-privacy.md) and
[validation/native Host evidence](evidence/W19-room-feedback-2026-10-17.md).

## Automatic galaxy amendment — 2026-10-16 (historical scope)

The owner explicitly requests automatic foreground discovery at app entry and
when returning to Rooms, progressive results, a restored room galaxy, approximate
distances, and temporary settings sheets. This supersedes the manual-scan,
city-exploration and Product snapshot-only journeys below. Remove city exploration;
Worldwide invitations and direct links remain the no-location alternatives.

- One listener-shell coordinator starts separate Nearby and Worldwide reads.
  The OS/Product permission gate is still authoritative; refusal never loops
  prompts. Backgrounding/disconnect clears location and results. Foreground
  reconnect resumes reads after cooldown unless paused or denied. Immersive room
  playback suspends listener scanning; browsing Rooms can resume it.
- Nearby reads refresh every 15 seconds, Worldwide every 30. Product rechecks its
  SDK Location gate before every native fix; no silent revocation observer is
  assumed. Exact coordinates are discarded on-device. Physical devices must
  confirm that previously granted access does not repeatedly prompt.
- Hosts still choose Link only (default), Nearby, or Everyone explicitly.
  Automatic listener search never publishes a room. Host publication does not
  resume automatically after backgrounding/disconnect.
- Radius is every integer from 5 to 42 km. Search v3 adds only five-kilometre
  distance bands; Worldwide has no geographic distance. Both radii still bound
  matches. Galaxy placement is illustrative, without bearings or geographic pins.
- Fresh replies from either channel appear immediately, with existing unexpired
  cards retained during background reads. Inspection and Join never wait for
  the other channel. The server caps each channel at 20 invitations; the radar
  plots eight and the list includes every returned invitation.

See [implementation evidence](evidence/W19-automatic-room-radar-2026-10-16.md).
This is a reviewable continuation of #274, not proof of physical Host readiness
or authorization to deploy. The earlier sections document the scope's history.

## Owner-requested recovery extension — 2026-10-15

After the pilot, the owner requested clearer scan feedback, native Host location
recovery, every integer radius from 5 to 42 km, and default browsing of rooms whose
hosts explicitly choose worldwide visibility. Both publication modes remain off
by default. This supersedes the earlier radius presets and geographic-only scope;
it does not reopen automatic global listing. Reliability work also covers artwork,
progressing encrypted audio ranges and stale host session recovery (Refs #88/#89).
See [evidence](evidence/W19-discovery-host-recovery-2026-10-15.md). Physical Product
checks remain a release gate, so this change does not close #274.

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
2. Include Nearby by default in Web and Product, with an operational disable
   (owner clarification 2026-10-14). Coarsen on-device before every outbound
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
aggregate acceptance. The owner subsequently requested default availability in
both Web and Product. Publication still requires reviewed privacy,
device, room and applicable W13/#89 reliability evidence. Planning priority
does not authorize deployment, participant contact, collecting real locations,
spending funds or changing permissions in a published build.

## Handoff

Implementation review: see [W19 evidence](evidence/W19.md). The v2
uses 5 / 10 / 25 km; 2 km is intentionally withheld because the coarse cells
are approximately 2.22 km across. Public enablement still needs the physical
device/privacy and room reliability gates listed in that handoff.
Product location continuation: [capability and snapshot evidence](evidence/W19-product-location.md).
It separates current-position discovery from explicit city exploration and
includes Product location by default alongside Web, preserving explicit user
consent and honest capability checks. The former additional build flag is removed.
The [radar and audio follow-up](evidence/W19-radar-audio.md) makes new rooms
link-only, removes global enumeration and simplifies the opt-in controls. Its
deployment and physical-device gates remain explicit in that handoff.

Write `docs/backlog/implementation/evidence/W19.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
