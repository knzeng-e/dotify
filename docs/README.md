# Dotify Documentation

Documentation for the Dotify decentralized music streaming platform, structured following the [Diátaxis framework](https://diataxis.fr/).

---

## Explanation

Conceptual documents that help you understand why Dotify works the way it does.

| Document | Audience | Summary |
|---|---|---|
| [Architecture Overview](./explanation/architecture-overview.md) | All | How the six system layers (identity, IPFS, EVM, Bulletin, WebRTC, frontend) connect |
| [Access Control Model](./explanation/access-control-model.md) | All | Human free vs Classic — what they mean for artists and listeners |
| [Content Protection](./explanation/content-protection.md) | All | Audio encryption pipeline, what it protects, and what it does not |
| [Royalty Settlement](./explanation/royalty-settlement.md) | All | How DOT payments flow from listener wallet to artist wallet |
| [Listening Rooms](./explanation/listening-rooms.md) | All | WebRTC peer-to-peer streaming, signaling protocol, known limitations |

---

## Book

A long-form companion text for learning from Dotify as it is built.

| Document | Audience | Summary |
|---|---|---|
| [Dotify Book Charter](./book/README.md) | Developers, builders, artists | Working table of contents and evidence standard for the companion book |

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

## Quick links

- [spec.md](../spec.md) — complete product specification
- [contracts/README.md](../contracts/README.md) — contract architecture and deployment
- [web/README.md](../web/README.md) — frontend local setup and build commands
- [CLAUDE.md](../../CLAUDE.md) — repository commands and development guidance
- [Book charter](./book/README.md) — how the companion book will connect product, code, and culture
