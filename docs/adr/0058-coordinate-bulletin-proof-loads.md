# 0058 — Coordinate initial Bulletin proof reads

Date: 2026-11-13. Status: candidate; not deployed. Refs #407.
Refines only the concurrent cold-read policy of
[ADR 0050](0050-bulletin-proof-reuse-and-wave-ordering.md).
[Local evidence](../backlog/implementation/evidence/bulletin-cold-proof-2026-11-13.md).

## Problem

The publisher verifies several finalized stores concurrently. A completed-only
cache already avoids repeated body/event downloads for sequential checks, but
simultaneous initial requests can all miss it. Replaying four confirmations of
the captured public receipt downloads the same body/events four times. The
current custody proof-reader window is two, so that four-caller replay exercises
the transport interface, not four new live transactions or the exact live window.

Avoid those duplicate downloads without changing finality, fresh eligibility,
per-query ownership checks, graph format or the durable write protocol.

## Decision

Coordinate initial proof loads by their exact canonical block hash inside each
transport. A caller first selects its own finalized snapshot, CID metadata,
retention and canonical hash. A completed cache hit is verified immediately.
On a miss, the caller waits for its own turn for that hash, rechecks the cache,
and loads the bounded body/events only if they are still absent. It verifies its
own sender, nonce, direct store payload and event before retaining owned bytes.
An unmatched or failed initial query does not populate the cache.

`bulletinProofLoads.ts` permits two distinct active hashes and at most 64 waiting
callers. It skips peers of an active hash when another hash can progress. Thus a
slow hash does not impose a global serial queue, and a completed cache hit does
not wait for either slot. The body and parent-runtime/event branches still
execute in parallel under the existing dedicated-client RPC read limit.

Only scheduling is shared. Callers never await another caller's payload promise
or inherit its receipt. Each queued entry has its own abort signal; cancelling
it removes that entry before any payload RPC. Each active load is raced against
its owner's existing deadline so an injected abort-ignoring request cannot keep
its scheduler slot forever. A late response rechecks that signal before cache
retention. The existing PAPI close-on-abort policy still destroys its dedicated
client; this change does not make a closed client reusable or promise physical
cancellation of an uncooperative injected RPC.

## Boundaries and tradeoffs

The existing completed cache remains limited to two entries and 12 MiB of
encoded body/event payload, not total process heap. Existing individual body,
event, metadata, RPC and publication bounds remain. Active/waiting scheduling
state is process-local and disappears with the transport. No queue/profile,
nonce, allowance, CID, receipt schema, timeout, signer, key or admission changes.
No store retry, renewal or new format activation is added.

A single global loader would also remove duplicates but would block unrelated
hashes; the two-key scheduler avoids that regression. A shared in-flight payload
promise would require separate cancellation ownership; waiting for a completed
verified entry preserves the existing caller model. Fresh authorization,
retention and block-number mappings must never become cache entries.

A failed/unmatched loader can require another download. Different hashes and
LRU eviction also require new payloads. Keeping those reads is preferable to
reusing an unverified or incorrectly scoped result. The existing trusted-RPC
boundary remains; receipt checking is not an independent consensus proof.

## Acceptance and delivery

Tests cover concurrent same-hash reuse, distinct-hash overlap, independent
canonical/retention reads, cache-hit bypass, failed/unmatched loads, active/queued
cancellation, a late provider response and queue capacity. Existing sender/nonce,
wrong-network, expired-storage, payload-size and journal/publication tests remain.
The evidence records request counts, not an artist-facing speedup or finality ETA.

Review and a separately scoped custody delivery remain before live use. A future
real publication measurement needs its own approved source/budget. The owner has
deferred the real recovery rehearsal; this performance change neither resumes
it nor waives the existing activation/public-pilot gates. #407 stays open.
