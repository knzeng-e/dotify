# Dotify Production Backlog

This folder contains the execution backlog for moving Dotify from prototype to public testnet production readiness.

The backlog is organized as engineering sprints. Each ticket has a dedicated Markdown instruction file intended for Claude Code, Codex, or a senior engineer working inside the repository.

## Product north star

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

| Backlog doc                                      | GitHub issue | Status                                                                          | Goal                                     |
| ------------------------------------------------ | ------------ | ------------------------------------------------------------------------------- | ---------------------------------------- |
| `10-observability-health-checks.md`              | #11          | Backend + signaling slice delivered; frontend surface and production operation evidence open | Observability and health checks          |
| `11-proof-of-personhood-integration-research.md` | #12          | Open - rewrite against current Product SDK / Individuality host APIs before build | Proof of Personhood integration research |
| `12-ambassador-social-propagation-model.md`      | #13          | Open - keep last until provenance, consent, and anti-abuse foundations exist       | Ambassador and social propagation model  |

## Design track - experience evolution

Presentational UX work derived from `design/Dotify-design/` (the "Living Light" prototype and redesign brief). This track is parallelizable with the spine and must not block or destabilize it: behavior is preserved and the aura is pure presentation. Honesty rule applies throughout - no UI element may imply a capability (persisted mood, broadcast chat, fabricated stats) the backend does not have.

Shared Score now supplies the current information architecture and honesty
rules. The rendered #92 presentation restores the useful Living Light layer as a
track-driven dark listening room. Constellation, Living Interface, and layered
Thresholds remain design history unless a current ticket explicitly revives a
specific pattern with real data.

| Backlog doc                               | Status                                                                                         | Goal                                                                                                                                                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `13-living-light-design-foundation.md`    | Delivered on `main`                                                                            | Aura engine, presence, dock, immersive-room presence, hero/typography/cover-fallback polish                                                                                                                                                    |
| `14-one-link-room-creation-sheet.md`      | Delivered on `main`                                                                            | "As easy as sharing a link" room-create sheet over the existing createSession                                                                                                                                                                  |
| `15-immersive-room-parity.md`             | Delivered (chat via #20)                                                                       | Room code pill + copy, access chips, sync note; the deferred chatter aside landed with `20-room-social-layer.md`                                                                                                                               |
| `16-wallet-connected-identity-card.md`    | Delivered on `main`                                                                            | Calm connected-wallet identity card with real, non-fabricated stats                                                                                                                                                                            |
| `17-artist-studio-living-light-parity.md` | Delivered on `main`                                                                            | Studio identity header, metric cards, sovereignty card, releases + support showcase                                                                                                                                                            |
| `19-constellation-design-track.md`        | Phases A-C prototyped (see delivery notes)                                                     | Constellation direction: The Stage (aura lamp rail), Sky of rooms, micro-moments (`docs/design/dotify-constellation-ux.md`)                                                                                                                    |
| `20-room-social-layer.md`                 | Delivered on `main` (PR #67)                                                                   | Broadcast reactions (attributed petals) + in-room chat over the signaling relay; 50-message in-room history, rate-limited, fail closed                                                                                                         |
| `22-living-interface.md`                  | Delivered on `design/living-interface`                                                         | Living Interface: borders replaced by aura-tinted tonal layering, relaxed geometry, deep-glass floating layers, conversational chat bubbles, one breathing motion curve (`docs/design/dotify-living-interface.md`)                             |
| `23-room-identity.md`                     | Layer 1 delivered on `feat/room-identity`                                                      | A pseudonym set once per wallet: off-chain per-address display name, auto-filled into room create/join; Layer 2 (link/QR join step) and on-chain handle registry are future (`docs/design/room-identity.md`)                                   |
| `25-thresholds-functional-v1.md`          | Delivered on `main` by merged PR #92; follow-up validation passed 2026-07-14 | `Shared Score` IA with Living Light presentation over the real room-link threshold, retired-preview copy cleanup, multi-recipient royalty splits, and production-spine security hardening (`docs/design/dotify-shared-score.md`; original rationale in `docs/design/dotify-thresholds.md`) |

Delivered before the #92 consolidation: album-aura engine, aura-colored cover
fallbacks, presence avatars, player dock, create-room sheet, immersive-room
cover-glow/EQ/reactions/header/sync-note, wallet connected card, studio
showcase, and the Living Light stylesheet block. PR #92 replaces the monolithic
`web/src/styles.css` with modular style files under `web/src/styles/`, renames
the listener landing destination to `Music`, and keeps the old node/warp
`AmbientCanvas` / `StarfieldCanvas` removed.

Deferred (needs a backend channel, deliberately not faked): persisted room mood. The custom Dotify logo is now delivered as a Polkadot-inspired dotted orbit with a musical clef at its center, shared by the DApp and public project page. Room chat / "say something" is no longer deferred: `20-room-social-layer.md` wired reactions and chat over the signaling relay.

## Dotify v2 - strategic pivot

| Backlog doc                 | Status                                                                                                                                                                | Goal                                                                                                                                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `24-access-streaming-v2.md` | P1/P2 delivered; P3 first vertical slice delivered with DAV2 refs, playback fallback, and startup metrics (design in `docs/design/dotify-v2-access-and-streaming.md`) | Remove the 42% preview; three-mode artist policy (free / paid / human-free via Proof of Personhood); sign-once session auth for key delivery; encrypted chunked streaming (`dotify.audio.v2`) for fast starts; Product SDK / Playground / Humanity feasibility as a later host-integration track |

Ticket 24 supersedes the preview-based rows above: the 42% doctrine and the
ticket 18 preview assets are consciously retired by access model v2.

## Strategic improvement plan

`improvement-plan.md` tracks the July 2026 review of the implementation
against the product/technical/philosophical memory and the current Parity
Product SDK direction. The plan is now dual-mode: standalone web remains the
first public listening path, while Product SDK / Playground / Humanity
integration is a gated feasibility track. Nothing in that track may imply live
Host, Statement Store, Product account, Humanity, or `.dot` deployment support
until the relevant spike proves the current API, environment, and security
boundary.

The Product SDK evidence snapshot used for this replanning is
`paritytech/product-sdk@2f359bba28ca72855207a0a519d4118b37b4438c`
(`@parity/product-sdk` 0.17.0), fetched on 2026-07-14. It is explicitly
prototype / reference / unaudited code. Paseo and Summit are the live preset
environments; Product SDK contracts target `pallet-revive` / PolkaVM CDM flows,
not Dotify's current viem + EVM RPC path; Statement Store is useful for small
ephemeral presence, not full chat, SDP/ICE, durable media metadata, or guest
reactions.

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

Sprint 0, Sprint 1, ticket 24 P1/P2/P3 first slice, and ticket 25 are delivered
on `main`. The remaining order is:

1. Reconcile GitHub Project 5 with this local backlog and keep issue status in
   the project, not scattered through prose.
2. Finish standalone production operation: observability frontend, public API /
   signaling deployment evidence, DAV2 real-browser and gateway validation, and
   production wallet/device checks.
3. Improve room resilience and shared-listening depth only where it preserves
   the link-first guest doctrine.
4. Run Product SDK feasibility spikes: Host capability detection, Product
   account signing, resource allocation, PolkaVM/CDM contract portability,
   Playground/Bulletin/DotNS deployment, and Statement Store presence.
5. Build live Humanity / Individuality only after the research ticket proves a
   privacy-preserving source, proof shape, address-binding story, and fallback
   UX.
6. Cut ambassador mechanics last, after provenance, consent, and anti-abuse are
   designed.

The philosophical line is simple: make the social listening experience as frictionless as a shared link, while keeping the artist-owned runtime and access policy as the invisible foundation.
