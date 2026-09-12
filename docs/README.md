# Dotify Documentation

Documentation for the Dotify decentralized music streaming platform, structured following the [Diátaxis framework](https://diataxis.fr/).

---

## Implementation playbook

[Agent implementation sequences](./backlog/implementation/README.md) provide
copy-paste prompts, short-lived branch names, dependencies, acceptance criteria,
and evidence handoffs for the Product DevNet/web pilot and later immersive and
privacy-preserving nearby discovery. Preparation is tracked in issue #130.

## Explanation

Conceptual documents that help you understand why Dotify works the way it does.

| Document | Audience | Summary |
|---|---|---|
| [Architecture Overview](./explanation/architecture-overview.md) | All | How the six system layers (identity, IPFS, EVM, Bulletin, WebRTC, frontend) connect |
| [Access Control Model](./explanation/access-control-model.md) | All | Human free vs Classic — what they mean for artists and listeners |
| [Content Protection](./explanation/content-protection.md) | All | Audio encryption pipeline, what it protects, and what it does not |
| [Royalty Settlement](./explanation/royalty-settlement.md) | All | How native runtime payments settle, become claimable on recipient failure, and stay separate from Product CASH |
| [Listening Rooms](./explanation/listening-rooms.md) | All | WebRTC peer-to-peer streaming, signaling protocol, known limitations |
| [Product DevNet Architecture](./explanation/product-devnet-architecture.md) | Maintainers | Dual-host boundaries, Product account capabilities, rooms, storage, and the proposed contract port |

---

## Reference

Precise technical descriptions for developers integrating with or contributing to Dotify.

| Document | Summary |
|---|---|
| [Hooks API](./reference/hooks-api.md) | `useCatalog`, `useSession`, `useArtistConsole` — all state, refs, and functions |
| [Contracts API](./reference/contracts-api.md) | Smart contract function signatures, parameters, events, and price conversion |
| [Socket.IO Events](./reference/socket-events.md) | Full event schema for the signaling server |
| [Dotify Audio V2 Container](./reference/audio-v2-container.md) | `DAV2` encrypted audio layout, playback contract, and startup metrics |
| [TypeScript Types](./reference/types.md) | All shared types with field descriptions |
| [Environment Variables](./reference/environment-variables.md) | Every env var, default, security note, and where it is used |

---

## Operations

Runbooks for hosted configuration and production validation.

| Document | Summary |
|---|---|
| [Deployment Configuration](./operations/deployment-configuration.md) | Netlify and Fly dashboard settings, secrets, catalog persistence, validation, and the update checklist for future env/config changes |
| [Product DevNet Deployment](./operations/product-devnet-deployment.md) | Build, publish, validate, and roll back the `dotify-test01.dot` Product DevNet app |

---

## Quick links

- [spec.md](../spec.md) — complete product specification
- [contracts/README.md](../contracts/README.md) — contract architecture and deployment
- [web/README.md](../web/README.md) — frontend local setup and build commands
- [CLAUDE.md](../../CLAUDE.md) — repository commands and development guidance
