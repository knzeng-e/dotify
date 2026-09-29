# Mobile premium audit completion

Owner-authorized scope: the six original audit screenshots supplied on
2026-09-29 and the subsequent recommendations, not only the shorter W28 brief.

Branch: `feat/mobile-premium-audit-complete`.
Draft PR: [#225](https://github.com/knzeng-e/dotify/pull/225), targeting `dev`.
Issue: [#223](https://github.com/knzeng-e/dotify/issues/223), referenced rather
than closed because review and required environment gates remain.
Project 5 metadata was read back: In Progress, Work, Next, Design record, P1,
and the W28 backlog path. Assignee `knzeng-e`, existing audio/rooms/frontend/P1/
dotify-backlog labels, no applicable milestone and no requested reviewer.

Initial base: tested dev `74f391d`, then existing W28 through `dfed121`
preserved unchanged on `feat/mobile-premium-audit-complete`. During this work,
the owner merged PR #224 as `1d1f217`; its tree is identical to `dfed121`.
The new dev CI reported a timeout in the 390 px capture journey (135/136
browser tests passed); Web, Product, API, signaling, contracts and hygiene
passed. It is not described as a green release base. This work does not merge
or deploy a PR.

## Acceptance ledger

Unchecked items are not complete. Browser fixtures cannot prove physical-device
audio or Product-host behavior. Evidence must identify the tested commit.

- [x] Compact mobile navigation and dock, safe-area CSS and browser reachability checks; physical safe areas remain unverified.
- [x] Live/direct source remains correct across navigation and host track changes.
- [x] Real room avatar preview, observed count, reconnect state, room return.
- [x] Contextual room header replaces global mobile header; share sheet owns code/QR.
- [x] Accessible playback modes at 320 px; no repeat/shuffle hidden to pass layout tests.
- [x] Personal pause is distinguished from host transport; mute is secondary.
- [x] Room Chat/Queue/People, request count, persistent drafts, keyboard-safe composer.
- [x] Rooms entry prioritizes active rooms; code/link entry is secondary; galaxy optional.
- [x] One-action link entry where possible, without wallet/signature or fabricated identity; first-time name and autoplay boundaries below.
- [x] Music first viewport and smaller native rails; no mobile arrow controls.
- [x] Live, recent releases and listening history sections use actual available data only.
- [x] Artwork/title/artist cards; hover/focus play and explicit release information.
- [x] Complete release sheet: access, price, beneficiaries, rights and provenance.
- [x] Immersive full player with seek, previous/play/next, queue/support/details.
- [x] Contextual support sheet; suggested and custom gifts reuse existing payment rules.
- [x] Gift, access purchase, payout and entitlement remain distinct facts.
- [x] Artist workspace organized around overview/releases/earnings/rights and one main action.
- [x] Restrained visual surfaces, consistent radii/type/status roles, desktop parity.
- [x] Cover-derived tint with measured contrast and graceful fallback; reduced motion.
- [x] Browser back/close/focus restoration for contextual sheets without stacked dialogs.
- [x] 320/390/430/768/1440 captures, 200% text, simulated keyboard, touch targets and contrast.
- [x] Relevant unit/integration/browser tests, lint, formatting, Web and Product builds.
- [x] Physical iPhone/Android and supported Product smoke explicitly unverified, with required steps below.
- [x] Canonical audit/evidence/public documentation and reviewable draft PR handoff (#225).

## Delivery slices

1. Navigation and rooms: shell height, roster, contextual header, sharing,
   transport, requests and entry ergonomics.
2. Discovery and player: music density, truthful shelves, contextual sheets,
   playback continuity, history and cover tint.
3. Artist and support: task navigation, release rights, contextual gift flow,
   visual contract, complete acceptance checks and handoff.

No new payment policy, contract migration, secret, fallback signer, guest key
access, fabricated popularity, or unverified Product capability is authorized
by this presentation work.

## Working checkpoint: 2026-09-29

This historical checkpoint records partial implementation, not final acceptance.
The changes were still in the working tree at this point. Later sections record
commit-specific verification; do not add the overlapping test counts together.

Implemented in this checkpoint:

- Smaller navigation/dock dimensions, real roster previews, explicit personal
  pause, room context header, share sheet and a request-count badge.
- Playback modes remain available at 320 px. Room controls use one line when
  space permits; a container query restores two rows under enlarged text.
  Composing temporarily hides header navigation/presence while keeping Done,
  playback, tabs and the composer reachable.
- Read-only release details from catalog cards and the full player: access,
  published payment split, copyright boundary and collapsed record references.
  Opening details does not select audio, request a key or initiate payment.
- Active rooms precede code/link entry in the DOM and keyboard order.

Validation so far:

- `npm run test:unit -- src/features/rooms/roomState.test.ts`: 15 passed.
- `npm run test:e2e -- e2e/player-presence.spec.ts e2e/room-workspace.spec.ts
e2e/mobile-premium.spec.ts e2e/room-dock.spec.ts --workers=1`: 40 passed,
  including 320/390/430/768/1440 captures, 200% text, keyboard geometry,
  host/guest navigation, draft retention and no payment from release details.
- Earlier runs exposed actual chat-space and enlarged-text overlap regressions;
  both were corrected. One 1440 capture exceeded 30 seconds during a concurrent
  build; the final serial run passed without increasing the timeout.
- Web build passed after release-sheet integration. Final all-files Web/Product
  builds remain to run after the rest of the audit is implemented.
- Lint with the existing generated `.data/**` directory excluded: zero errors,
  three existing hook warnings in App.tsx and ArtistShell.tsx.
- Representative room/player/dock screenshots inspected at 320, 390 and 1440.
  Full checkpoint artifacts retained in `/tmp/dotify-mobile-audit-checkpoint`.

## Studio, discovery and support checkpoint

The following working-tree changes extend the preceding checkpoint:

- Overview/Releases/Earnings/Rights task navigation, with keyboard navigation
  and the existing publication, payout and rights controllers preserved.
  Release records and settlement explanations are collapsed; unavailable
  balances and recovery commands remain visible. Studio task headings use
  interface typography rather than oversized editorial headings.
- Suggested and editable gifts in a contextual full-player sheet, with a
  verified receiving account and explicit gift/access distinction. Closing a
  pending gift preserves the operation and reopens its status or receipt,
  without a second transfer. The existing recovery journal is unchanged.
- Recently played uses actual local/host media playback, not selection. It is
  in memory, clearable and omitted when empty. Remote guest listening is not
  recorded in this shelf; no ambiguous cross-runtime hash matching is used.
- The new-releases label requires real registration chronology. Existing
  catalog chronology is retained rather than stripped from the records.
- Cover-derived hue uses a bounded, anonymous thumbnail sample and a stable
  fallback on CORS, decoding or timeout failures. Text tokens are unchanged;
  reduced motion is respected. Product-host artwork sampling is unverified.
- Shared release information is available from the artist catalog as well as
  music cards and the full player. Mobile surfaces have fewer nested frames.

Validation:

- Artist publishing, gifts, mobile premium and room workspace: 51 browser
  tests passed in a serial Chromium run (2.4 minutes).
- Follow-up pending-gift and Studio disclosure tests: 5 passed (19 seconds),
  including 320/390/430/1440 normal and 200% text navigation. The gift test
  closes while pending, reopens, closes again, settles in the background and
  reopens the receipt, asserting exactly one send throughout.
- Studio Overview at 320 and Earnings at 390 visually inspected after the
  surface/type cleanup. The 51-test artifacts are retained at
  `/tmp/dotify-mobile-audit-studio-checkpoint`.
- Earlier focused unit runs: 41 donation/playback/discovery tests and 6
  cover-hue/discovery tests passed. These overlap and are not additive totals.
- The subsequent complete unit run passed: 81 files, 655 tests (8.21 seconds).
- Web and frozen Product DevNet builds passed after the pending-gift change.
  Existing Rollup warnings concern a dependency annotation, mixed imports of
  protectedAudio and large chunks; no build error or remote metadata refresh.
- `git diff --check` passed.

At that checkpoint, browser-back handling, full accessibility evidence and
handoff were still pending. No deployment, real payment or physical-device
test was performed.

## Navigation and accessibility checkpoint

Code commit: `d09042667362ed2b017e0b201ad3233fbd0d5344`, directly on merged
`origin/dev` `1d1f217`. The rebase changed no implementation files (tree diff
against pre-rebase `b2fe850` is empty). Documentation remains in preparation.

- Contextual sheets own one transient history entry. Browser Back closes the
  sheet before leaving the page; replacement, effect replay, rapid reopen and
  explicit navigation are unit-tested. Release/queue/options Back preserves
  active playback, sharing-to-QR adds one entry, and pending-gift Back closes
  without canceling or resending. Root interaction is inert while a dialog is
  open, with focus restored after dismissal.
- Axe found an empty tablist in Artist Releases/Rights; the empty state no
  longer claims tablist semantics. Named control groups now expose valid roles.
- Axe cannot resolve the ambient gradients, so screenshot-based text contrast
  supplements its report instead of treating incomplete results as passes.
  The test hides glyph fill (not backgrounds), reads the rendered background
  pixels and composites the computed foreground/opacity. It covers visible
  text, not images, input placeholders or every offscreen state.
- The 30-surface scan observed 541 text samples. Minimum normal-text contrast
  was 5.44:1; minimum large-text contrast was 10.40:1 in those states. Four
  additional tests cover player/room at 390/1440 over six representative hues.
  These checks are not a complete WCAG certification or user study.

Verification recorded before the final all-suite rerun:

- All unit tests: 82 files, 661 tests passed (12.32 s).
- Routing/sheet history focused run: 11 tests passed.
- Chromium accessibility/rendered-contrast surface run: 30 passed (1.3 min).
- Chromium six-hue checks: 4 passed (18.8 s).
- WebKit new Studio/sheet/history/contrast checks: 16 passed (54.3 s).
- Final gift/Back/replacement focused Chromium run: 8 passed (18.3 s).
- Formatting passed; lint has zero errors and the same three existing hooks
  warnings. `backlog-sync --check --offline` and `git diff --check` passed.
- First complete browser run: 170/177 passed. Seven tests retained old mute,
  home-navigation or guest transport labels; their paths were corrected while
  retaining audio, access and no-double-send assertions. Four then passed and
  three needed a second focused correction; the final three passed (34.7 s).
  This is not represented as an initially clean full-suite run.

The `d090426` full run completed with 180/181 passing. It exposed intermittent
desktop catalog vertical-position restoration after an artist visit; search
and focus were preserved. Five isolated reproductions passed, so it was not
treated as a deterministically reproduced failure. Inspection found an explicit
cross-view smooth scroll that can outlive a fast return and also ignores the
reduced-motion preference. The navigation now resets instantly; the test keeps
the same position threshold and covers both motion preferences at both widths.
Twenty repeated journeys passed after this narrow correction.

Final implementation `39784e6407bede3f5d69e0ed8e0f7ca65916b203` then passed the
entire Chromium suite: **183/183**, no skipped, flaky or retried tests, 7.3 min.
The additional two cases are the motion-preference expansion, not removed
assertions. The measured contrast totals remain 541 visible text samples,
5.44:1 minimum normal and 10.40:1 minimum large text, with no threshold failures.
The [capture index](../../../images/w28-audit-completion/README.md) and
[machine-readable results](../../../images/w28-audit-completion/chromium-results.json)
identify the tested implementation. The final build and handoff record follows.

Test tooling follows the [Playwright accessibility guidance](https://playwright.dev/docs/accessibility-testing).
Only test dependencies were added (`@axe-core/playwright`, `pngjs`, its types
and transitive axe-core); the existing QR dependency retains PNG 5. npm reports
32 vulnerabilities in the overall dependency tree (1 low, 3 moderate, 28 high).
No force upgrade or unrelated dependency remediation was performed.

## Final local verification

Implementation SHA: `39784e6407bede3f5d69e0ed8e0f7ca65916b203`.
Environment: Node 22.13.1, npm 10.9.2, macOS; docs-only changes were present
during verification. These are local verification builds, not clean release
candidates or published CIDs.

| Command (from web unless noted)                                                                                                                                                                                                          | Final result                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm run test:unit`                                                                                                                                                                                                                      | 82 files, 661 passed, 9.48 s                                              |
| `npm run test:e2e -- --workers=1 --reporter=list,json`                                                                                                                                                                                   | 183 passed, 7.3 min; zero skipped/flaky/retries                           |
| `npm run test:e2e -- --config playwright.webkit.config.ts --grep 'W28 listening surfaces\|artist task navigation\|pending gift\|browser Back\|replacing room\|rendered text contrast\|catalog journey' --workers=1 --reporter=list,json` | 20 passed, 1.8 min; zero skipped/flaky/retries                            |
| `npm run test:e2e -- e2e/catalog-journey.spec.ts --repeat-each=5 --workers=1`                                                                                                                                                            | 20 passed, 52.1 s                                                         |
| `npm run build`                                                                                                                                                                                                                          | Passed; includes TypeScript build                                         |
| `npm run build:product-devnet:frozen`                                                                                                                                                                                                    | Passed; no remote catalog refresh or deploy                               |
| `npm run fmt:check`                                                                                                                                                                                                                      | Passed                                                                    |
| `npm run lint -- --ignore-pattern '.data/**'`                                                                                                                                                                                            | Zero errors, three existing hook warnings in App and ArtistShell          |
| `node scripts/backlog-sync.mjs --check --offline` (repo root)                                                                                                                                                                            | Passed; running from web first correctly failed to find the root manifest |
| `git diff --check`                                                                                                                                                                                                                       | Passed                                                                    |

Full local browser artifacts were preserved in
`/tmp/dotify-mobile-audit-39784e6-chromium` and
`/tmp/dotify-mobile-audit-39784e6-webkit`; these temporary directories are not
the durable handoff. The committed capture index and compact reporter summaries
are. The 320 player, 390 dock, 430 guest, 768 player, 1440 host and Studio 200%
examples were visually inspected, with selected WebKit corroboration. Browser
CSS dimensions and WebKit's device-pixel ratio must not be confused with
physical device capture.

Existing build warnings: dependency annotation removal, mixed static/dynamic
protectedAudio imports and chunks larger than 500 kB. The added accessibility
tools are dev dependencies. No API/signaling/contract source changed, so their
standalone suites were not rerun locally; browser rooms use the real local
signaling server. CI remains a separate remote result, not inferred here.

Deployment configuration was checked: no flag, origin, secret, hosted permission,
storage mount or service setting changes are required. Existing donation and
Product capability gates remain unchanged. Physical-device, real-wallet and
Product-host checks below were **not run**. No merge, deploy, payment, secret
rotation or participant contact was performed.

### Capture quality correction

Visual inspection found a near-empty 390 px host image even though the journey
passed. Full-page screenshots can resize the viewport around a fixed shell and
trigger its actual viewport observer mid-capture. Test-only commit `086cd61`
uses viewport capture for fixed rooms and asserts visible main content, matching
shell geometry and on-screen host/guest player before capture. A first harness
attempt incorrectly queried the accessible main while a sheet made it inert;
that assertion was corrected to inspect DOM layout, not removed.

The application source is unchanged from `39784e6`. The corrected five-width
Chromium matrix passed (37.5 s) and replaced the affected capture set. The new
390 px host frame was visually inspected. This correction strengthens evidence;
it is not represented as an additional production fix or a physical-device test.
The corrected WebKit matrix also passed (five journeys, 1.2 min).
[Capture rerun results](../../../images/w28-audit-completion/capture-reruns.json)
keep these counts separate from the full-suite results. The final remote CI
outcome is recorded in the PR.

### Remote CI identity fixture correction

The first PR run passed all 183 core flows on Linux (6.8 min), then failed the
separate Product identity fixture's five tests before their identity assertions:
setup expected the old discovery heading. With real registration chronology,
the heading is now New from artists. Setup now waits for the Music catalog
region and a visible track; account isolation, delayed disclosure, editable
aliases and extension/Product separation assertions are unchanged.

`npx playwright test --config playwright.product-identity.config.ts --project=chromium --workers=2`
then passed all five locally (11.5 s). The same command with `--project=webkit`
passed all five (13.3 s). This is a simulated SDK host fixture,
not a live Product host test. The initial CI failure remains visible at
[run 36551866090](https://github.com/knzeng-e/dotify/actions/runs/36551866090).

## Original audit traceability

| Original recommendation                                 | Implementation and verification boundary                                                                                                                                                                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lighter navigation and attached live/direct mini-player | `PlayerDock`, `PrimaryNav`, responsive styles; actual room track, roster and count; `room-dock` and `room-continuity` tests. Normal mobile footer is about 136 px in the observed live state, not a rigid height promise under enlarged text.                                                    |
| Header disappears in focused listening                  | Contextual solo/room controls replace the global mobile header. Account access remains under You or the existing protected-track gate.                                                                                                                                                           |
| Music arrives in the first viewport                     | Compact discovery copy and native snapping rails; `catalog-journey` checks a playable card inside the first viewport. No mobile carousel arrows.                                                                                                                                                 |
| Live / new / recent shelves                             | Live signaling data; chronology-dependent new-release label; bounded actual-playing history, in memory and clearable. No fabricated activity or tracking identity.                                                                                                                               |
| Clean cards and About this release                      | Cover/title/artist with explicit information; one shared read-only sheet for catalog, artist releases and solo player. Payment terms precede approval; record references remain folded.                                                                                                          |
| Artwork-led full player                                 | Seek and previous/play/next primary; shuffle/repeat, queue, information and optional artist gift secondary; mute in listening options. Existing access-checked selection is unchanged.                                                                                                           |
| Artwork tint and reduced motion                         | Small bounded anonymous sample with fallback; six-hue rendered contrast checks complement axe. No audio dependency or claim of Product-host canvas support.                                                                                                                                      |
| Human room header and sharing                           | Actual session roster, contextual host/guest label, sharing sheet containing code and QR. Counts are sessions, not verified unique humans.                                                                                                                                                       |
| Chat / Queue / People and composer                      | Requests stay inside Queue; badge reports pending requests. Existing ephemeral reactions and drafts retained; keyboard geometry tests cover interrupted/invalid viewport updates.                                                                                                                |
| Links and active rooms before raw codes                 | Active room discovery leads, pasted links/codes remain supported, Galaxy optional. A remembered chosen name can auto-join; first-time guests choose a name and press Enter and listen. Browser autoplay or unsupported-host fallback can require an additional action. No wallet/signature gate. |
| Artist tasks and one primary action                     | Overview/Releases/Earnings/Rights, keyboard-operable tabs, existing publication/rights/earnings controllers and recovery. Technical records collapsed, unknown balances not hidden.                                                                                                              |
| Human support flow                                      | Suggested/custom direct gifts, registered destination, separate fees, explicit review, readable receipt. Pending closure/Back preserves one operation; optional feature flag unchanged. Gifts never purchase access.                                                                             |
| Simpler design system and accessibility                 | Fewer nested frames, smaller task headings, shared semantic tokens and existing icon system. Focus/inert modal behavior, axe and rendered text contrast checks; no new production UI framework.                                                                                                  |

The exact example words and decorative treatments in the screenshots are not
new domain contracts: the interface preserves existing Dotify status language,
uses actual names/avatars, and does not add invented room titles or activity.
The shorter hero remains visible rather than introducing a first-visit tracking
flag. At 200% text, small screens permit vertical scrolling instead of hiding
controls or reducing the requested font size; simultaneous visibility of every
control in a 320 x 568 viewport is not claimed.

## Required device and Product follow-up (not run)

After separate release authorization, record the built SHA/CID, date, OS/device,
browser or Product host version and network for each observation:

1. On physical iPhone and Android, open Music, swipe a rail without starting
   audio, select a track, seek, use previous/next and open/close secondary sheets.
2. Join a shared room without a wallet. Verify actual audible audio, leave the
   room view without disconnecting, inspect the live dock, pause locally and
   return. Confirm the host's track changes without a stale solo title.
3. Type a long message, switch Queue/People, rotate and dismiss the real keyboard.
   Check safe areas, scroll reachability, enlarged text and OS reduced motion.
4. In supported Product Web/Desktop hosts, repeat navigation, sheet Back/close,
   artwork fallback and an already-authorized release opening. Do not infer
   in-app Mobile WebRTC or signing support from the browser runs.
5. Inspect Studio tasks and release disclosures. Any real gift/payment requires
   separate authorization and explicit amount/recipient review; this UI audit
   does not authorize spending funds.

Failures belong in this evidence with attempts and actual outcomes. These checks
and the existing consented pilot are W13 release gates, not inferred passes.
