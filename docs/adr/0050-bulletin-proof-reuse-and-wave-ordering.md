# 0050 — Reuse completed canonical proof data and order dependency work

Date: 2026-11-10. Status: accepted and deployed in #426;
[matched delivery](../backlog/implementation/evidence/bulletin-round-trips-rollout-2026-11-10.md).
[ADR 0051](0051-bulletin-compact-layout-study.md) studies the separate format alternative.
Refs #407; extends [ADR 0049](0049-bounded-direct-write-windows.md).
[Reproducible evidence](../backlog/implementation/evidence/bulletin-round-trips-2026-11-10.md).

[ADR 0058](0058-coordinate-bulletin-proof-loads.md) proposes coordinating concurrent
initial proof loads; the original deployed decision below retains its dated scope.

## Problem and decision

The owner confirms publication and sound with the exact 16-write window, but
reports about nine minutes before the wallet prompt. Existing private timings
identify repeated finality waits and the serialized public-asset tail; they do
not establish a same-file speedup or a precise wallet-render clock. Keep the
current format, all original data, graph CIDs, admission/budget and durable
nonce algorithm. Improve work inside those boundaries in two places.

For an already selected write window, compute a dependency-priority block order
without editing the original graph or journal list. Prefer nodes farther from
the root, then parents among equal-depth nodes. Compare its remaining
*equal-duration* wave count against file order using the actual receipt set and
unchanged count/byte bounds. Select it only when strictly fewer waves result;
ties and worse candidates retain file order. Legacy profiles retain file-order
scheduling. This is a scheduling heuristic, not a live duration guarantee.

In each RPC transport, retain at most two completed proof bundles with at most
12 MiB of encoded extrinsic/event payload in total. This is not a total heap
claim: decoded metadata, container overhead and active reads also use memory.
The bundle is keyed by the exact canonical block hash inside the transport's
fixed network/identity domain. Only a successful complete own-store verification
can retain owned bytes and parent execution codecs; no passthrough RPC/header
fields, credentials or query results are retained. LRU eviction discards only
reconstructible process memory. Nothing is written to custody state.

Every query still freshly selects the genesis/finalized snapshot, CID metadata,
retention and candidate block-number-to-hash mapping, then verifies the exact
sender, nonce, direct call bytes, dispatch and storage event against its own
receipt. Reusing block data cannot resurrect expired storage or transfer one
query's success to another. New hashes, errors and unmatched cold queries do
not inherit a completed bundle. Media CID byte reads remain unchanged.

Concurrent cold body/event misses deliberately keep their own payload loads.
Reusing completed bytes avoids adding a shared in-flight payload cancellation lifecycle;
it does not promise a single fetch for simultaneous callers. Existing proof
reader/RPC lane bounds and metadata-cache behavior remain. Cache hits never
replace current authorization or retention observations.

## Persistence and failure boundaries

The durable graph, roots, ordering of inventory entries, profile, pipeline
schema, scopes, budgets, permanent encryption nonces and receipt format do not
change. Scheduling is chosen after existing pending intents reconcile, before
new writes. The existing sender cursor and fsynced intent still precede every
broadcast; started work drains and uncertainty still stops admission. Parents
wait for verified children, and the root waits for the entire graph including
archival data. Readiness retains final fresh verification.

A restart rebuilds the cache and may choose an order for the still-missing
blocks only after revalidation/reconciliation. Ready-job reuse performs no new
store. The original 16 / 4-MiB ceiling is not increased. There is no new route,
environment variable, profile field, account, key or activation instruction.
Rollback to compatible #424-era code retains the same state; it must not reset
journals or downgrade to older readers unable to parse existing write windows.

## Alternatives and deliberate limits

Increasing write concurrency exposes more uncertain nonces and needs a separate
measured admission review. Rolling nonce admission before complete finalized
waves is a different cursor protocol; it is not introduced. An unconditional
priority sort can worsen byte-bound packing, so the wave-count fallback remains.

Packing several small files or inlining new CID forms changes graph identities
and may require resolver/Host/gateway compatibility and recovery changes. This
slice preserves standard existing paths and all variant/original bytes. Cover
and metadata therefore retain their three- and two-stage synthetic tails. No
public-asset stage reduction or lower store count is claimed. A larger gain in
that tail needs a separate format/compatibility design, not a hidden admission
or reader fallback.

A shared in-flight proof promise would need cancellation ownership and drain
accounting; completed-only reuse keeps the existing independent caller model.
Caching eligibility or a receipt would permit stale authority/retention or nonce
confusion, so those are always fresh/per-query. The RPC remains the existing
trusted canonical-data source; this does not turn receipt checks into a light
client or independently prove consensus.

## Evidence and rollout gate

Deterministic synthetic geometry drops from 9 to 8 stages for 88 blocks and
13 to 12 for 151 blocks, with identical bytes/CIDs and bounds. The public
captured receipt replay performs sixteen sequential verifications with one body
and event fetch; canonical/retention reads repeat. Tests cover byte/entry eviction,
changed canonical hash, bad fresh CID metadata, expiry, caller cancellation,
wrong nonce, failed cold load, journal order, dependency/root barriers and restart
reuse. These are local fixtures, not funded chain throughput or an ETA.

Review and matched custody image/maintenance approval were required before live
use and are now satisfied by the linked delivery; subsequent acceptance is in
its linked trial record. The decision itself grants no admission, image upload,
deployment, renewal or musical write authority. Any later funded validation needs
its own exact source/budget; #407 stays open until acceptable artist latency is
demonstrated.
