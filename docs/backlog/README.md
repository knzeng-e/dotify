# Dotify Production Backlog

Current reset follow-up: [streaming-only internal reset](streaming-only-reset.md) (#320). The owner retires the test catalog; older DAV1/DAV2 compatibility and migration plans are historical.

This folder contains the execution backlog for moving Dotify from prototype to public testnet production readiness.

The owner-requested [Bulletin segmented-media prototype](implementation/evidence/bulletin-prototype-2026-10-29.md)
tests directory identities, selective encrypted reads and receipt/renewal recovery
in isolation. A bounded manual DevNet adapter now adds finalized metadata checks,
raw CID reads and immediate one-off renewal, now verified for 19 synthetic blocks.
Physical Host/audible delivery, publication throughput and
production ownership remain gates. It does not activate a Pinata
replacement or close W32/W33 acceptance.

The backlog is organized as engineering sprints. Each ticket has a dedicated Markdown instruction file intended for Claude Code, Codex, or a senior engineer working inside the repository.

W36/#291 merged through #339 after W35/#338. The shared API and private
publication-custody topology require an explicit migration before any scaling.
See [W36 evidence](implementation/evidence/W36.md). W37/#292 follows with
[bounded catalog indexing](implementation/evidence/W37.md), resumable checkpoints
and reusable lookup indexes. W35 and the newer API changes
are now published in the [combined 0.1.63 rollout](implementation/evidence/product-0.1.63-rollout-2026-10-28.md).
Physical-device and pilot acceptance remain separate; #341 records the
activation corrections before another deployment is prepared.

## Current reconciliation, 2026-10-23

[The 31-open-issue audit](implementation/evidence/backlog-reconciliation-2026-10-23.md)
separates delivered work from native, operational and measured acceptance.
#240, #250, #257, #273, #285 and #320 are delivered records. #274 stays open
for exact-Host Nearby location/lifecycle evidence; it is not a request to rebuild
the galaxy. #286 retains a dedicated Worldwide-report browser test.
The 0.1.58 reset already deployed non-root API storage and current streaming;
#287/#317 retain real/native acceptance. #288 has merged code but a gateway-401
activation blocker. Neither the old DAV2 catalog nor its migration is active work.

Since that audit, [#329's Galaxy 3D correction](room-galaxy-restoration.md) merged
through #330 and was published in Product 0.1.61 (#331). The owner confirmed the
installed experience works. This does not certify the full physical-device matrix.
The dedicated [W31 Worldwide Report verification](implementation/evidence/W31-worldwide-report-2026-10-25.md)
merged through #332. [W34 fast access](implementation/W34-fast-access-path.md) (#289) merged through
#333 and was deployed on API/Web and Product 0.1.62 through #334. W31 (#286),
W34 (#289) and the scoped 3D correction (#329) are delivered records; their
remaining physical-device checks belong to the existing release gates.

[The October 26 reconciliation](implementation/evidence/backlog-reconciliation-2026-10-26.md)
records these closures. Payment approval recovery (#335) and publication return
(#336) are merged into `dev` but not published in 0.1.62. Navigation and
mini-player exits (#337) remain under review. W35 (#290) is the next eligible
streaming implementation after that correction is reviewed.

October 27: #337 is merged. [W35/#290](implementation/W35-continuous-player.md)
is now being implemented from that dev source, without a separate deployment;
the owner will test the client corrections together. Its browser evidence does
not close the physical-device or pilot gates.

October 29: a [publication reliability correction](implementation/evidence/publication-preparation-recovery-2026-10-29.md)
addresses the studio's stuck progress modal and explicit retry behavior.
The observed Pinata HTTP 403 was a separate provider admission failure; after
the owner cleaned obsolete pins, the prepared bundle was accepted. Full
publication/native acceptance remains #287/#317.

## Room scaling research, 2026-10-29

[W39 / #294](implementation/W39-horizontal-rooms.md) implements an isolated
measurement harness for shared room ownership, recovery and a 25-guest SFU.
[ADR 0037](../adr/0037-room-scaling-and-sfu.md) keeps the deployed single
signaling instance and guest cap until the explicit production follow-ups and
physical evidence are accepted. Research is not a hosting activation.

## Bulletin media research, 2026-10-29

The owner-requested [Bulletin media feasibility study](../research/bulletin-media-storage-2026-10-29.md)
records the existing storage Seam, exact DevNet limits and the remaining
directory-delivery/renewal proof. The [real-AAC reader canary](implementation/evidence/bulletin-aac-host-canary-2026-10-30.md)
adds generated codec/browser controls and a local native-reader harness after
the first live block canary. Physical retrieval, audible startup and scalable
publication remain gates; this does not activate a storage replacement or close
W32/W33 acceptance.

## Status contract

GitHub Project 5 owns live workflow status. This document records scope,
delivery boundaries, and the small set of remaining outcomes; it must not keep
a second Todo/In Review board in prose.

An implementation issue is complete when its acceptance scope is reviewed and
merged into `dev`, even when broader live-device or pilot evidence is still
required. Those release gates belong to W13 or to an explicitly named
operational issue such as #87, #88, or #89. Because pull requests target `dev`
while `main` is the GitHub default branch, closing keywords do not close these
issues automatically; the merge handoff must close the issue and set its
Project item to Done explicitly.

The PR writing workflow is tracked in [`pr-review-quality.md`](pr-review-quality.md)
(#240); it changes review documentation only, not product behavior.

The local Claude hook and verification workflow correction is tracked in
[`claude-verification-tooling.md`](claude-verification-tooling.md) (#265),
implemented by PR #264.

The owner-requested clean testnet preparation is tracked by
[#317](https://github.com/knzeng-e/dotify/issues/317),
[scope and coordinated cutover](fresh-testnet-streaming-cutover.md). Fresh core
contracts and CDM version 2 are recorded; the application cutover and live/native
streaming acceptance remain separate from contract deployment.

## Product north star

The mobile keyboard correction and shared interaction polish in
[#306](https://github.com/knzeng-e/dotify/issues/306) are implemented by #307
and published in Product 0.1.56. The owner confirmed expected mobile keyboard
behavior on 2026-10-20. [Mobile form continuity](mobile-form-continuity.md)
retains the separate full physical-device acceptance boundary.

Post-0.1.47 owner feedback is tracked by [#269](https://github.com/knzeng-e/dotify/issues/269),
[publication, artwork and room follow-up](release-room-followup.md). It covers
confirmation convergence, Product navigation, public-image caching, automatic
host-tip association, verified native announcements and editorial corrections.

Owner-requested room-life continuation: [#257](https://github.com/knzeng-e/dotify/issues/257),
[scope and acceptance](room-life-and-artist-visits.md). It follows #256 and adds
ephemeral conversation cues and verified artist visits; public-pilot reliability
and physical Product-host validation remain release gates.

Dotify is not a Spotify clone. Dotify is a decentralized cultural social hub where music becomes a live social connector, artists retain sovereignty over catalog/access/royalties, and listeners can discover music through shared real-time presence.

## Production readiness rule

Do not add ornamental product features until the following spine is stable:

1. An artist can publish a rights-managed encrypted track.
2. An unauthorized listener gets an honest unlock gate (and Free tracks play for everyone).
3. A listener can pay/unlock a Classic track.
4. Full audio keys are never bundled into the frontend.
5. A host can create a public listening room.
6. A listener can join that room via a simple link without wallet friction.
7. Protected room playback is host-access based: the host may receive the temporary content key; room listeners only receive the ephemeral WebRTC stream.
8. Critical flows are covered by automated tests.

## Sprint 0 — Production spine

| Backlog doc                                | GitHub issue | Status                                       | Goal                                                                |
| ------------------------------------------ | ------------ | -------------------------------------------- | ------------------------------------------------------------------- |
| `01-backend-key-service-skeleton.md`       | #2           | Delivered                                    | Backend key service skeleton                                        |
| `02-server-side-pinata-uploads.md`         | #3           | Delivered                                    | Server-side Pinata uploads                                          |
| `03-wallet-signed-content-key-requests.md` | #4           | Delivered (see delivery notes in the ticket) | Wallet-signed content-key requests for individual and host playback |
| `04-hosted-signaling-room-join-links.md`   | #5           | Delivered (see delivery notes in the ticket) | Hosted signaling, room join links, and host-based room access       |
| Documentation task                         | #15          | Closed                                       | UX signature and host-based room playback rules                     |

## Sprint 1 — Stabilization and maintainability

| Backlog doc                              | GitHub issue | Status                                                                                  | Goal                                                      |
| ---------------------------------------- | ------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `05-classic-unlock-e2e-coverage.md`      | #6           | Delivered on `main`                                                                     | Classic unlock end-to-end coverage                        |
| `06-artist-publish-e2e-coverage.md`      | #7           | Delivered on `main`                                                                     | Artist publish end-to-end coverage                        |
| `07-room-join-e2e-coverage.md`           | #8           | Delivered (see delivery notes in the ticket)                                            | Room join and host-access playback end-to-end coverage    |
| `18-production-preview-assets.md`        | #27          | Retired by ticket 24 P1 (delivered, then consciously removed with the preview doctrine) | Separate preview assets for server-keyed protected tracks |
| `08-frontend-feature-module-refactor.md` | #9           | Delivered on `main`                                                                     | Frontend feature-module refactor                          |
| `09-generated-abi-bindings.md`           | #10          | Delivered (see delivery notes in the ticket)                                            | Generated ABI bindings                                    |

## Sprint 2 — Product hardening and philosophical differentiation

| Backlog doc                                      | GitHub issue | Status                                                                                                            | Goal                                     |
| ------------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `10-observability-health-checks.md`              | #11          | Delivered on `main`; public signaling/env evidence closed through #36/#37, DAV2/gateway evidence continues in #88 | Observability and health checks          |
| `11-proof-of-personhood-integration-research.md` | #12          | Open - rewrite against current Product SDK / Individuality host APIs before build                                 | Proof of Personhood integration research |
| `12-ambassador-social-propagation-model.md`      | #13          | Open - keep last until provenance, consent, and anti-abuse foundations exist                                      | Ambassador and social propagation model  |

## Design track - experience evolution

Presentational UX work derived from `design/Dotify-design/` (the "Living Light" prototype and redesign brief). This track is parallelizable with the spine and must not block or destabilize it: behavior is preserved and the aura is pure presentation. Honesty rule applies throughout - no UI element may imply a capability (persisted mood, broadcast chat, fabricated stats) the backend does not have.

Shared Score now supplies the current information architecture and honesty
rules. The rendered #92 presentation restores the useful Living Light layer as a
track-driven dark listening room. Constellation, Living Interface, and layered
Thresholds remain design history unless a current ticket explicitly revives a
specific pattern with real data.

| Backlog doc                               | Status                                                                            | Goal                                                                                                                                                                                                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `13-living-light-design-foundation.md`    | Delivered on `main`                                                               | Aura engine, presence, dock, immersive-room presence, hero/typography/cover-fallback polish                                                                                                                                                                                                |
| `14-one-link-room-creation-sheet.md`      | Delivered on `main`                                                               | "As easy as sharing a link" room-create sheet over the existing createSession                                                                                                                                                                                                              |
| `15-immersive-room-parity.md`             | Delivered (chat via #20)                                                          | Room code pill + copy, access chips, sync note; the deferred chatter aside landed with `20-room-social-layer.md`                                                                                                                                                                           |
| `16-wallet-connected-identity-card.md`    | Delivered on `main`                                                               | Calm connected-wallet identity card with real, non-fabricated stats                                                                                                                                                                                                                        |
| `17-artist-studio-living-light-parity.md` | Delivered on `main`                                                               | Studio identity header, metric cards, sovereignty card, releases + support showcase                                                                                                                                                                                                        |
| `19-constellation-design-track.md`        | Phases A-C and the optional W14 3D room galaxy delivered; 2D/list remains default | Constellation direction: The Stage (aura lamp rail), Sky of rooms, optional 3D room galaxy, micro-moments (`docs/design/dotify-constellation-ux.md`)                                                                                                                                       |
| `20-room-social-layer.md`                 | Delivered on `main` (PR #67)                                                      | Broadcast reactions (attributed petals) + in-room chat over the signaling relay; 50-message in-room history, rate-limited, fail closed                                                                                                                                                     |
| `22-living-interface.md`                  | Delivered on `design/living-interface`                                            | Living Interface: borders replaced by aura-tinted tonal layering, relaxed geometry, deep-glass floating layers, conversational chat bubbles, one breathing motion curve (`docs/design/dotify-living-interface.md`)                                                                         |
| `23-room-identity.md`                     | Layer 1 delivered on `feat/room-identity`                                         | A pseudonym set once per wallet: off-chain per-address display name, auto-filled into room create/join; Layer 2 (link/QR join step) and on-chain handle registry are future (`docs/design/room-identity.md`)                                                                               |
| `25-thresholds-functional-v1.md`          | Delivered on `main` by merged PR #92; follow-up validation passed 2026-07-14      | `Shared Score` IA with Living Light presentation over the real room-link threshold, retired-preview copy cleanup, multi-recipient royalty splits, and production-spine security hardening (`docs/design/dotify-shared-score.md`; original rationale in `docs/design/dotify-thresholds.md`) |

Delivered before the #92 consolidation: album-aura engine, aura-colored cover
fallbacks, presence avatars, player dock, create-room sheet, immersive-room
cover-glow/EQ/reactions/header/sync-note, wallet connected card, studio
showcase, and the Living Light stylesheet block. PR #92 replaces the monolithic
`web/src/styles.css` with modular style files under `web/src/styles/`, renames
the listener landing destination to `Music`, and keeps the old node/warp
`AmbientCanvas` / `StarfieldCanvas` removed.

Deferred (needs a backend channel, deliberately not faked): persisted room mood. The custom Dotify logo is now delivered as a Polkadot-inspired dotted orbit with a musical clef at its center, shared by the DApp and public project page. Room chat / "say something" is no longer deferred: `20-room-social-layer.md` wired reactions and chat over the signaling relay.

## Dotify v2 - strategic pivot

| Backlog doc                 | Status                                                                                                                                                                        | Goal                                                                                                                                                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `24-access-streaming-v2.md` | P1/P2 delivered; P3 DAV2 vertical slice and bounded read-ahead delivered; real-browser/gateway validation remains (design in `docs/design/dotify-v2-access-and-streaming.md`) | Remove the 42% preview; three-mode artist policy (free / paid / human-free via Proof of Personhood); sign-once session auth for key delivery; encrypted chunked streaming (`dotify.audio.v2`) for fast starts; Product SDK / Playground / Humanity feasibility as a later host-integration track |

Ticket 24 supersedes the preview-based rows above: the 42% doctrine and the
ticket 18 preview assets are consciously retired by access model v2.

## UX audit follow-ups (September 2026)

Source: `docs/design/ux-design-audit-2026-09-17.md`. Existing tickets were reused where they already own the scope: #87 keeps responsive cover variants (evidence added), #151/W10 and #156/W12 keep their delivered decisions, #160/W14 keeps the galaxy.

| Backlog doc                                       | GitHub issue | Delivery record                                      | Goal                                                                                      |
| ------------------------------------------------- | ------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `implementation/W21-first-listening-screen.md`    | #176         | Delivered by #184; card presentation refined by #195 | No dead controls, music-first cards with on-demand access details, text-free placeholders |
| `implementation/W22-room-hosting-clarity.md`      | #177         | Delivered by #185                                    | No role-as-name, invite-first hosting, meaningful guest controls                          |
| `implementation/W23-player-support-clarity.md`    | #178         | Delivered by #186                                    | Immersive solo player and plain support/wallet prompts                                    |
| `implementation/W25-artist-workspace-language.md` | #180         | Delivered by #188                                    | Plain and truthful artist workspace                                                       |
| `implementation/W24-visual-system-contract.md`    | #179         | Delivered by #189                                    | One documented type, color and component system                                           |
| `implementation/W26-french-localization.md`       | #181         | Later                                                | French interface after the pilot                                                          |

## UX clarity pass (October 2026)

Source: the 2026-10-08 audit of the running app, requested by the owner.

| Backlog doc                             | GitHub issue | Delivery record | Goal                                                                                                                                                                    |
| --------------------------------------- | ------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `implementation/W29-ux-clarity-pass.md` | #250         | PR #249         | One word per gesture, room-first home, named payment recipients, protected playback that names its failure, room exit in the header, sign-in after a purposeful connect |

W29 reverses one earlier record: catalog cards show a short access cue again
(W21 / #195 and W28 kept access details on demand).

## Remaining execution map

The [2026-10-26 reconciliation](implementation/evidence/backlog-reconciliation-2026-10-26.md)
supersedes older implementation/deployment remainders. W30 and W34 are deployed;
W31's remaining report test is merged. W32/current-format streaming is deployed;
W33 retains its recorded gateway-access and measured activation gate, not a new
implementation request. The October 28 update records W35-W37 as implemented,
with W36 activated in Product 0.1.63 and physical acceptance still open. W38 is
implemented for review against the owner-requested fresh runtime generation;
W39 remains Later. Project 5 owns workflow status; this table describes remaining scope
without reopening delivered work.

| Priority | GitHub issue | Phase                    | Remaining outcome                                                                                                                                               |
| -------- | ------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | #158 / W13   | Now                      | Bind Product payment/access, room, first-sound, rollback, release-profile, and consented pilot evidence to one accepted candidate.                              |
| P1       | #317         | Now (cutover acceptance) | Record current-catalog real publication/pinning, same-runtime native recovery and current-format access/audio/value acceptance; the cutover itself is deployed. |
| P1       | #269         | Now (release follow-up)  | Verify the new runtime's metadata-edit capability and correction/read-back; coordinate room-tip continuity with #229 without upgrading retired runtimes.        |
| P1       | #229         | Now (value flows)        | Complete coordinated room-policy/authority activation and actual native quote, receipt recovery and exactly-once chat acceptance with artist consent.           |
| P0       | #88          | Next                     | Measure current v3 AAC first sound with schema-6 evidence on exact physical Web/Product builds and adverse delivery conditions.                                 |
| P1       | #87          | Next                     | Validate responsive covers on new live uploads/mobile and adverse gateways; the retired catalog needs no backfill.                                              |
| P1       | #89          | Next                     | Exercise forced TURN, independent networks, mobile recovery, host capacity, and the mesh/SFU decision.                                                          |
| P1       | #85          | Product feasibility      | Maintain the Product capability/compatibility epic around evidence that the current Host actually exposes.                                                      |
| P1       | #90          | Next                     | Re-scope only the wallet-later gaps observed in pilot evidence; do not replay the delivered UX work.                                                            |
| P1       | #274 / W19   | Device acceptance        | Verify merged Nearby behavior and subsequent discovery follow-ups on physical Product/mobile devices; retain host opt-in, both radii and wallet-free joining.   |
| P1       | #287 / W32   | Next (streaming)         | Validate deployed current-format publication, pinning, native playback, walletless room audio and prolonged listening; preserve permanent nonce custody.        |
| P1       | #288 / W33   | Next (streaming)         | Resolve dedicated gateway 401, activate reviewed ciphertext-only delivery, and measure cold/warm audible startup in three regions.                              |
| P1       | #291 / W36   | Next (scaling)           | Implementation and two-instance rollout are recorded in W36 evidence; finish physical acceptance of the deployed shared state and private custody.                                                               |
| P2       | #292 / W37   | Next (scaling)           | Implementation and synthetic load checks are recorded in W37 evidence; retain live indexing/load acceptance on the deployed candidate.                                                                       |
| P2       | #293 / W38   | Review / fresh activation | Review implemented string/split bounds and paged readers, then deploy matching fresh contracts/API/Web/Product and verify native publication and payment.                                                           |
| P2       | #294 / W39   | Later                    | Measure horizontal signaling and an SFU prototype while preserving anonymous entry and the no-guest-key boundary.                                               |
| P1       | #275         | Next                     | Design artist-controlled runtime modules, safe owner-approved updates, admin inventory, and a separate artist-admission boundary.                               |
| P1       | #276         | Next                     | Prove per-artist key export and restore through a second compatible operator without exposing a global master secret.                                           |
| P1       | #214 / W27   | Next Product sprint      | Prove Celerity room events behind a typed dual-transport boundary, preserve anonymous link entry, and decide each Socket.IO responsibility from live evidence.  |
| P2       | #12          | Product feasibility      | Prove a private personhood source and address binding before implementing Human free.                                                                           |
| P3       | #13          | Later                    | Design consented cultural propagation after the first pilot.                                                                                                    |
| P2       | #181 / W26   | Later                    | Add French after W13 and the visual contract are accepted.                                                                                                      |

## Strategic improvement plan

`improvement-plan.md` tracks the July 2026 review of the implementation
against the product/technical/philosophical memory and the current Parity
Product SDK direction. The plan is now dual-mode: standalone web remains the
first public listening path, while the Product DevNet build adds
`dotify-test01.dot`,
explicit Host detection, app-scoped Product identity, and canonical
Product-origin room links. Typed runtime ports separate standalone viem writes from Product-native
CDM/PAPI calls. Native writes and signed key/session verification are implemented;
physical-device and settlement acceptance remain explicit. Celerity observation
does not replace room authority, and no live Humanity decision is implied.
Product-signed key/session verification uses
`product-sr25519-v1`, and the Product frontend sends that request shape after
explicit Product account connection. Live host evidence remains required before
Product identity can be treated as broadly proven across devices.

The 2026-10-23 compatibility correction (#326) pins Product SDK 0.39.0 and
TrUAPI 0.25.0 to the inspected Desktop 0.1.4-rc.3 codec/schema; Product 0.1.60
publication is recorded in [#327](https://github.com/knzeng-e/dotify/pull/327).
The Product SDK owns its PAPI 3 dependency graph while the separate legacy
Bulletin/wallet packages retain the root PAPI 1.23 line. The deploy CLI remains
0.20.0 with live Host-profile verification. No mobile compatibility claim follows
from a Desktop wire inspection. Native signing/media/location and stablecoin
settlement remain evidence-based gates under #85/#158, not a reason to rebuild
the runtime ports or switch hidden signers.

The local backlog/project synchronization contract lives in `backlog.json` and
is checked by `scripts/backlog-sync.mjs`. GitHub Project 5 owns workflow status;
local Markdown owns scope, acceptance criteria, and delivery notes.

## Current room access doctrine

Dotify distinguishes direct file access from room presence.

- Individual playback: the listener must satisfy the track access policy before receiving a temporary content key.
- Room playback: only the host must satisfy the track access policy.
- Room listeners do not need to connect a wallet, sign, pay, or prove access merely to listen inside a room.
- Room listeners never receive the encrypted source file or content key; they receive only the ephemeral WebRTC stream.
- If an unauthorized host selects a protected track, nothing streams: the host sees the unlock/personhood CTA and moves the room to a track they can play. The 42% preview is retired (ticket 24 P1).

## Engineering bar

All implementation must be production-minded:

- no frontend-bundled production secrets;
- no silent wallet fallback for public user flows;
- no hidden dev account signing in production paths;
- typed APIs and explicit error states;
- deterministic tests for critical flows;
- small modules, not more monolithic `App.tsx` growth;
- security assumptions documented in code and docs;
- user-facing errors must be understandable without blockchain expertise;
- room guests must not be forced through wallet bureaucracy merely to listen to a host stream.

## Recommended execution order

For new implementation sessions, use the September 2026
[agent implementation playbook](implementation/README.md), tracked by #130.
It translates the existing backlog and the latest product direction into
bounded prompts, dependency gates, and a Product DevNet/web pilot. Product is
a first-class acceptance target; responsive design can progress alongside the
spine and a 3D prototype remains optional. The 2026-10-14 owner decision makes
Nearby the next product expansion after reviewing W18's radius amendment. The historical order below remains context; the playbook is the
current sequencing guide. Project 5 continues to own workflow status.

Sprint 0, Sprint 1, ticket 24 P1/P2/P3 first slice, ticket 25, W01-W12,
W14, W16, W18, and W21-W25 have delivered implementation records. W13 remains
the release gate. Current product scheduling is documented in
[Product alignment and Nearby priorities](polkadot-alignment-and-nearby-priority.md):

- **Delivered discovery, remaining acceptance:** W19 Nearby/Worldwide galaxy and
  independent approximate radii are implemented. #274 retains native location,
  permission/lifecycle and two-client audible-room evidence.
- **Supporting work:** #85 Product compatibility/network profiles and observed
  playback/joining/publication/tip failures, with release evidence retained.
- **Next:** artist-controlled [runtime features](artist-runtime-features.md) and
  [key portability](artist-key-portability.md), after the first Nearby slice.
- **Later:** stablecoin/Coinage feasibility. W16 remains a delivered record;
  #85 carries any explicitly reactivated follow-up. JAM stays a watch item.

Nearby does not depend on 3D, Celerity migration or new payments. The remaining
release-evidence order is:

1. Finish W13 against the published Product CDM validation CID: reuse an
   existing entitlement, capture Product payment/access read-back, host-to-
   walletless-listener room evidence, physical first-sound samples, forced
   TURN/independent-network behavior, and iPhone behavior.
2. Use the same campaign to finish the evidence boundaries in #87, #88, and
   #89. Change code only when measured failures justify it.
3. Choose the accepted Product write profile from the evidence, rehearse
   rollback/restore, publish the distinct pilot release identity, and open the
   `dev` to `main` promotion for review.
4. Run the consented aggregate pilot and record `go`, `hold`, or `no-go` before
   promoting W15/W19/W20/W27 to public readiness. Owner-activated flagged
   implementation can proceed under each sequence's explicit scope.
5. After the first Nearby slice, continue W27 as a measured dual-transport sprint:
   keep wallet-free joining intact, migrate only event classes whose delivery
   guarantees are proven, and retain Socket.IO wherever Celerity has not reached
   parity.
6. Build live Humanity / Individuality only after the research ticket proves a
   privacy-preserving source, proof shape, address-binding story, and fallback
   UX.
7. Cut ambassador mechanics last, after provenance, consent, and anti-abuse are
   designed.

The philosophical line is simple: make the social listening experience as frictionless as a shared link, while keeping the artist-owned runtime and access policy as the invisible foundation.
