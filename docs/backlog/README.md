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

| Backlog doc | GitHub issue | Goal |
| --- | --- | --- |
| `01-backend-key-service-skeleton.md` | #2 | Backend key service skeleton |
| `02-server-side-pinata-uploads.md` | #3 | Server-side Pinata uploads |
| `03-wallet-signed-content-key-requests.md` | #4 | Wallet-signed content-key requests for individual and host playback |
| `04-hosted-signaling-room-join-links.md` | #5 | Hosted signaling, room join links, and host-based room access |
| Documentation task | #15 | UX signature and host-based room playback rules |

## Sprint 1 — Stabilization and maintainability

| Backlog doc | GitHub issue | Goal |
| --- | --- | --- |
| `05-classic-unlock-e2e-coverage.md` | #6 | Classic unlock end-to-end coverage |
| `06-artist-publish-e2e-coverage.md` | #7 | Artist publish end-to-end coverage |
| `07-room-join-e2e-coverage.md` | #8 | Room join and host-access playback end-to-end coverage |
| `08-frontend-feature-module-refactor.md` | #9 | Frontend feature-module refactor |
| `09-generated-abi-bindings.md` | #10 | Generated ABI bindings |

## Sprint 2 — Product hardening and philosophical differentiation

| Backlog doc | GitHub issue | Goal |
| --- | --- | --- |
| `10-observability-health-checks.md` | #11 | Observability and health checks |
| `11-proof-of-personhood-integration-research.md` | #12 | Proof of Personhood integration research |
| `12-ambassador-social-propagation-model.md` | #13 | Ambassador and social propagation model |

## Current room access doctrine

Dotify distinguishes direct file access from room presence.

- Individual playback: the listener must satisfy the track access policy before receiving a temporary content key.
- Room playback: only the host must satisfy the track access policy.
- Room listeners do not need to connect a wallet, sign, pay, or prove access merely to listen inside a room.
- Room listeners never receive the encrypted source file or content key; they receive only the ephemeral WebRTC stream.
- If an unauthorized host selects a protected track, Dotify plays the 42% preview, shows a discreet host-facing unlock/personhood CTA, then auto-advances to the next playlist track.

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

Execute Sprint 0 first. Do not start ambassador mechanics, awards, or advanced social graph work until the production spine is stable.

The philosophical line is simple: make the social listening experience as frictionless as a shared link, while keeping the artist-owned runtime and access policy as the invisible foundation.