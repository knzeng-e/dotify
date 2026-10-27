# ADR 0036: bounded indexing with separate catalog content and progress

Status: implemented, deployment pending. Date: 2026-10-27.
Refs [W37 / #292](https://github.com/knzeng-e/dotify/issues/292).

## Decision and flow

Keep the W36 elected writer and confirmed chain authority. Bound outstanding
RPC requests across nested enumeration, release and royalty reads (default 8).
Artist directory pages retain their existing 50-entry contract view. Hash and
release work runs in bounded batches; no Multicall contract or JSON-RPC batch
support is assumed on Product DevNet. W38 owns paged track views and contract
bounds; W37 does not truncate rights data to meet a proposed future limit.

Read directory, hashes, track and split state at the selected confirmed block.
Replay at most 1,000 blocks at a time, splitting runtime address filters into
100-entry batches. Both sizes and the read budget are configurable. Finish and
persist each range before starting the next. A later RPC or persistence failure
leaves the preceding complete range available for retry/restart. Reconciliation
runs after catch-up; its five-minute deadline cannot bypass the resumable scan.
Checkpoint hash checks detect a changed branch, including a change during reads.
A forced reindex or reorg enumerates all runtimes again. Initial cold enumeration
is bounded but is not itself resumable halfway through a runtime.

Known empty runtimes skip track-count reads during ordinary reconciliation.
They remain subscribed to registration events, so their first release is read
normally. New directory entries are discovered by the existing event/page path.
An incomplete catch-up is explicitly `stale-cache` on every replica, including
a replica restarted from that checkpoint. It cannot satisfy key delivery's
existing requirement for a fresh canonical catalog. RPC/store failures retain
their distinct outage metadata. No access policy or entitlement cache is added.

## Content and progress are different facts

Build the SHA-256 content revision, maps by release ID/hash/runtime/artist and
active-release list once for each immutable pair of content arrays. Preserve
those arrays on progress-only polls. Hash matches retain all claims, so the
hash-only public detail route still rejects ambiguity. Key access uses the
complete runtime/hash identity and its existing chain/artist/source checks.

Full artist/release payloads change only when their revision changes. Freshness,
canonical block/hash, chain head and reconciliation time still advance durably:

- Local: retain the schema-1 JSON base, plus an atomic `.checkpoint` sidecar.
- PostgreSQL: retain `catalog-v1`, plus `catalog-checkpoint-v1` in the existing
  document table. A content change writes both in one short transaction.
  Progress-only writes update just the small checkpoint document.

Progress binds to the base content revision and base block/hash/time. A sidecar
left over after a rename, import or old-writer rollback cannot advance a different
base. Missing progress falls back to the coherent base and replays extra blocks;
malformed progress fails explicitly. On PostgreSQL a single SQL statement reads
a consistent pair; unchanged content returns only its small base header, reusing
parsed arrays and indexes. The same elected connection writes both full and
compact updates. Disconnection cannot move a stale writer onto a fresh connection.

No failed write advances the in-memory checkpoint, even in local mode. Otherwise
an unsuccessful content save could be followed by progress-only writes that
permanently skipped the missing release. Observers still receive each successful
persisted synchronization, even when only progress changes: the bounded media
prewarmer needs repeated observations for its admission window and propagation
retries, including after restart. Observer failures remain best-effort and do
not change the committed checkpoint. Started concurrent work drains on error
before writer election is released.

## Alternatives, limits and operations

Skipping every write on unchanged content would lose restart position and let
freshness age on idle catalogs. Rewriting a complete snapshot preserves those
facts but scales write amplification with the catalog. The separate progress
record keeps both facts with the existing storage adapters and no SQL migration.

This is one elected indexer with an in-memory catalog, not a sharded index or an
archive service. Memory and changed-content serialization remain proportional to
the catalog. The existing 16 MiB PostgreSQL document limit remains enforced;
the synthetic fixture does not establish production capacity. RPCs must retain
historical state for catch-up block reads. A provider rejecting smaller ranges
requires reducing the configured range; errors never skip blocks automatically.
A manual forced reindex can recover from unavailable history at the current
confirmed state. Measure real provider quotas/latency before tuning concurrency.

Back up the local base and sidecar together, or the whole shared namespace. A
missing/mismatched sidecar safely replays from the base. Pre-W37 binaries ignore
progress, so rollback requires a quiesced writer and a forced reindex before
serving keys; it may be much slower. Never roll W36 shared trust state back to
local state. No content keys, receipts, permanent encryption nonces, contracts,
wallet protocol, permissions or room signaling change in W37.
