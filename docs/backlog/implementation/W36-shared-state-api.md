# W36 - Move API trust state to a shared store and allow more than one instance

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W36** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record.

- Branch: `feat/shared-state-api` created from the latest tested `origin/dev`.
- Dependencies: W30.
- Release stage: Next (scaling).
- Product purpose: a redeploy or a second machine never signs people out, reopens a used nonce, or resets upload quotas.

## Problem at audit

The API is single-instance by construction (`services/api/fly.toml` sets `max_machines_running = 1`):

- nonces live in a process Map with an O(n) sweep and no size cap (`services/api/src/services/replayProtection.ts:36-47`);
- session revocations and the process epoch are local (`sessionTokens.ts:70-73`);
- upload quotas and capabilities are local (`uploadAuthorizations.ts`);
- the catalog snapshot is a single-writer JSON file (`services/catalog/snapshotStore.ts`);
- the session HMAC key is derived from the content-key master secret (`sessionTokens.ts:71`).

## Outcome

1. **Store decision.** Choose Redis (for example Upstash) or Postgres (for example Fly Postgres) with a short decision record: atomicity needs, latency, cost, backup, and failure behaviour.
2. **Atomic nonces.** Single-use nonces with expiry (for example `SET NX EX` semantics), bounded, and failing closed when the store is unavailable.
3. **Sessions.** Shared revocations; a dedicated `SESSION_SECRET` separate from content-key material, with a documented rotation; session lifetime reduced from 24 h to a few hours with silent renewal while the wallet session is valid.
4. **Upload quotas and capabilities** in the shared store, with the same limits.
5. **Catalog** stored or replicated so any instance serves the same snapshot, with one elected writer for indexing.
6. **Two instances.** Raise `max_machines_running` and record a rolling deploy with no forced sign-out and no duplicate nonce acceptance.

## Acceptance and meaningful verification

- Concurrency tests: the same nonce submitted to two instances succeeds once; a revoked session is rejected by both.
- Store outage tests: key delivery and uploads fail closed with an actionable error.
- Migration and rollback rehearsal, including secret rotation.

## Scope boundary

No signaling change (W39). No change to key derivation or access policy.

## Handoff

Write `docs/backlog/implementation/evidence/W36.md` using `evidence-template.md`.
