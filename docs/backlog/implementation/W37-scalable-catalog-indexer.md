# W37 - Keep the catalog indexer fast and recoverable as the catalog grows

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W37** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record.

- Branch: `feat/scalable-catalog-indexer` created from the latest tested `origin/dev`.
- Dependencies: W30.
- Release stage: Next (scaling).
- Product purpose: the catalog stays fresh, and key delivery stays available, with thousands of releases and after a long outage.

## Problem at audit

- Full reconciliation every 5 minutes reads every artist and track with unbounded `Promise.all` fan-out (`services/api/src/services/catalog/readModel.ts:166-171`).
- `getLogs` covers the whole gap since the last indexed block in one call, which exceeds RPC range limits after an outage (`services/catalog/chain.ts:285-330`).
- `getRevision()` serializes and hashes the whole snapshot on every catalog request (`readModel.ts:88-91`, used by `routes/catalog.ts:41,95,118`).
- The snapshot is written to disk every poll even when nothing changed (`readModel.ts:146`).
- Release lookup by hash is linear per key request (`chainAccess.ts:265`), and `buildArtists` is quadratic (`readModel.ts:268`).

## Outcome

1. Bounded concurrency (for example 8) and batched reads for reindexing.
2. `getLogs` in bounded block ranges with resumable progress.
3. Revision computed once per snapshot.
4. Snapshot written only when artists or releases change.
5. Lookup indexes by hash, release ID, and runtime built once per snapshot.
6. Runtimes without releases do not cost a read per reconciliation beyond discovery.

## Acceptance and meaningful verification

- Synthetic load test (for example 1,000 artists and 10,000 releases against a fake gateway) with recorded duration, peak concurrent reads, and memory.
- Outage test: a gap larger than the RPC range limit catches up in chunks.
- Existing catalog, reorg-checkpoint, and access tests stay green.

## Scope boundary

No contract change (W38). No change to the freshness rule that gates key delivery.

## Handoff

Write `docs/backlog/implementation/evidence/W37.md` using `evidence-template.md`.
