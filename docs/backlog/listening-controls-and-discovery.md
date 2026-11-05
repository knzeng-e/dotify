# Listening controls and room discovery — next iteration

- GitHub issue: [#388](https://github.com/knzeng-e/dotify/issues/388).
- Priority: P1. Track: Production spine. Phase: Next. Type: Work.
- Workflow status: 0.1.74 delivered; mobile account/discovery/artwork accepted on Polkadot app v0.10.0 (18). Room information placement and system-room context follow-up in review; native rendition still needs matching deployment/device verification.

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
