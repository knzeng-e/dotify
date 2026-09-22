# W27 — Prove Product-native room realtime with Celerity

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W27** only after W13 has an accepted pilot candidate and the owner activates issue #214 for a later sprint. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record.

- Branch: `feat/celerity-room-realtime` created from the latest tested `origin/dev` when work starts.
- Dependencies: W09, W11, W13, and the merged Product room-beacon discovery slice.
- Release stage: Next Product sprint; inactive until the W13 pilot decision.
- Existing issue: #214. Coordinate with Product compatibility epic #85 and room resilience #89 without closing either.
- Product purpose: move Dotify's social presence toward decentralized, signed communication while keeping entry as simple as opening a room link.

## Outcome

Dotify has an evidence-based decision for each room event class: migrate it to Celerity, keep it hybrid, or retain Socket.IO. Product participants can exercise the selected Celerity path behind an opt-in flag, while anonymous web guests retain the canonical room-link journey and reliable audio.

Celerity and the Polkadot Statement Store are the same underlying network-layer publish/subscribe protocol. The room-beacon implementation is the first deliberately narrow Celerity slice, not a separate technology.

## Read first

- `docs/explanation/product-devnet-architecture.md`
- `docs/backlog/polkadot-product-readiness-and-killer-dapp-roadmap.md`
- `docs/backlog/04-hosted-signaling-room-join-links.md`
- `docs/backlog/implementation/W09-room-resilience.md`
- `docs/backlog/implementation/W11-product-devnet-journey.md`
- accepted W13 evidence and the Product room-discovery evidence record
- `web/src/hooks/useSession.ts`
- `web/src/features/rooms/roomBeacon.ts`
- `web/src/features/rooms/roomBeaconPublisher.ts`
- `web/server/signaling.mjs`
- `docs/reference/socket-events.md`
- the pinned `@parity/product-sdk-statement-store` and `@parity/product-sdk-host` APIs in the installed dependency graph
- [Parity's Statement Store/Celerity protocol explanation](https://www.parity.io/blog/what-is-polkadot-statement-store)

## Product invariants

- A listener can open a canonical room link, choose a room name and listen without a wallet, Product account or blockchain knowledge.
- WebRTC plus TURN or a future SFU remains the media path. Celerity never carries audio, protected source URLs or content keys.
- The host is authoritative for player and lineup mutations. A listener cannot manufacture a state transition by publishing a statement.
- A delayed, duplicated, reordered or missing statement converges safely and never opens protected access.
- Public statements contain no listener wallet, plaintext private chat, exact location or durable listening history.
- A recent signed beacon or presence event is not presented as proof that joining or media delivery will succeed.
- The default deployment keeps its current reliable transport until live evidence justifies changing one responsibility at a time.

## Guarantee matrix to establish before implementation

Document the required semantics for every current Socket.IO event before routing it. At minimum, classify:

| Event class                        | Expected direction                          | Required guarantees                                                                |
| ---------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Room discovery and coarse presence | Celerity-first candidate                    | Expiry, bounded disclosure, deduplication; best effort is acceptable               |
| Reactions and typing indicators    | Celerity candidate                          | Short TTL, deduplication; loss is acceptable                                       |
| Track requests                     | Hybrid candidate                            | Authorship, acknowledgement, replay protection, host accept/reject result          |
| In-room chat                       | Celerity candidate for Product participants | Encryption, message identity, bounded retry, local ordering and explicit retention |
| Player snapshots and queue changes | Hybrid candidate                            | Host signature, monotonic sequence, acknowledgement or periodic reconciliation     |
| Join, capacity and role assignment | Keep Socket.IO until proven                 | Atomic admission, authoritative occupancy, reconnect ownership and denial reason   |
| SDP/ICE rendezvous                 | Feasibility spike only                      | Confidentiality, fragmentation/reassembly, expiry, retry and glare handling        |
| Audio/media                        | Never Celerity                              | WebRTC/TURN/SFU transport and existing access boundary                             |

The implementation may refine this table from measured evidence. It may not weaken a guarantee merely to increase the migrated event count.

## Work sequence

1. Extract a typed `RoomRealtimePort` around the current client realtime responsibilities without changing default behavior. Keep media peer ownership separate from the event transport.
2. Define compact, versioned Celerity envelopes with room scope, event kind, message id, producer id, producer sequence, creation time, expiry and payload version. Enforce the pinned SDK's real encoded-size and account-budget limits at the boundary.
3. Add validation, deduplication, replay rejection and deterministic convergence rules before any dual publishing. Critical host state uses monotonic snapshots and periodic reconciliation rather than assuming global ordering.
4. Add an opt-in Product-only Celerity adapter. Start with observation or dual-publish mode so the existing Socket.IO path remains authoritative and user-visible behavior does not depend on Celerity.
5. Move only low-risk event classes after evidence: coarse presence first, then reactions or typing. Add requests, chat or player state separately according to the guarantee matrix.
6. Add application-layer encryption and key agreement before private chat or direct signaling uses Celerity. Never treat protocol signatures as payload confidentiality.
7. Run a bounded SDP/ICE experiment against the pinned SDK. Measure compression and fragmentation overhead, incomplete-message cleanup, retries and mobile behavior. Do not ship it as the join path unless it beats the existing reliability and guest-access boundaries.
8. Evaluate Product Host `ChatManager` for invitations, scheduled artist sessions, room reminders and `Join` / `Support artist` action buttons. Treat it as a Host surface, not as an assumed replacement for Dotify's embedded room chat.
9. Make transport provenance and degraded state observable to operators without adding infrastructure vocabulary to the listener UI.
10. Produce a responsibility decision matrix and rollback plan. Remove a Socket.IO responsibility only in a later reviewed change with equivalent tests, telemetry and guest behavior.

## Acceptance and meaningful verification

- Two real Product clients exchange every selected Celerity event class on the same candidate build.
- Evidence records end-to-end latency distributions, loss, duplicates, reorder, reconnect, expiry and background/network-change behavior; a happy-path screenshot is insufficient.
- Deterministic tests cover Socket.IO-only, Celerity observation/dual mode, Celerity unavailability, duplicate/reordered statements and fallback.
- Anonymous standalone-web guests still join and listen through the canonical link with no Product identity.
- Critical player and queue state converges after dropped statements, host reconnect and listener reconnect.
- Private payload tests prove the public statement does not contain readable chat or signaling content.
- Payloads are tested after the SDK's actual encoding, including fragmentation overhead where relevant.
- The evidence ends with `migrate`, `hybrid` or `retain Socket.IO` for every event class, including the reason and rollback trigger.
- No default flag is enabled until the live Product evidence and W13 release boundary are reviewed.

## Scope boundary

No audio relay through Statement Store. No durable chat archive, permanent social graph or wallet-linked listening history. No forced Product identity for guests. No speculative removal of Socket.IO. No claim that best-effort gossip provides delivery, ordering, acknowledgements or encryption by itself.

## Release condition

Next Product sprint after an accepted W13 pilot candidate. The first PR should establish the port, envelope, tests and observation mode; user-visible transport authority changes should be split by event class.

## Handoff

Write `docs/backlog/implementation/evidence/W27.md` using `evidence-template.md`, with the Product host versions, SDK versions, tested build SHA, device/network matrix, raw aggregate measurements and the per-event responsibility decision.
