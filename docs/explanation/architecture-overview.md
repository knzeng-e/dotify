# Architecture overview

Dotify connects a familiar listening interface to artist-owned rights and access
rules. Its social unit is a room: an authorized host shares audio, and guests
join through an invitation without obtaining source files or content keys.

## Components and trust boundaries

| Component             | Responsibility                                                                                        | Boundary                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Web or Product client | Catalog, player, rooms and artist studio.                                                             | Public code; no production master secrets or Pinata credentials.                        |
| Backend API           | Catalog read model, upload authorization, encryption, sessions, key delivery and bounded media relay. | Verifies identity and current on-chain access; holds key material.                      |
| Artist runtime        | Catalog, ownership, access policy and value-flow rules.                                               | Contract state is authoritative; UI labels cannot grant access.                         |
| IPFS and pinning      | Encrypted audio, public covers and metadata.                                                          | Content addressing is not a promise of permanent availability.                          |
| Signaling             | Membership, scoped discovery, conversation, presence and WebRTC negotiation.                          | Current single-process room state is ephemeral. No public enumeration of private rooms. |
| WebRTC / TURN         | Host-to-guest media delivery.                                                                         | Guests can record what they hear; this is not absolute DRM.                             |
| Bulletin / DotNS      | Product app distribution and optional metadata archival.                                              | Publication and retention depend on the relevant network and operator setup.            |

These boundaries make components replaceable, but do not eliminate dependencies.
An unavailable key service can prevent new protected playback; a failed
signaling session can interrupt a room. The current API also depends on
backend-held key custody and a single-writer catalog. Artist ownership of a
runtime does not mean every hosted component is already decentralized.

## Publishing

```text
Artist account
  -> signed session and runtime-ownership verification
  -> bounded, single-use upload authorization
  -> API validates media bytes and content hash
  -> release-scoped AES-GCM encryption and IPFS pinning
  -> artist approves runtime registration
  -> catalog confirms the canonical release
```

The browser computes the content hash; the API verifies the bytes it receives.
Audio, cover and editorial metadata have separate references. Runtime access,
ownership and payment rules remain separate from descriptive metadata. A
confirmed transaction and a release visible in the catalog are distinct states.

Current publications use authenticated v3 manifests and AAC initialization and
media segments, with 96/160/320 kb/s renditions produced by an isolated encoder.
The internal reset retired DAV2 playback. Encoding and publication custody are
not steps in an ordinary listening request. Where standard AAC MediaSource is
unavailable, the current compatibility reader downloads and authenticates the
whole lowest-bitrate rendition before exposing a playable Blob. This remains a
first-sound limitation, not proof of progressive mobile playback.

## Individual listening

```text
Open catalog -> API snapshot -> choose a track
  -> verify canonical release and current access
  -> receive an allowed content key
  -> fetch ciphertext through the configured gateway/relay path
  -> authenticate, decrypt and play
```

Free tracks can request a key without a wallet after the API checks public
access. Encrypted v3 Free selection goes directly to that authoritative key
request, without first asking the Host to repeat the same chain check. Reusing
a decoded Blob still requires authorization; having media in memory is not an
access grant. Gated tracks require the applicable identity and access. Standalone
signatures use EIP-191; Product account proofs use the implemented Host adapter
and API verification scheme. If verification is unavailable or ambiguous, key
release fails closed.

The catalog API avoids enumerating every artist runtime on each browser visit.
Its single-writer snapshot advances from confirmed events and reconciliation.
Cache freshness, transaction preflight and actual access checks are different
facts. [Content protection](content-protection.md) explains key scope and its
limits.

## Shared listening and discovery

A room guest receives WebRTC media from the authorized host, not an encrypted
source or a content key. Socket.IO carries negotiation, room state and ephemeral
social events; media may travel directly or through TURN. The signaling service
is not an audio relay.

Rooms start Link only. Nearby and Worldwide discovery require host opt-in;
Nearby uses bounded approximate areas and both parties' selected ranges. Scoped
updates keep discovery current without a global private-room list. Artist
activity can include private-room totals without disclosing their identifiers.
See [room mechanics](listening-rooms.md) and the
[privacy contract](../design/dotify-nearby-discovery-privacy.md).

## Find the implementation

- `web/src/app/`: listener/artist shells, providers and navigation.
- `web/src/features/`: catalog, player, rooms, access, publishing, contributions,
  runtime ports and Product adapters.
- `web/src/hooks/`: orchestration around these modules.
- `web/src/services/`: API clients and asset resolution.
- `web/src/shared/`: types, configuration and utilities.
- `web/server/`: signaling and its tests.
- `services/api/`: the API and its persistence/custody services.
- `contracts/evm/`: factory, directory, SmartRuntime and music pallets.

### Backend API

The API uses Node 22, TypeScript and Fastify. It owns server-side pinning,
key-version custody, nonce/signature verification, durable session revocation,
catalog indexing and bounded content delivery. Its readiness diagnostics can
fail even when the HTTP process is alive. Refer to
[deployment configuration](../operations/deployment-configuration.md) before
changing origins, key versions, persistent storage or service scaling.

The test deployment separates two public API replicas from one private
publication-custody writer. PostgreSQL shares sessions, replay protection,
upload budgets and the elected catalog checkpoint; the private volume retains
encrypted jobs, permanent encryption nonce reservations and verified receipts.
The [activation record](../backlog/implementation/evidence/product-0.1.63-rollout-2026-10-28.md)
distinguishes the verified topology from physical-device and pilot acceptance.
The [October 28 first-sound audit](../backlog/implementation/evidence/mobile-first-sound-audit-2026-10-28.md)
separates these availability gains from unproven cold-start gains, current
operator dependencies, and simplification candidates. The
[managed mobile reader](../backlog/implementation/evidence/managed-mobile-audio-2026-10-28.md)
shortens the supported mobile playback path to early authenticated segments,
using native demand and buffer-recovery events. It changes the client reader,
not custody or hosting; physical Product first-sound measurements remain open.

### Artist-owned runtimes

The factory creates a SmartRuntime for an artist and the directory indexes the
finalized association. Runtime music pallets are implemented through a Diamond
proxy: each runtime has isolated storage while code can be shared. Runtime
ownership, track NFT ownership, authorship and royalty recipients are separate
facts. Use the [contract documentation](../../contracts/README.md) and generated
bindings for current interfaces.

### Product and release evidence

Product Host capabilities sit behind typed adapters; ordinary Web keeps its
own account and media paths. Capability detection, permission and a supported
installed Host are required. A browser test or frozen Product build does not
establish native media, location, signing or settlement on a physical device.

Web, Product, API and signaling are released independently. Record the served
SHA, Product executable/CID and service versions separately, then validate the
actual journeys. Start with the [Product architecture](product-devnet-architecture.md),
[publication runbook](../operations/product-devnet-deployment.md) and
[pilot plan](../operations/pilot-release-plan.md).
