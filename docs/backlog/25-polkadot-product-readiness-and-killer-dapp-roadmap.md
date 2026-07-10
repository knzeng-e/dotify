# Dotify Polkadot Product readiness and killer dapp roadmap

**Date:** 2026-07-10  
**Status:** Proposed execution plan  
**Branch reviewed:** `feat/observability-health-checks`

## Executive verdict

Dotify can become a production-grade Polkadot Product, but the current application is not yet compliant with the Product execution model.

The existing protocol choices remain valuable:

- artist-owned SmartRuntimes on Asset Hub EVM;
- encrypted, content-addressed audio;
- Bulletin/IPFS manifests and deployment;
- host-based room access;
- WebRTC for ephemeral media;
- Proof-of-Personhood-ready access modes;
- DotNS identity;
- Statement Store as the future signed presence layer.

The required change is architectural rather than philosophical: Product mode must stop treating the browser as an unrestricted integration surface. Chain access, signing, storage, local persistence, permissions, and approved outbound requests must cross the Host boundary through the Product SDK / TrUAPI.

The roadmap therefore has two non-negotiable goals:

1. **Production spine:** the experience is fast, observable, secure, and reliable.
2. **Polkadot Product citizenship:** the same Dotify product can run in Polkadot Desktop, Polkadot Web, and the mobile Polkadot App without handling root keys or bypassing Host permissions.

Only after those are stable should Dotify spend product complexity on ambassador economics, transparent awards, and collectible recognition.

---

## Terminology

The official platform term is **Polkadot Triangle**, not “Trinity”. The Triangle consists of:

- Polkadot App on mobile;
- Polkadot Desktop;
- Polkadot Web;
- Products running inside those Hosts;
- TrUAPI as the Host–Product protocol.

“Trinity” may remain an internal codename, but public architecture, documentation, and acceptance criteria should use the official terms **Triangle**, **Product SDK**, **Host**, and **TrUAPI**.

---

## Target architecture

Dotify should use a ports-and-adapters boundary so the product logic survives both standalone web and Triangle execution.

```text
                         Dotify React experience
                                  |
                          Product-neutral use cases
                                  |
                  +---------------+----------------+
                  |                                |
      Standalone browser adapters       Polkadot Product adapters
      - injected EVM wallet              - Product SDK signer
      - direct/public RPC                - Product SDK chain-client
      - browser local storage            - Product SDK local-storage
      - direct gateway reads             - cloud-storage / Host egress
      - Socket.IO signaling              - Statement Store presence
                  |                                |
                  +---------------+----------------+
                                  |
                    Dotify protocol and media planes
```

Recommended package/module boundaries:

```text
web/src/platform/domain/
web/src/platform/standalone-web/
web/src/platform/polkadot-product/
web/src/features/
web/src/shared/ui/
```

The UI and domain use cases consume interfaces. They must not import `viem`, PAPI, injected-wallet APIs, or Product SDK packages directly.

### Plane 1 — Product and identity

- Product manifest with least-privilege permissions.
- Product-scoped derived accounts.
- Host-mediated signing and transaction submission.
- Product local storage for drafts, preferences, and safe caches.
- Proof of Personhood checks that disclose only the minimum required fact.
- DotNS `.dot` entry and Triangle-compatible deployment.

### Plane 2 — Protocol and durable data

- SmartRuntimes remain the durable source of truth for ownership, policy, access, royalties, and economic settlement.
- Bulletin/cloud storage holds manifests, release metadata, and durable content-addressed artifacts.
- A catalog read model indexes on-chain truth for fast UI reads.
- Statement Store carries signed short-lived presence, room discovery, heartbeats, reactions, and cultural provenance where appropriate.

### Plane 3 — Real-time media

- WebRTC remains the ephemeral audio plane.
- TURN is required for production reliability.
- Mesh is acceptable for small rooms; an SFU is required for larger public rooms.
- Signaling remains on a low-latency channel until Statement Store measurements prove it can safely carry SDP/ICE.
- A read-through edge/media gateway accelerates immutable IPFS assets without replacing their content-addressed identity.

### Plane 4 — Operational services

- Backend upload/transcoding/encryption.
- Content-key authorization and short-lived delivery.
- Catalog indexer/read API.
- Observability, rate limiting, secrets rotation, abuse protection, and incident response.

These services are compatible with decentralization when their trust boundaries are explicit, replaceable, observable, and progressively minimized. “Everything on-chain” would not make streaming more sovereign; it would mostly make it late.

---

## Polkadot Product readiness matrix

| Capability | Current Dotify state | Required target |
| --- | --- | --- |
| Product packaging | Static React/Vite + Bulletin single-file build | Product bundle + manifest + `.dot` deployment |
| Host execution | Ordinary browser-first | Desktop/Web/mobile Host compatibility |
| Chain reads | Direct RPC via viem/PAPI | Product SDK `chain-client` in Product mode |
| Signing | Injected EVM wallet path | Host-mediated signer and product-scoped account |
| Permissions | Browser/env configuration | Explicit least-privilege Product permissions |
| Outbound network | Unrestricted browser fetch/WebSocket | Narrow `ExternalRequest` patterns and graceful denial |
| Local persistence | Browser storage | Product SDK local storage in Host mode |
| Bulletin storage | Direct PAPI/scripts/backend | Product SDK cloud-storage where stable |
| Presence | Central Socket.IO relay | Statement Store room index/presence, measured migration |
| Media | WebRTC mesh | TURN + metrics; SFU path for scale |
| Personhood | Mock/admin mapping | Live privacy-preserving Host/People Chain check |
| Compatibility | Browser E2E | Desktop + Web + mobile + standalone release matrix |
| SDK evolution | Direct dependency coupling risk | Pinned SDK + adapter layer + conformance tests |

### Important maturity warning

Product SDK and TrUAPI are actively evolving prototype/reference implementations. Dotify must therefore:

- pin exact versions;
- avoid importing low-level TrUAPI outside the platform adapter;
- prefer stable Product SDK packages;
- feature-detect Host capabilities;
- test every release against the supported Hosts;
- provide a user-visible compatibility failure instead of unsafe fallback.

---

## Production performance spine

### P0 — Measure the experience

Export p50/p75/p95 metrics for:

- shell and catalog readiness;
- cover fetch/decode;
- access decision and key authorization;
- gateway selection;
- DAV2 header and first range;
- decrypt and SourceBuffer append;
- metadata ready and first audio;
- room signaling, ICE, TURN relay, first remote audio, reconnect;
- failure and fallback rates by browser/device/gateway.

Budgets:

| Metric | p75 target |
| --- | ---: |
| Useful shell | < 800 ms |
| Hero cover cold mobile | < 1 s |
| Free click-to-first-sound | < 1.5 s |
| Authorized protected first sound | < 2 s |
| Warm next-track transition | < 700 ms |
| Room join-to-audio | < 1.5 s |
| Room reconnect | < 3 s |

### P0 — Fast catalog

Implement #86:

- event-driven indexer/read model;
- one cacheable Home request;
- pagination, ETag, stale-while-revalidate;
- source block/indexer lag metadata;
- deterministic rebuild and reconciliation;
- on-chain reads retained for security-sensitive preflight, not browsing.

### P0 — Fast artwork

Implement #87:

- responsive AVIF/WebP variants;
- generated placeholder and intrinsic dimensions;
- immutable CID caching;
- gateway racing/timeouts;
- one high-priority hero image, lazy loading elsewhere;
- no raw multi-megabyte original in catalog cards.

### P0 — Fast audio

Implement #88:

- bounded and hedged gateway requests;
- smaller first DAV2 chunk;
- read-ahead pipeline;
- Web Worker decryption;
- intent-based prefetch;
- one authoritative access/key decision on the hot path;
- explicit browser fallback matrix.

### P1 — Reliable rooms

Implement #89:

- production TURN;
- WebRTC quality telemetry;
- reconnect and host-disconnect behavior;
- conservative mesh limits;
- SFU decision record and migration path;
- Statement Store for signed discovery/presence/provenance before SDP/ICE migration.

---

## UX direction: from interface to encounter

The current Living Light direction is distinctive and worth keeping. The aura, persistent player, shared-room doctrine, and artist-sovereignty language give Dotify a soul that a generic streaming clone would not have.

The problem is hierarchy: the Home currently tells the philosophy through many surfaces before delivering the primary experience. A killer dapp does not explain the bridge while the user is still waiting to cross it.

### Target information architecture

1. **Live now** — one room or release, one dominant action.
2. **Rooms** — visible people, music, and immediate entry.
3. **Discover** — one catalog representation, not a duplicated stage plus grid.
4. **Persistent player** — continuity across every view.
5. **Artist space** — story, releases, transparent support, rights and recognition.
6. **You / Pass** — identity and support history without turning the listener into an advertising profile.

### Value-before-wallet rule

```text
open link
  -> see the room and artist
  -> confirm a lightweight name
  -> hear music
  -> react / request / connect
  -> support, verify humanity, or claim recognition only when useful
```

No wallet, chain, contract, CID, signature, or RPC language should appear before the user's chosen action requires it.

Translate system actions into human actions:

- `Connect wallet` -> `Use my Dotify Pass` or `Support this artist`;
- `Sign message` -> `Confirm this action`;
- `musicRoyPayAccess` -> `Unlock and support`;
- `Human free / DIM1` -> `Free for verified humans`;
- `transaction pending` -> `Your support is being confirmed`;
- `metadataRef` -> `Rights record`.

### The aura must become functional

Keep aura only where it carries information:

- active artist/release identity;
- room mood generated from actual music metadata or listener-selected state;
- presence and reactions;
- transition between discovery and shared space;
- accessible status cues paired with text, never color alone.

Remove ambient effects that compete with first action, hurt low-end devices, or imply fabricated activity.

---

## The killer dapp loop

Dotify becomes defensible when one coherent loop joins social, economic, and philosophical value:

```text
A person receives a room link
        -> hears an artist immediately
        -> shares a moment with visible humans
        -> reacts or proposes the next track
        -> voluntarily supports or follows the artist
        -> provenance remembers who helped the music travel
        -> the artist recognizes meaningful ambassadors
        -> those ambassadors create the next shared moment
```

### Social layer

- rooms as places rather than broadcast widgets;
- visible presence without compulsory identity exposure;
- collaborative queue with host stewardship;
- reactions, chat, and room rituals;
- provenance of discovery with consent and expiry.

### Economic layer

- transparent royalty split before support;
- direct support and access without platform-account bureaucracy;
- artist-defined ambassador campaigns;
- auditable reward pools and claim rules;
- optional sponsored rooms or community unlocks only after abuse modelling;
- no transferable platform token required for MVP.

### Philosophical layer

- music as a common, not a bait mechanism;
- personhood without surveillance;
- sovereignty without solitude;
- transparency without public overexposure;
- economic recognition without financializing every gesture;
- artists choose how their work participates in the commons.

The philosophy must be encoded in defaults and constraints, not merely written in explanatory cards.

---

## Ambassador, awards, and recognition sequencing

Issue #13 is the research and design umbrella. Its scope now includes cultural provenance, transparent awards, ambassador contracts, anti-Sybil design, and optional NFT recognition.

Required order:

1. #12 live Proof of Personhood research/build path.
2. #85 Product SDK/TrUAPI compatibility.
3. #86 fast catalog/read model.
4. #88 measured fast playback.
5. #90 value-before-wallet social UX.
6. Statement Store presence/provenance slice.
7. Ambassador experiment with no transferable token.
8. Transparent awards pilot.
9. Optional artist-issued recognition NFTs.

NFTs should recognize contribution, access, or memory. They should not pretend that cultural care is a speculative asset class.

---

## North-star product metrics

Do not optimize raw wallet connections or transactions. Optimize human and artist outcomes:

- time to first sound;
- room link open -> first audio completion;
- value-before-wallet rate;
- shared listening minutes;
- repeat hosts and listeners;
- new artist-listener connections;
- room -> voluntary support conversion;
- artist revenue and distribution transparency;
- meaningful ambassador-attributed connections;
- percentage of support reaching declared recipients;
- accessibility and low-bandwidth success rate.

Guardrail metrics:

- signature abandonment;
- wallet/permission prompt frequency;
- bot/collusion rate;
- privacy complaints and deletion requests;
- room abuse reports;
- payout concentration;
- gateway/key/signaling failure rates.

---

## Updated execution order

### Phase 0 — Close the production spine

- #11 frontend observability surface.
- Reconcile #33–#37 with delivered code versus actually deployed operations.
- #86 cached catalog read model.
- #87 responsive covers and resilient media delivery.
- #88 DAV2 startup pipeline.
- production environment and secret guards.

### Phase 1 — Become a Polkadot Product

- #85 Triangle/Product SDK compatibility layer.
- Product manifest and permission UX.
- Host-mediated accounts/signing/chain/storage.
- `.dot` deployment through the supported deploy tooling.
- Desktop/Web/mobile/standalone compatibility matrix.
- #12 live Proof of Personhood build ticket from research output.

### Phase 2 — Make shared listening effortless

- #90 one-click room and wallet-later UX.
- #89 TURN and room quality.
- Statement Store room discovery, presence, and signed provenance.
- SFU only when room size and host uplink data justify it.

### Phase 3 — Add cultural economics

- #13 ambassador/provenance model.
- artist-controlled recognition experiments.
- transparent PoP-aware awards pilot.
- optional NFTs as certificates or memories.

### Phase 4 — Scale with integrity

- multi-region media/read services;
- replaceable or threshold key-service design;
- moderation and dispute process;
- public reliability/security review;
- mainnet deployment gates.

---

## Release gate

Dotify is ready for a public production claim only when:

- the core listener journey meets performance budgets;
- two strangers can reliably share a room on hostile networks;
- Product mode respects Host permissions and never handles root keys;
- standalone and Triangle builds have deterministic tests;
- secrets, key custody, and production environment validation fail closed;
- artist publication, free access, paid access, and room access are observable end to end;
- the interface delivers value before asking for wallet or identity;
- security and decentralization claims state exactly what is trusted and what is not.

The final line remains simple: **make the technology disappear so the human relation can appear.**
