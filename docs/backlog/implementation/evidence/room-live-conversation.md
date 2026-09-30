# Live room conversation: implementation evidence

Date: 2026-09-30. User-requested UX follow-up, not a new transport sequence.
Branch: `feat/immersive-room-chat`. Base: `7451e8118a70229253142bfa9045835b88b3a497`
(W27 PR #226 merged into dev; its required CI checks succeeded).
Refs #214 and #223; neither issue is closed by this follow-up.
Tested implementation: `a9de67e` (the subsequent evidence commit changes docs
only). Node 22.13.1; repository npm dependencies already installed, unchanged.

## Delivered behavior

- Inline, bottom-aligned live conversation with real sender, Host and You
  attribution; no nested chat bubbles or invented audience metrics.
- Independent history scrolling, explicit new-message catch-up and an unread
  Chat indicator; no announcements from a hidden Chat panel.
- Two quick reactions and the existing six-choice picker beside the player,
  available in Chat, Queue and People; keyboard dismissal and focus return.
- Received-event feedback, bounded effects, local expiry, no retained-feed
  replay when returning to the room, animation preference and reduced motion.
- A single integrated composer; IME-safe Enter, preserved error drafts,
  unchanged 280-character/rate limits, no automatic resending.
- Secondary reactions collapse for the virtual keyboard; primary transport,
  requests, draft preservation and audio-element continuity remain covered.

Architecture, references, tradeoffs and native-Celerity continuation:
[Live room conversation](../../../explanation/room-live-conversation.md).

## Verification

- `npm run test:unit`: 90 files, 728 tests passed, including three new bounded
  reaction presentation tests. Intentional mocked SDK interruption is logged.
- `npm run build`: passed. Existing Rollup annotation, mixed import and large
  chunk warnings remain; no new dependency or lockfile change.
- `npm run test:signal`: 68 passed; existing guest, admission, rate-limit,
  ephemeral social and realtime boundaries retained.
- `npm run test:e2e -- e2e/room-workspace.spec.ts e2e/mobile-accessibility.spec.ts
  e2e/rendered-contrast.spec.ts --workers=1`: 63 passed. Includes four new
  two-client/reaction/history/IME/error scenarios, keyboard transitions,
  accessibility and screenshot-sampled contrast.
- `npm run test:e2e -- e2e/mobile-premium.spec.ts --workers=1`: 14 passed;
  320/390/430/768/1440px, text enlargement to 200%, reduced motion, shared
  playback and no payment on selection.
- `npm run build:product-devnet:frozen`: passed; uses the checked-in catalog
  bootstrap, without upload/deploy or a network refresh of generated data.
- `npm run lint -- --ignore-pattern '.data/**'`: no errors; three pre-existing
  dependency warnings in App.tsx and ArtistShell.tsx. The ignored directory
  contains local generated capture/build artifacts, not application sources.
- Targeted Prettier check, `git diff --check`, and
  `node scripts/backlog-sync.mjs --check --offline`: passed.

### Visual review

These are local synthetic rooms, not Product-device or live-artist evidence:

- [Desktop conversation, 1440px](../../../images/room-live-conversation/desktop-live-chat.png)
- [Mobile conversation, 390px](../../../images/room-live-conversation/mobile-live-chat.png)
- [Reaction palette, 320px and reduced motion](../../../images/room-live-conversation/mobile-reaction-picker.png)

Screenshots were inspected after browser assertions. That review caught a
desktop CSS-specificity collision creating an implicit third player column;
the explicit reaction grid area now spans both columns, with a regression
assertion for its width. No image comparison was claimed for physical devices.

The initial browser run caught the extra reaction strip crowding a 310px
keyboard viewport. The strip now collapses, and the regression asserts the
primary transport's dimensions and position relative to the stage, rather
than the stage's total height including secondary reactions. The header still
compacts as before. The old right-aligned-bubble assertion was replaced with
explicit own-message identity and shared-stream layout checks.

## Evidence limitations and next validation

Automated room tests use local signaling, synthetic audio and separate browser
contexts. They do not prove audible output, Product host compatibility or a
physical iPhone keyboard. No live room, account, payment, deployment or prior
W27 capture was changed. Deployment configuration is unchanged.

Before release, run a physical Product Desktop/iPhone pair on one identified
candidate: join without wallet as a web guest, exchange chat and reactions,
open/close the keyboard, switch all three tabs, pause history and catch up,
enable reduced motion, leave and return to the view, disconnect/reconnect,
and confirm audible playback throughout. Record candidate SHA/CID, host and
OS versions, and actual observations. Do not infer these from browser tests.

Native Celerity delivery remains a separate follow-up under #214, with
acknowledgement/recovery and anonymous guest interoperability before removing
any existing responsibility. This UI does not claim migration or rollout.
