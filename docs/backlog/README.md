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

| Backlog doc | GitHub issue | Status | Goal |
| --- | --- | --- | --- |
| `01-backend-key-service-skeleton.md` | #2 | Delivered | Backend key service skeleton |
| `02-server-side-pinata-uploads.md` | #3 | Delivered | Server-side Pinata uploads |
| `03-wallet-signed-content-key-requests.md` | #4 | Delivered (see delivery notes in the ticket) | Wallet-signed content-key requests for individual and host playback |
| `04-hosted-signaling-room-join-links.md` | #5 | Delivered (see delivery notes in the ticket) | Hosted signaling, room join links, and host-based room access |
| Documentation task | #15 | Closed | UX signature and host-based room playback rules |

## Sprint 1 — Stabilization and maintainability

| Backlog doc | GitHub issue | Status | Goal |
| --- | --- | --- | --- |
| `05-classic-unlock-e2e-coverage.md` | #6 | Delivered on `main` | Classic unlock end-to-end coverage |
| `06-artist-publish-e2e-coverage.md` | #7 | Delivered on `main` | Artist publish end-to-end coverage |
| `07-room-join-e2e-coverage.md` | #8 | Delivered (see delivery notes in the ticket) | Room join and host-access playback end-to-end coverage |
| `18-production-preview-assets.md` | #27 | Retired by ticket 24 P1 (delivered, then consciously removed with the preview doctrine) | Separate preview assets for server-keyed protected tracks |
| `08-frontend-feature-module-refactor.md` | #9 | Delivered on `main` | Frontend feature-module refactor |
| `09-generated-abi-bindings.md` | #10 | Delivered (see delivery notes in the ticket) | Generated ABI bindings |

## Sprint 2 — Product hardening and philosophical differentiation

| Backlog doc | GitHub issue | Status | Goal |
| --- | --- | --- | --- |
| `10-observability-health-checks.md` | #11 | Backend + signaling slice delivered (see delivery notes); frontend surface open | Observability and health checks |
| `11-proof-of-personhood-integration-research.md` | #12 | Open | Proof of Personhood integration research |
| `12-ambassador-social-propagation-model.md` | #13 | Open | Ambassador and social propagation model |

## Design track - Living Light experience

Presentational UX work derived from `design/Dotify-design/` (the "Living Light" prototype and redesign brief). This track is parallelizable with the spine and must not block or destabilize it: behavior is preserved and the aura is pure presentation. Honesty rule applies throughout - no UI element may imply a capability (persisted mood, broadcast chat, fabricated stats) the backend does not have.

| Backlog doc | Status | Goal |
| --- | --- | --- |
| `13-living-light-design-foundation.md` | Delivered on `main` | Aura engine, presence, dock, immersive-room presence, hero/typography/cover-fallback polish |
| `14-one-link-room-creation-sheet.md` | Delivered on `main` | "As easy as sharing a link" room-create sheet over the existing createSession |
| `15-immersive-room-parity.md` | Delivered (chat via #20) | Room code pill + copy, access chips, sync note; the deferred chatter aside landed with `20-room-social-layer.md` |
| `16-wallet-connected-identity-card.md` | Delivered on `main` | Calm connected-wallet identity card with real, non-fabricated stats |
| `17-artist-studio-living-light-parity.md` | Delivered on `main` | Studio identity header, metric cards, sovereignty card, releases + support showcase |
| `19-constellation-design-track.md` | Phases A-C prototyped (see delivery notes) | Constellation direction: The Stage (aura lamp rail), Sky of rooms, micro-moments (`docs/design/dotify-constellation-ux.md`) |
| `20-room-social-layer.md` | Delivered on `main` (PR #67) | Broadcast reactions (attributed petals) + in-room chat over the signaling relay; 50-message in-room history, rate-limited, fail closed |
| `22-living-interface.md` | Delivered on `design/living-interface` | Living Interface: borders replaced by aura-tinted tonal layering, relaxed geometry, deep-glass floating layers, conversational chat bubbles, one breathing motion curve (`docs/design/dotify-living-interface.md`) |
| `23-room-identity.md` | Layer 1 delivered on `feat/room-identity` | A pseudonym set once per wallet: off-chain per-address display name, auto-filled into room create/join; Layer 2 (link/QR join step) and on-chain handle registry are future (`docs/design/room-identity.md`) |
| `25-thresholds-functional-v1.md` | In progress - publication quarantined, 0/2 runtime hotfixes | Selected `Thresholds` direction: real room-link threshold, warm editorial listening hierarchy, retired-preview copy cleanup, and production-spine security hardening (`docs/design/dotify-thresholds.md`) |

Delivered on `main`: album-aura engine (`web/src/utils/aura.ts`, `components/AuraBackground.tsx`), aura-colored cover fallbacks (`hooks/useCatalog.ts`), presence avatars (`components/Presence.tsx`), player dock (`components/PlayerDock.tsx`), create-room sheet (`components/CreateRoomModal.tsx`), immersive-room cover-glow/EQ/reactions/header/sync-note (`views/PlayerView.tsx`), wallet connected card (`components/WalletModal.tsx`), studio showcase (`views/artist/ArtistConsole.tsx` + `OverviewTab.tsx`), Hanken-only app type with system mono for code, featured aura hero on Home, and the Living Light stylesheet block in `web/src/styles.css`. The old node/warp `AmbientCanvas` / `StarfieldCanvas` are removed.

Deferred (needs a backend channel or separate design asset, deliberately not faked): persisted room mood; the custom Dotify logo (`design/Dotify-design/Dotify - Logo.html`). Room chat / "say something" is no longer deferred: `20-room-social-layer.md` wired reactions and chat over the signaling relay.

## Dotify v2 - strategic pivot

| Backlog doc | Status | Goal |
| --- | --- | --- |
| `24-access-streaming-v2.md` | P1/P2 delivered; P3 first vertical slice delivered with DAV2 refs, playback fallback, and startup metrics (design in `docs/design/dotify-v2-access-and-streaming.md`) | Remove the 42% preview; three-mode artist policy (free / paid / human-free via Proof of Personhood); sign-once session auth for key delivery; encrypted chunked streaming (`dotify.audio.v2`) for fast starts; Polkadot App stack citizenship (Triangle, PoP, Coinage, DotNS, Statement Store) |

Ticket 24 supersedes the preview-based rows above: the 42% doctrine and the
ticket 18 preview assets are consciously retired by access model v2.

## Strategic improvement plan

`improvement-plan.md` tracks the July 2026 review of the implementation
against the product/technical/philosophical memory and the Polkadot/Parity
principles Dotify claims. It sequences the remaining spine work (Now), the
differentiating moves (Next: real Individuality integration, statement-store
presence, Triangle host citizenship), and the social-depth work (Later).
Nothing in Next or Later starts before the spine is green. The PR8b
providers/context boundary for ticket 08 is designed in
`08b-providers-design.md`.

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

Sprint 0, Classic unlock e2e coverage, and artist publish e2e coverage are delivered on `main`. Execute the remaining Sprint 1 items next. Do not start ambassador mechanics, awards, or advanced social graph work until deterministic tests, DAV2 playback validation, modularization, and ABI generation are stable.

The philosophical line is simple: make the social listening experience as frictionless as a shared link, while keeping the artist-owned runtime and access policy as the invisible foundation.
