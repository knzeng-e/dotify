# W28 - Mobile premium listening experience

Copy this entire file into an agent working in the Dotify repository, or use the
VS Code prompt at `.github/prompts/dotify-mobile-premium-experience.prompt.md`.

## Agent assignment

Implement **W28** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`,
and the files below before changing code. Follow the common execution contract,
including the evidence/handoff record. Do useful authorized work through a
reviewable PR; do not stop at a plan.

- Branch: `feat/mobile-premium-experience` created from the latest tested
  `origin/dev` when work starts.
- Dependencies: W10, W21, W22, W23, W24, W25, and the merged room dock/live
  context fixes.
- Release stage: Pilot polish after the first release branch.
- Existing issue: #223.
- Product purpose: mobile should make Dotify feel like shared musical presence,
  not a crypto dashboard or a generic streaming clone.

## Outcome

Turn the current premium design review into a shippable mobile-first experience:
a clearer Music home, native-feeling track rails, a reliable live/direct
mini-player, an immersive full player, and a room surface that keeps listening,
chat and presence together.

## Read first

- `docs/design/mobile-premium-audit-2026-09-29.md`
- `docs/design/ux-design-audit-2026-09-17.md`
- `docs/backlog/implementation/W10-adaptive-design.md`
- `docs/backlog/implementation/W21-first-listening-screen.md`
- `docs/backlog/implementation/W22-room-hosting-clarity.md`
- `docs/backlog/implementation/W23-player-support-clarity.md`
- `docs/backlog/implementation/W24-visual-system-contract.md`
- `docs/backlog/implementation/evidence/room-dock-live-context-2026-09-22.md`
- `web/src/components/PlayerDock.tsx`
- `web/src/components/PlayerTransport.tsx`
- `web/src/components/CatalogBrowser.tsx`
- `web/src/components/TrackArtworkButton.tsx`
- `web/src/components/RoomChat.tsx`
- `web/src/components/RoomRequests.tsx`
- `web/src/components/SkyOfRooms.tsx`
- `web/src/features/player`
- `web/src/features/rooms`
- `web/src/styles`

Paths are starting points from the reviewed dev snapshot; locate moved files and
inspect current code rather than recreating old modules.

## Work sequence

1. Audit the current mobile states at 320, 390 and 430 px before changing code:
   Music home, direct player, listener returning from a room, host room, guest
   room, chat keyboard focus, track card hover/touch behavior, and artist/support
   sheets.
2. Fix the mini-player state contract so live room audio always renders the
   current room track, room context, people count and room return action. Direct
   listening must keep the simpler direct-track variant. Add focused tests around
   stale-track prevention.
3. Refine Music home discovery: compact the top entry area, use touch-native
   horizontal rails, remove persistent mobile arrows, and keep cards to cover,
   title and artist by default. Move access/support/rights details behind an
   explicit sheet or secondary control.
4. Refine the full mobile player: artwork-led layout, visible seek bar, previous
   / play / next as primary actions, secondary repeat/shuffle/queue/support
   actions, no cover/seek/control overlap, and no missing repeat affordance.
5. Refine room mobile layout: compact live header, persistent room player,
   Chat/Queue/People panels, keyboard-safe composer, and clear reconnect /
   degraded states. Do not require wallet, payment, signature or personhood for
   room guests.
6. Apply the same interaction rules gracefully on desktop: centered hover play
   CTA on track cards, efficient rails or grids, elegant full player, and a room
   layout that uses width without becoming a dashboard.
7. Preserve W13 and Product invariants. Do not add new payment policy, location
   collection, fabricated counts, unsupported Web3 claims, or hidden demo
   fallbacks.

## Acceptance and meaningful verification

- Mobile 320, 390 and 430 px screenshots show Music, full player, Rooms, host
  room, guest room, keyboard-focused chat, and artist/support sheets without
  overlap.
- Desktop 768 and 1440 px screenshots show no regressions in Music, full player
  and room layout.
- Returning from a room to Music keeps audible room playback and shows the
  correct live room mini-player identity.
- Track cards show no persistent mobile arrows; desktop hover shows only the
  hovered card's play CTA.
- Previous and next remain smooth enough for the pilot path, with existing
  prefetch/readiness behavior reused where available.
- 200% text, reduced motion, keyboard focus and touch targets are checked.
- Relevant unit tests, lint, build and targeted Playwright/manual screenshots
  are recorded.

Run the relevant command groups in common.md. Record commands, results, actual
tested commit, and untested environments.

## Scope boundary

No new UI framework, no native app packaging, no payment-model redesign, no
location features, no Product SDK transport migration, and no broad `App.tsx`
growth. Split follow-up PRs when changes become too large for one review.

## Release condition

This is not a W13 pilot gate by itself. It should land only when it improves
the mobile pilot experience without destabilizing playback, rooms, access or
Product fallback behavior.

## Handoff

Write `docs/backlog/implementation/evidence/W28.md` using
`evidence-template.md`. Include the base SHA, implementation SHA, PR, captures,
known risks, test results, and recommended follow-up split. Keep Project 5 as
the workflow-status source.
