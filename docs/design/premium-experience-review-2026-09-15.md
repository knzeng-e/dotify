# Player presence and premium experience review

Date: 2026-09-15. Reviewed base: `dev` at
`611e4fe3a3ccc1bff5a5abe35f79360d7567996e` (includes PR #166).
Implementation branch: `fix/player-presence-and-mobile-controls`.
Partial [#90](https://github.com/knzeng-e/dotify/issues/90), following the
[product roadmap](../backlog/polkadot-product-readiness-and-killer-dapp-roadmap.md).

## Decision

Make the current player complete and predictable before expanding discovery.
Use the familiar sequence **status, cover, title and artist, progress, controls**
on mobile. Keep Dotify's shared presence, artist access and restrained musical
aura. The Spotify references inform hierarchy, not assets or product behavior.

This pass ships the player correction below and records a critical review of
other surfaces. It does not claim that the broader redesign is complete.

## Delivered

- The room timeline is visible on mobile and desktop, including composing mode.
  Hosts can seek; guests read the existing host clock and cannot seek the room.
- Shuffle, previous, play/pause, next, repeat-this-track and mute remain available
  in the full player. Each button has a 44px minimum target. Active modes use a
  dot and `aria-pressed`, not color alone.
- `Repeat1` now describes the existing single-track loop in both player and dock.
  This adds no repeat-queue behavior. Guest repeat/shuffle controls are disabled;
  the protocol does not broadcast host mode state, so the UI does not pretend
  to display it.
- Listening status sits above the solo cover. Track metadata and controls are
  adjacent below it on mobile; desktop uses a bounded two-column composition.
  The room uses a thumbnail on compact screens and a full-width transport row.
- Song titles use the interface font with a readable scale. The serif remains
  for editorial headings. Solo readiness no longer says "Hosting" before a room
  exists. Room artist/support actions no longer run together on desktop.
- Access facts follow the solo controls. Redundant ready badges are suppressed
  in rooms; access gates and host unlock actions remain in their existing flow.
- Transport rules have one owner instead of conflicting hiding rules across
  three responsive stylesheets. No audio source, controller or room is remounted.

## Implementation and trust boundaries

`PlayerView` composes metadata, access gates and `PlayerTransport`. The latter
renders values and delegates actions to the existing `usePlayback` controller.
That controller still owns seek permission, local repeat, shuffle, pause and the
room clock. `PersistentAudio` and WebRTC signaling are unchanged. Layout remains
CSS-driven; there is no resize-dependent player instance or new media element.

`player-presence.css` owns transport layout and the cover/metadata grid. The
existing `room-workspace.css` still owns the bounded conversation and keyboard
viewport. Compact layouts reduce artwork and spacing, never hide playback modes
or the timeline. The minimal navigation dock still opens the complete player.

No contract, payment, key-delivery, persistence, telemetry, environment or
production configuration changes. A payment record is not evidence of listening
access. Guests continue receiving the room stream without the protected key.
Rollback is the presentation commit; no migration is needed.

## Review method and limits

Reviewed the supplied room recording and Spotify screenshots, then inspected
Music, Rooms, You, artist profile, solo player, host/guest room and composing
states using deterministic fixtures at phone and desktop sizes. Artist
onboarding/studio, wallet connection and access flows were also reviewed in
source and covered by the existing integration suite; they were not manually
validated against a live wallet or the native Product host.

Evidence uses synthetic tracks and reduced motion. Full-page discovery captures
show fixed navigation at the current viewport position; that is a capture
artifact, not proof that navigation sits halfway down the actual page. Touch
bounds collected by the tests are review hints, not an accessibility verdict.
For example, the 390px fixture measures catalog artist buttons at 30px high and
the connection button at 41px; desktop dock secondary buttons measure 39px.
These are follow-up targets for the 44px product guideline, not automatic WCAG
failures (inline links, spacing and actual composite hit areas need review).
No user research, contrast certification, performance benchmark or physical
Safari keyboard validation is claimed.

## Critical review and recommended next PRs

| Priority / PR | Finding and consequence | Concrete change | Acceptance and code boundary |
| --- | --- | --- | --- |
| Delivered / PR 1 | Mobile CSS hid room progress and playback modes; cover, song and controls felt separated. | Shared complete transport and compact stage, as above. | 320px phone through desktop, landscape, host/guest, keyboard and access regressions. `PlayerView`, `PlayerTransport`, player styles. |
| P1 / PR 2: Discovery hierarchy | Music combines an editorial heading, a large featured track, presence counts and the catalog. On desktop the usable catalog is below the large feature; on mobile the feature repeats the catalog farther down. Long featured titles break mid-word. | Keep one compact editorial introduction, one primary horizontal catalog with "Show all", and a live-room strip when there is real activity. Reduce or remove the duplicate featured stage. Preserve search, row position and focus when returning from a player or artist. | At 390px and 1440px a track and its primary action appear in the first usable viewport. Back returns to the same query and track. Long French titles remain readable. `ListenView`, `StageRail`, `CatalogBrowser`, navigation state. |
| P1 / PR 3: Rooms and arrival | An empty Rooms page presents counts, service status, an empty panel, a host panel and a distant join-code form. The person arriving with a code has to scan too much. | Put the code/link action near the top; use one empty-state invitation with one host action. Collapse technical availability into an actionable status only when degraded. Keep real room cards and the 2D path primary. | An invited listener can join from the first mobile viewport without a wallet. Loading, zero rooms and offline remain distinct. `RoomsView`, room discovery renderer, existing join flow. |
| P1 / PR 4: Artist and support | Artist profiles place a general "Why it matters" panel ahead of releases. You repeats zero-count support panels and exposes hashes in its populated support rows. These surfaces explain infrastructure before helping someone act. | Bring releases and actual live sessions beside the artist identity. Move generic explanation to secondary help. Give disconnected You one calm invitation; show verified support records with artist/track identity first and proof details on demand. | Support shows price, actual split and confirmation state before/after payment. Pending or unverified support never becomes playable access. `ArtistProfileView`, `YouView`, wallet and access components; keep Classic negative tests. |
| P1 / PR 5: Interaction and icon contract | Lucide provides a coherent base, but sizes, hit areas and disabled-state explanations vary. The connect/power icon is prominent before listening; catalog artist links and compact actions deserve a target audit. | Formalize icon sizes (18 secondary, 20 skip, 24 primary/navigation), 44px button targets, focus rings, text labels for unfamiliar actions and consistent disclosure icons. Keep connection secondary until the intended action needs it. Use semantic classes rather than `nth-child` hiding. | Keyboard-only path, visible focus, screen-reader names, 200% text sizing and long translations pass. Explicitly validate muted/disabled text over every aura; do not infer contrast from screenshots. Token/component changes, not an app rewrite. |
| P2 / PR 6: Artist workspace | Onboarding contains several philosophical/proof sections before the registration steps; publishing and recovery have important technical states that listeners do not need. | Use a short artist promise and a task-oriented checklist: identity, rights/consent, release, price/access, publish, verify. Retain quarantine and recoverable transaction/read-back failures. Put technical diagnostics in the existing advanced surface. | Keyboard and mobile publishing remain recoverable after upload, signature rejection and delayed registry confirmation. No automatic signatures or weakened rights consent. `ArtistOnboarding`, `NewReleaseTab`, existing publish controller. |

Ship PRs 2-5 incrementally, measuring successful task completion rather than
adding new decorative surfaces. PR 6 can follow once the listener path is stable.
The existing Galaxy flag remains optional. Queue/nearby work previously merged
into the old feature branch is not silently included here; integrating it needs
its own review against current `dev`, real room authority and privacy acceptance.
Community memory remains explicit, reversible and opt-in; this pass adds none.

## Visual system to retain and refine

Keep the dark blue foundation, cyan actions, restrained pink artist accent and
existing aura. Music covers should supply character; reserve strong glow and
large editorial type for a small number of moments. Use typography and spacing
before adding another border, panel or pill. Consistency means the same control
has the same meaning and hit area across shell, player and room; it does not
mean forcing the conversation into a desktop dashboard on a phone.

On very short keyboard viewports, the current composer and complete transport
leave little readable history. That tradeoff is explicit: input and sound stay
available. A later compact playback disclosure is worth testing only if it keeps
the current track, progress and an immediate play/pause action visible. Do not
solve it by restoring the hidden timeline or by making a second audio player.
Native host banners consume additional space outside the web layout; test that
host's insets and focus behavior on a real device before changing the web shell.

## Validation

| Check | Result and scope |
| --- | --- |
| `npm run test:unit` | 450 tests in 59 files passed. |
| `npm run test:e2e -- --workers=1` | 53 Chromium tests passed: public/protected access, publishing, room join, actual Web Audio pause/resume, seek/late guest clock, keyboard drafts, catalog and player layouts. |
| WebKit configuration, one worker | 13 passed: catalog, full player and synthetic visual-viewport keyboard layouts. Desktop WebKit is not a physical iPhone or Product-host result. |
| Final layout rerun | 20 Chromium scenarios passed after the desktop artist-action spacing adjustment. |
| Player geometry | Four sizes: 320x568, 390x844, 844x390, 1440x1000. Visible timeline, non-overlapping transport targets, repeat drives the audio element loop, no document horizontal overflow. |
| Lint / format | Passed; three existing hook-dependency warnings in `App.tsx` and `ArtistShell.tsx`. |
| Web and Product DevNet builds | Passed. Existing large-chunk warnings remain. Product build uses the checked-in catalog bootstrap; no catalog regeneration or deployment. |

An early targeted browser run intermittently failed the Web Audio RMS assertion.
The baseline comparison, isolated current run and complete final Chromium suite
passed. No audio assertion was relaxed and no playback workaround was added.
The test now attaches meter/context/track state on failure for diagnosis. This
is not proof that every device-specific audio issue is solved.

Release acceptance still needs the user's iPhone: open a room, seek as host,
join as listener, pause/resume repeatedly, type/send a long message, change tabs,
dismiss the keyboard, rotate, and return from background. Repeat in ordinary
Safari and the Product host. Check actual audible output and progress together.

## Captures

Synthetic fixture artwork, not the supplied Spotify images:

- [Solo mobile](../images/player-presence/solo-mobile.jpg)
- [Room mobile](../images/player-presence/room-mobile.jpg)
- [Room desktop](../images/player-presence/room-desktop.jpg)
- [Composing viewport simulation](../images/player-presence/composing.jpg)
- [Music desktop review](../images/player-presence/music-desktop.jpg)
- [You mobile review](../images/player-presence/you-mobile.jpg)
