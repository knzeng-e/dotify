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
6. A listener can join that room via a simple link.
7. Critical flows are covered by automated tests.

## Sprint 0 — Production spine

| Ticket | Goal |
| --- | --- |
| 01 | Backend key service skeleton |
| 02 | Server-side Pinata uploads |
| 03 | Wallet-signed content-key requests |
| 04 | Hosted signaling and room join links |

## Sprint 1 — Stabilization and maintainability

| Ticket | Goal |
| --- | --- |
| 05 | Classic unlock end-to-end coverage |
| 06 | Artist publish end-to-end coverage |
| 07 | Room join end-to-end coverage |
| 08 | Frontend feature-module refactor |
| 09 | Generated ABI bindings |

## Sprint 2 — Product hardening and philosophical differentiation

| Ticket | Goal |
| --- | --- |
| 10 | Observability and health checks |
| 11 | Proof of Personhood integration research |
| 12 | Ambassador and social propagation model |

## Engineering bar

All implementation must be production-minded:

- no frontend-bundled production secrets;
- no silent wallet fallback for public user flows;
- no hidden dev account signing in production paths;
- typed APIs and explicit error states;
- deterministic tests for critical flows;
- small modules, not more monolithic `App.tsx` growth;
- security assumptions documented in code and docs;
- user-facing errors must be understandable without blockchain expertise.

## Recommended execution order

Execute Sprint 0 first. Do not start ambassador mechanics, awards, or advanced social graph work until the production spine is stable.

The philosophical line is simple: make the social listening experience as frictionless as a shared link, while keeping the artist-owned runtime and access policy as the invisible foundation.