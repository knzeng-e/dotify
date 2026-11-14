# Listening controls and room discovery — next iteration

## Matching client delivery, 2026-11-14

[Web/Product 0.1.84](implementation/evidence/product-0.1.84-rollout-2026-11-14.md) delivers bounded artwork return
recovery, visible support copying and optional About Host labels. Delivery is
independently verified; immediate/repeated solo/Room locks, rapid changes and
matching failure reports remain open. Earlier candidate records retain their
original scope and do not prove the reported native failure's cause.

## Immediate-lock observation after 0.1.83 delivery

The owner reports a blank cover after a requested signature and immediate phone
lock on the verified 0.1.83 managed-AAC client. Its timing report is lost after
restart. A [separate successful control](implementation/evidence/system-artwork-owner-control-2026-11-13.json)
registers PNG metadata in 20 ms and is explicitly confirmed to show the cover and
sound. It cannot establish the missing-cover cause or native display latency.
Retain this trigger and collect a matching failed-attempt report before the next
reload; #388 remains open. Pause follow-ups are handled under #395 first.

## Report collection clarity candidate

The owner's failed-attempt report was lost after restarting, after copying app
version details instead of listening observations. About now exposes **Copy support
report** directly, explains copying before reload, and groups version-only copying
under **Technical details**. The existing local serializer, manual clipboard action
and selectable fallback remain; no persistence, automatic transmission or playback
change is introduced. This supports #388 collection, not native artwork acceptance.
The [device guide](../how-to/check-system-artwork.md) distinguishes current and older
client navigation; [commit-bound evidence](implementation/evidence/listening-support-clarity-2026-11-13.md)
records browser and build checks. Review and matching delivery remain ahead.

## Matched artwork timing candidate — 2026-11-13

The #448 cache/prepared-PNG correction is merged into dev, with native acceptance
still open. The existing local support report now distinguishes image acquisition, decode,
PNG composition, prepared reuse and metadata publication, with bounded,
identifier-free observations. [The reference](../reference/system-artwork-observations.md)
owns fields/limits; [the device guide](../how-to/check-system-artwork.md) keeps
actual cover appearance and sound separate from registration. Cancellation and
rapid-track metadata ownership retain authority. This prepares matching #388
acceptance without claiming that the intermittent iPhone delay is fixed or
starting a new recovery/rollout operation. [Source-bound evidence](implementation/evidence/system-artwork-observations-2026-11-13.md) also records a reproduced partial-Host metadata rejection and its isolation from player cleanup. Prior dated results retain their scope.

## Bounded artwork return recovery candidate — 2026-11-13

A controlled browser decode failure leaves dev's current metadata owner on URL
fallback even after a foreground return. The [bounded recovery contract](../reference/public-artwork-cache.md#recovery-on-foreground-return)
adds one event-driven attempt for that same owner, without Play/Pause, audio
loading or repeated retry loops. Pending successful PNG work is preserved;
disconnect and replacement ownership still cancel publication. See
[the source-bound evidence](implementation/evidence/system-artwork-return-2026-11-13.md).
This is a demonstrated local failure path, not the diagnosed cause of the owner's
immediate-lock iPhone report. The later owner-uploaded report is a successful
cover/sound control. Matching delivery and actual solo/Room locks remain open;
Pause authority is handled independently in #459. No deployment is performed.

## Artwork delivery and prepared-PNG candidate — 2026-11-13

A controlled regression demonstrates that a stalled Cache Storage write can
withhold an already downloaded cover. The candidate bounds optional disk lookup,
returns the in-memory image before persistence and limits background storage to
one writer without a queue. A bounded page-memory cache also lets a reopened
metadata owner publish its already composed PNG immediately, while taking the
current title/artist and preserving cancellation. See the [cache contract](../reference/public-artwork-cache.md)
and [source-bound evidence](implementation/evidence/public-artwork-persistence-2026-11-13.md).
This is a narrow #388 correction available for offline review while independent
recovery is coordinated; the delivery/acceptance order remains #407 → #395 → #388.
It does not establish the cause of the reported iPhone delay. Prepared-PNG reuse
is a tested code candidate; matched timing reports, rapid changes and repeated
physical locks remain open.

## Remaining artwork reliability, 2026-11-08

The owner confirms intermittent late lock-screen cover display in **both solo
and Room** on the current delivered client. The two screenshots are not a measured
single loading timeline. Shared image preparation/reuse and metadata ownership
need diagnosis; no root cause or fix is claimed yet. Follow the
[execution plan](implementation/listening-and-publication-readiness.md) after the
publication and Room-startup slices, with #87 public-artwork delivery. Preserve
the current cover and bottom-right Dotify badge, audio independence, stale-result
cancellation and physical native acceptance. #388 remains open.

- GitHub issue: [#388](https://github.com/knzeng-e/dotify/issues/388).
- Priority: P1. Track: Production spine. Phase: Next. Type: Work.
- Remaining scope: account/discovery and the refined Dotify badge are delivered. Diagnose intermittent delayed solo/Room system artwork reported on app 0.10.0 (20) / Runtime 0.26.0; native navigation and repeated lock/track-change acceptance remain. Project 5 owns workflow status; scheduling is Next after #395.

Owner feedback during Product 0.1.73 acceptance, 2026-11-05. The owner confirms audible stop on disconnect and explicit recovery on Web, Polkadot app Desktop and mobile. Three usability gaps should be addressed in the next iteration alongside Bulletin stabilization.

Local scope: `docs/backlog/listening-controls-and-discovery.md`. Follow-up to delivered W28/#223 and W35/#290; related reliability/access work remains W33/#288. The [client implementation evidence](implementation/evidence/listening-controls-and-discovery-2026-11-05.md) records the candidate and controlled tests. Web/Product 0.1.74 are delivered with [verified rollout evidence in #390](https://github.com/knzeng-e/dotify/pull/390). The owner confirms direct mobile account/disconnect access, room release/artist inspection while listening, and lock-screen cover/controls. Exact native skip behavior remains distinct from the observed forward/backward glyphs.

## Work and acceptance

- [x] **Account control in the mobile player.** Make the current account and Disconnect reachable from the player without returning to Music. Reuse the existing account/session action and incomplete-sign-out recovery; disconnect must retain the verified protected-audio stop and explicit reconnect behavior. Keep controls visible with safe areas, enlarged text and narrow screens, with clear keyboard/screen-reader labels. Do not replace room leave with account disconnect.
- [x] **Current-track discovery inside the room.** Make the actual room track's cover/title/artist and existing release/artist details accessible to hosts and listeners without leaving the room or interrupting its audio. Use the current room identity, not stale personal selection. Guest discovery must work without wallet/payment/key requests; opening details cannot change the queue, membership or grant playback control. Track changes must update or clearly identify the displayed release. Unknown/missing metadata needs an honest empty state.
- [ ] **Lock-screen artwork and track navigation.** Investigate the shared Media Session and native Host path; display the actual current cover, including generated Dotify artwork, with title/artist while backgrounded or locked. Prefer previous/next track actions to the currently observed ±10-second controls when queue navigation is allowed. Preserve foreground seeking, queue order and access checks; room guests must not gain host transport authority. Clear stale metadata/actions on stop/disconnect and use a truthful state at queue boundaries. Record limitations per OS/Host; application action registration alone does not prove native button layout or artwork rendering.

## Implementation and validation

Start each implementation branch from current tested `dev`, inspect the existing account controls, `PlayerView`, room track presentation, `PlaybackProvider`, `useSystemMediaSession` and `systemMediaSession`. Reuse the current release-detail/artwork services and shared playback ownership. Do not grow `App.tsx` or add a second player/session authority. Keep the three acceptance groups distinct in the evidence; split follow-up implementation PRs if native capability investigation warrants it.

Verify focused account-access/source teardown regressions; room host/guest detail opening without playback interruption or privileged requests; artwork resolution and system action registration/cleanup with meaningful controlled tests. Check narrow mobile widths, safe areas, text enlargement and desktop layout. Then record physical lock-screen artwork and previous/next behavior per browser/OS/Polkadot app version; unknown or unsupported native behavior stays explicitly unverified.

No service/storage-policy/key/contract/payment redesign, new musical upload, production deployment or Capacity integration is authorized by this planning ticket. Keep existing protected release, receipts and renewal obligations. Signed unentitled access/account switching, room-guest silence, dependency conservation and off-volume recovery remain separate production gates. Implementation and publication follow normal review and rollout.

## Mobile acceptance and refinement, 2026-11-05

The owner confirms the three requested surfaces on Polkadot app **v0.10.0 (18)**:
account/disconnect directly from Player, room release/artist details without
interrupting audio, and lock-screen artwork/controls. The supplied iPhone
screenshot displays title/artist/cover and backward/forward glyphs; it does not
independently prove which native command each glyph invokes. Browser tests bind
`previoustrack`/`nexttrack` and clear relative-seek actions.

Requested refinement: place the information icon beside the track title rather
than over the cover. Add the dock's observed room status/count/host context and
Dotify recognition to system presentation. The client candidate supplies ordinary
title/artist, a room context album field, and a separate framed room artwork PNG
with the shared Dotify mark/footer. It retains original cover assets and audio
ownership. Counts are last observed; reconnect hides an uncertain count. Native
layout, command glyphs, metadata display and background refresh remain controlled
by the OS/Host, not a reproducible in-page mini-player. See the
[implementation and evidence](implementation/evidence/room-system-context-2026-11-05.md).
The candidate is not deployed. Original #388 acceptance is recorded, with these
new physical checks and native navigation behavior still open.

## Simplified system signature candidate, 2026-11-06

The owner finds room text too small on native thumbnails and requests Dotify
recognition in solo as well as Room. The [shared frame candidate](implementation/evidence/room-host-lifecycle-2026-11-06.md#one-recognizable-system-cover-in-solo-and-room)
removes room counts/status/host text from system presentation, uses the original
petals around a rounded cover with the compact Dotify mark, and preserves normal
title/artist attribution. Solo and Room now use the same PNG path and stable
Dotify label; room count changes do not repaint artwork. Original covers, public
cache and source/disconnect cancellation stay intact. Matching native appearance
and command layout remain OS/Host-dependent acceptance, not browser proof.

## Cover-first signature refinement, 2026-11-06

After inspecting the deployed artwork on the phone, the owner requests removal
of the decorative outer petals and a more visible bottom-right Dotify logo.
The [new candidate and preview](implementation/evidence/system-artwork-signature-2026-11-06.md)
retain the complete original logo inside one larger opaque badge, enlarge the
cover and use a thin neutral outline for light/dark contrast. Solo and Room use
the same composition. This is a visual candidate, not another deployment; native
layout and previous/next command acceptance remain separate #388 gates.

## Listening-session refinement candidate, 2026-11-07

The owner requests all four proposed refinements: an anchored solo-to-Room transition, quieter Room hierarchy, artist-first release discovery and consistent motion/return. The same candidate confirms Room exits, lets the host continue solo, and limits resume/progress to an open paused player. Participant-arrival animation is deferred. Matching physical acceptance remains open.
See [design and validation](implementation/evidence/listening-session-continuity-2026-11-07.md). No deployment is part of this change.

The same candidate incorporates the two November 7 recordings: a stable listening
footer across Queue, Room queue and release discovery; compact story preview;
simpler current-track Room setup; and readable conversation with a bounded
multiline editor while the keyboard is open. Paragraph preservation includes a
bounded signaling normalization change; matching rollout and real keyboard
acceptance remain open. See the evidence above for boundaries.

## Matching delivery, 2026-11-07

[Web/Product and signaling 0.1.79](implementation/evidence/product-0.1.79-rollout-2026-11-07.md) now deliver the reviewed candidate from `c656992c`, with both source CIs and independent readback green. Room exit/source-lifecycle and multiline chat behavior, plus the simplified system badge, still require matching physical phone acceptance. The deployment record preserves exact bounded writes, one-off retention, service restart and rollback boundaries; this issue remains open.

## Intermittent system artwork on both modes, 2026-11-07

During 0.1.80 follow-up on iPhone app 0.10.0 (20) / Runtime 0.26.0, the owner
reports that locked-screen artwork is sometimes missing before it appears later.
The owner explicitly confirms solo and Room. Supplied captures show a placeholder
and later a cover with the bottom-right Dotify badge; no precise delay or one
continuous playback timeline is established. See the [matching delivery
feedback](implementation/evidence/product-0.1.80-rollout-2026-11-07.md#intermittent-lock-screen-artwork--2026-11-07).

Both modes use the shared Media Session image path, which initially supplies
public URLs and resolves the branded PNG asynchronously. Diagnose original-image
availability, PNG readiness/reuse, metadata ownership and native display before
attributing the failure to a particular layer. A correction must keep artwork
current, preserve cancellation on disconnect/selection changes, remain bounded
to public cover data and never block audio on image loading. Keep #388 open;
this observation is not a deployed fix.
