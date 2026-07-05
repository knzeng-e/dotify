# Dotify Production Backlog

This folder contains the execution backlog for moving Dotify from prototype to public testnet production readiness.

The backlog is organized as engineering sprints. Each ticket has a dedicated Markdown instruction file intended for Claude Code, Codex, or a senior engineer working inside the repository.

## Product north star

Dotify is not a Spotify clone. Dotify is a decentralized cultural social hub where music becomes a live social connector, artists retain sovereignty over catalog/access/royalties, and listeners can discover music through shared real-time presence.

## Production readiness rule

Do not add ornamental product features until the following spine is stable:

1. An artist can publish a rights-managed encrypted track.
2. A listener can access preview-only playback when unauthorized.
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
| `18-production-preview-assets.md` | #27 | Open | Separate preview assets for server-keyed protected tracks |
| `08-frontend-feature-module-refactor.md` | #9 | In progress (foundation PR: vitest + access/room feature modules) | Frontend feature-module refactor |
| `09-generated-abi-bindings.md` | #10 | Delivered (see delivery notes in the ticket) | Generated ABI bindings |

## Sprint 2 — Product hardening and philosophical differentiation

| Backlog doc | GitHub issue | Status | Goal |
| --- | --- | --- | --- |
| `10-observability-health-checks.md` | #11 | Open | Observability and health checks |
| `11-proof-of-personhood-integration-research.md` | #12 | Open | Proof of Personhood integration research |
| `12-ambassador-social-propagation-model.md` | #13 | Open | Ambassador and social propagation model |

## Design track - Living Light experience

Presentational UX work derived from `design/Dotify-design/` (the "Living Light" prototype and redesign brief). This track is parallelizable with the spine and must not block or destabilize it: behavior is preserved and the aura is pure presentation. Honesty rule applies throughout - no UI element may imply a capability (persisted mood, broadcast chat, fabricated stats) the backend does not have.

| Backlog doc | Status | Goal |
| --- | --- | --- |
| `13-living-light-design-foundation.md` | Delivered on `main` | Aura engine, presence, dock, immersive-room presence, hero/typography/cover-fallback polish |
| `14-one-link-room-creation-sheet.md` | Delivered on `main` | "As easy as sharing a link" room-create sheet over the existing createSession |
| `15-immersive-room-parity.md` | Delivered, chat deferred | Room code pill + copy, access chips, sync note; chat omitted until a Socket.IO channel exists |
| `16-wallet-connected-identity-card.md` | Delivered on `main` | Calm connected-wallet identity card with real, non-fabricated stats |
| `17-artist-studio-living-light-parity.md` | Delivered on `main` | Studio identity header, metric cards, sovereignty card, releases + support showcase |
| `19-constellation-design-track.md` | Phases A-C prototyped (see delivery notes) | Constellation direction: The Stage (aura lamp rail), Sky of rooms, micro-moments (`docs/design/dotify-constellation-ux.md`) |

Delivered on `main`: album-aura engine (`web/src/utils/aura.ts`, `components/AuraBackground.tsx`), aura-colored cover fallbacks (`hooks/useCatalog.ts`), presence avatars (`components/Presence.tsx`), player dock (`components/PlayerDock.tsx`), create-room sheet (`components/CreateRoomModal.tsx`), immersive-room cover-glow/EQ/reactions/header/sync-note (`views/PlayerView.tsx`), wallet connected card (`components/WalletModal.tsx`), studio showcase (`views/artist/ArtistConsole.tsx` + `OverviewTab.tsx`), Hanken-only app type with system mono for code, featured aura hero on Home, and the Living Light stylesheet block in `web/src/styles.css`. The old node/warp `AmbientCanvas` / `StarfieldCanvas` are removed.

Deferred (needs a backend channel or separate design asset, deliberately not faked): room chat / "say something" (no Socket.IO message relay yet - see #15); persisted room mood; the custom Dotify logo (`design/Dotify-design/Dotify - Logo.html`).

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
- If an unauthorized host selects a protected track, Dotify plays the 42% preview, shows a discreet host-facing unlock/personhood CTA, then auto-advances to the next playlist track.

Current implementation caveat: server-keyed production tracks do not yet publish a separate preview asset, so unauthorized preview playback for those tracks cannot be guaranteed without falling back to demo-mode decryption. `18-production-preview-assets.md` tracks the missing production path.

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

Sprint 0, Classic unlock e2e coverage, and artist publish e2e coverage are delivered on `main`. Execute the remaining Sprint 1 items next. Do not start ambassador mechanics, awards, or advanced social graph work until deterministic tests, production previews, modularization, and ABI generation are stable.

The philosophical line is simple: make the social listening experience as frictionless as a shared link, while keeping the artist-owned runtime and access policy as the invisible foundation.
