# W34 - Take the content key off the critical path

## Delivered checkpoint, 2026-10-26

Issue #289 is a delivered record: #333 merged the current-format implementation;
#334 records the API/Web and Product 0.1.62 rollout. See
[implementation evidence](evidence/W34.md) and
[publication evidence](evidence/product-0.1.62-rollout-2026-10-25.md).
The synthetic key-wait benchmark is not physical audible-startup evidence;
#88/#287/#317/#158 retain those gates. W35/#290 is the next eligible streaming
implementation. The original assignment below is historical.

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W34** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record.

- Branch: `feat/fast-access-path` created from the latest tested `origin/dev`.
- Dependencies: W30.
- Release stage: Next (streaming experience track).
- Product purpose: an authorized listener never waits for an access check when pressing Next or Play on a queued track, and access still fails closed.

## Problem at audit

- Each protected key request performs three sequential RPC reads: directory mapping, track record, and `musicAccCanAccess` (`services/api/src/services/chainAccess.ts:301,316,406`).
- `free-key` is unauthenticated and performs the same reads on every call (`services/api/src/routes/keys.ts:284`, `chainAccess.ts:443`).
- The neighbour prefetch fetches ciphertext only; no key is prepared (`web/src/features/catalog/audioV2IntentPrefetch.ts:88,116`).

## Outcome

1. **Fewer RPC round trips.** Batch the reads (multicall or parallel reads where ordering allows) and keep every existing identity and policy check.
2. **Short verdict cache.** Cache allowed and denied verdicts for at most 30 seconds, keyed by requester, release ID, and observed block. Free verdicts are cached per release. A cache miss or RPC failure fails closed, as today.
3. **Queue key preparation.** A signed-in listener can request keys for up to N queued tracks (for example 5) in one call using the existing session token. Each track is checked individually; the response lists allowed keys and per-track denials. Room guests and anonymous visitors cannot use it.
4. **In-memory client keys.** Keys stay in memory for the session only, never in storage, and are dropped on sign-out, account switch, or chain change.
5. **Per-route limits.** Dedicated limits for `free-key` and the batch route, keyed per real client (W30).

## Acceptance and meaningful verification

- API tests: denied, revoked-session, wrong-chain, inactive-release, and mixed batch cases; cache expiry; RPC failure fails closed; free cache respects a mode change after expiry.
- Frontend tests: Next on a prepared track performs no key request; sign-out clears keys.
- Measure Next latency on a warm session before and after.
- Commands from the API and frontend rows of `common.md`.

## Scope boundary

No change to key derivation, session signing, or the room key invariant. No persistent key storage.

## Handoff

Write `docs/backlog/implementation/evidence/W34.md` using `evidence-template.md`.

## Implementation checkpoint, 2026-10-25

The implementation follows the current v3-only streaming path, not the historical
DAV2 prefetch filenames above. See [design and boundaries](../../explanation/fast-access-preparation.md)
and [verification evidence](evidence/W34.md). Parallel block-bound reads, bounded
verdicts, a five-track session batch and memory-only queue preparation are included.
Real-device first sound remains a release gate; this change is not a deployment.
