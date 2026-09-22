# Room playback synchronization evidence

- Scope: partial #89 / [W09](../W09-room-resilience.md), addressing host/guest
  progress disagreement and repeated audio fragments during host pause.
- Branch: `fix/room-playback-sync`, independent of experience PRs #163 and #164.
- Reviewed base: `origin/dev` at `f6e6ee78645080cded22eafc1e45075cc9027016`.
- Implementation: `660c24576814b0aa7a2ddca6584bb78892c761a8`.
- PR: [#165](https://github.com/knzeng-e/dotify/pull/165), ready for review;
  Project 5 fields mirror #89, status In Review, assignee knzeng-e.
- Architecture: [shared room clock](../../../explanation/room-playback-synchronization.md).

## Evidence

All commands run from `web` on local macOS with Node 22 and Chromium.

| Check | Result and boundary |
| --- | --- |
| Before-fix room sync regression | Failed: late guest showed 9.6% when host was paused at 50% of a 60-second fixture. |
| `npm run test:unit` | 439 tests across 56 files pass, including four clock regressions. |
| `npm run test:signal` | 56 tests pass, including fresh join state, host-only authority and track reset. |
| `npm run test:e2e -- --workers=1` | 30/30 pass: room access, source switching, autoplay recovery, artist publishing, discovery, mobile shell, and both new synchronization scenarios. |
| Focused final sync run | 2/2 pass with a 390×844 touch/mobile guest and desktop host in the late-join/seek/pause case; Web Audio case on desktop. |
| Visual inspection | Captured and inspected `guest-paused-mobile.png` and `host-paused-desktop.png` under the room-sync Playwright output. Both show 0:45 / 1:00 while paused; guest shows Host paused. Existing mobile layout density is handled separately in PR #163. |
| First concurrent E2E run | 28 pass / 2 fail (artist consent checkbox did not stay checked; protected room listener roster disappeared). Both unchanged tests passed in the complete serial rerun; root cause of these intermittent failures is unproven. |
| Web Audio regression | Generated 440 Hz tone crosses real loopback WebRTC; receiver RMS > 0.02 playing and < 0.0001 paused over three cycles. Local guest pause survives host seek/resume; receiver stream identity retained. |
| `npm run lint` | Pass, with three existing React hook dependency warnings in App.tsx and ArtistShell.tsx. |
| `npm run build` | Pass (TypeScript + ordinary Vite). Existing large bundle warnings remain. |

`vite build --config vite.product.config.ts --mode product-devnet` passes
with the existing bundle-size warning, following the shared TypeScript build.
It does not regenerate the catalog bootstrap or contact a live catalog.
`npm run fmt:check` and `git diff --check` pass.

## Operational and security boundaries

No secrets, contracts, access-policy, persistence, or environment changes.
Host-only publication and guest key/source isolation stay enforced. A stale
playing clock now silences output after 2.5 seconds and recovers on fresh state.
The protocol shape is compatible, but signaling and both frontend surfaces must
be updated and clients refreshed for the full behavior. See the updated
[runbook](../../../operations/deployment-configuration.md).

## Remaining evidence and handoff

Physical iOS/Android, Product WebViews, independent networks, forced TURN,
background/lock-screen behavior, and acoustic latency remain untested here.
Clock interpolation does not eliminate WebRTC/network buffering. Keep #89 open
until its device/network acceptance requirements have independent evidence.
The next check is a two-device pause/seek/resume session, including foreground
recovery, using the runbook. No merge or production deployment is part of this
change.

## PR #165 review follow-up

Reviewed head: `da0c61b73dcb4b120ffb51cdd4635f30b7e91b7a`.
Both open review findings were confirmed and addressed:

- [P1: forced transitions](https://github.com/knzeng-e/dotify/pull/165#discussion_r4008445410):
  `publishPlayerState` uses normal Socket.IO emission for forced transitions
  while connected; periodic samples remain volatile. Disconnected calls do not
  enter the reconnect buffer. Regression tests exercise the installed Socket.IO
  client's actual volatile-discard logic at a simulated non-writable transport
  boundary, including a paused seek with no later sample.
- [P2: stale join state](https://github.com/knzeng-e/dotify/pull/165#discussion_r4008445416):
  join snapshots carry an optional server-derived `stale` marker. The guest
  retains "Syncing with host" and a held position until fresh host state arrives.
  Real paused snapshots remain distinguishable. Host-supplied markers are
  stripped; `playing: false` preserves silence for older clients.

Before correction, the targeted suite failed on both the dropped forced packet
and lost stale marker (2 failed, 6 passed). After correction, 443 unit tests
across 57 files and 58 signaling tests pass. Lint passes with the same three
existing React hook dependency warnings. No dependency or access-policy change.
The full serial Chromium suite passes 30/30. Ordinary and Product DevNet
builds, formatting and whitespace checks pass, with existing bundle warnings.
Product used direct Vite after shared TypeScript checking; no catalog bootstrap
regeneration. Physical-device limitations above remain unchanged.
