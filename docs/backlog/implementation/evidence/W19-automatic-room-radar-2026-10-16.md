# W19 — Automatic room galaxy, 2026-10-16

## Identity

- Scope: owner-requested automatic foreground discovery, restored galaxy,
  approximate distances, progressive invitations and temporary settings sheets.
- Initial tested dev: `974568c8e42211d757f50178c7de96ca1df087e3`.
- Prerequisite: PR #297, `0d3fca4ef0fb340c5d346c0f05474b93ffd3ac76`.
  The isolated branch started from dev, then included that tested follow-up.
- Implementation actually tested: `03d0718` on `feat/automatic-room-radar`.
- Issue: Refs #274. Code locally verified; physical Product checks remain open.
- Release: **not deployed**. No real location, account signature or payment used.

## Result and decisions

One listener-shell coordinator owns separate Nearby and Worldwide readers. The
app starts searching automatically while visible. Opening Rooms uses that same
session; it does not create duplicate scans. Each independent reply immediately
updates the galaxy/list. Existing unexpired invitations stay actionable during
background refresh, and a slow native fix cannot block Worldwide joining.

The lightweight DOM/CSS galaxy restores the poetic discovery surface without
requiring WebGL or exposing the older full-room snapshots. Six logo petals and a
musical centre accompany the sweep. Positions remain stable as rooms arrive and
are explicitly illustrative. Eight invitations are plotted; the accessible list
includes all returned invitations (at most 20 per channel). Reduced motion removes
animation. Mobile search, publication and invitation-link actions use sheets with
focus management and Escape/back dismissal. City exploration is removed.

Nearby refreshes every 15 seconds, Worldwide every 30. Connected-only reliable
requests replace volatile reads that could disappear during polling backpressure.
Foreground/reconnect scheduling respects cooldown; denial prevents automatic
re-prompts and requires deliberate retry. Product passes its SDK Location gate
before each native fix; this replaces the prior snapshot-only policy, without
assuming a silent Host revocation observer. Observer-less browsers retain bounded
snapshots. Pending callbacks are invalidated on stop. Immersive room playback
suspends listener discovery; browsing Rooms can resume it.

Hosts still explicitly select Link only (default), Nearby or Everyone. Search
never publishes a room. Both geographic radii constrain matching. Publication
remains v2; v3 reads add only five-kilometre distance bands. Worldwide has no
location/distance. v2 clients retain their exact response shape. Search leases
are at most 45 seconds, further limited by each host's remaining 90-second lease.
The client subtracts transit time and expires each card independently.

Distance bands disclose more relative-area information than a boolean match.
Coarsening, no distance ordering and existing quotas limit precision; repeated
probes and network correlation remain possible. This is discovery, not proof of
physical presence, anonymity or room admission. Same Wi-Fi is not a location fix.

## Verification

All automated location inputs are synthetic. Browser tests use Chromium and a
local Socket.IO server, with two independent contexts for host/guest scenarios.

| Check | Observed evidence |
| --- | --- |
| Full `npm run test:unit` | 950 tests in 120 files passed; includes freshness, revocation, late replies, conservative leases, v3 decoder restrictions and foreground Product renewal. |
| `npm run test:signal` | 101 tests passed; real sockets, authority, opt-out/disconnect, private-room exclusion, worldwide separation and unchanged v2 response shape. Final targeted `nearby.test.mjs`: 9 passed. Socket tests require local network access; the sandbox-only attempt failed with EPERM, then passed with that access. |
| `playwright.nearby.config.ts` | 4 passed: auto app-entry scan, host becoming discoverable later, real audible WebRTC guest energy with zero key requests, draft publication/cancel, Worldwide Join during an unresolved native fix, rapid reconnect/cooldown recovery. |
| `playwright.nearby-product.config.ts` | 2 passed: SDK grant after false Electron permission query; denial latch, deliberate retry, no account requests, foreground renewal checks revocation. These are fake Host fixtures, not device evidence. |
| `playwright.nearby-off.config.ts` | 1 passed: no location access, discovery packets or UI with the operational disable. |
| Adaptive rooms + creation | 5 passed: keyboard focus/Escape, no WebGL, reduced motion/Hide, mobile touch targets/overflow, superseded creation cannot publish an old choice. |
| Arrival + room dock | 6 passed: link sheet and entry controls on mobile/desktop; existing guest dock/audio state at 320/390/430/1440 px. |
| Clear-interface room presence | Passed: private room absent from discovery; offline status and draft preserved. |
| Visual / accessibility | Synthetic mobile/desktop captures inspected; radar and publication sheet axe scans passed. Final mobile action alignment was recaptured and the automatic discovery/audio test passed again. |
| Static / builds | TypeScript, formatting, lint, Web build and frozen Product build passed. Lint retains two pre-existing App.tsx hook warnings; builds retain large-chunk warnings. No new dependency. |

An initial reconnect test exposed a missed cooldown resumption. The coordinator
now subscribes to session transitions and schedules one eligible retry; the
regression test passes. Snapshot expiry uses a non-auto-retry state so containers
without a permission observer cannot accidentally renew forever.

### Captures

[Mobile](assets/W19-automatic-radar/radar-mobile.png) ·
[Desktop](assets/W19-automatic-radar/radar-desktop.png)

## Compatibility and operations

Deploy signaling with v3 reads before clients. New clients against the old server
fail discovery closed. Rolling clients back preserves v2 compatibility; do not
restore an old server that globally enumerates private rooms. No API/contracts,
keys, env variables, origins, storage mounts or Product manifest changes. Keep
single-worker ephemeral signaling and existing rollout/drain rules. Restart ends
active rooms; this PR does not execute a deployment.

Exact fixes stay device-side. Only a coarse cell and chosen radius reach the
room service; no coordinates, wallet or media source enter discovery replies.
No discovery location or permission state is stored persistently. Hiding/reporting
retains the existing page-memory/aggregate-signal limitations. See the updated
[privacy contract](../../../design/dotify-nearby-discovery-privacy.md) and
[deployment configuration](../../../operations/deployment-configuration.md).

## Remaining gates and next step

1. Merge/rebase the #297 prerequisite, then review this continuation against dev.
   CI on the implementation branch must be green before merge.
2. On Product Desktop 0.1.3 and App 0.10.0, verify first grant, automatic fresh fix,
   no repeated prompt after grant, revocation before the next fix, denial without
   prompt loops, foreground return, private default and explicit host re-enablement.
3. Use two authorized physical devices/networks for discover → Join → continuous
   audio, intermediate radii, boundary uncertainty, slow location with Worldwide
   still usable, and actual mobile battery/permission behavior. Automated evidence
   does not resolve the reported physical Host failures by itself.
4. After merge, stage signaling before Web/Product and record served identities.
   #274 stays open until physical-device/privacy and applicable W13/#89 gates pass.

Review `useRoomDiscovery`, `NearbySession`, the v3 search validator/server, then
`RoomRadar`/visibility sheets. Do not turn automatic search into automatic host
publication, reintroduce global enumeration, or present radar positions as a map.
