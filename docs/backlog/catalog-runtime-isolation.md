# Isolate artist-runtime catalogue failures

Issue: [#486](https://github.com/knzeng-e/dotify/issues/486).

Priority: P1. Track: Production spine. Phase: Now. Type: Work.

Base: `2198a44781f1d3ace322859f9eaee4131ede1a62`, the merged #485 tree.
Its tree is identical to the reviewed payment PR.

## Problem and outcome

An artist can legitimately replace/remove selectors in their own Diamond.
The catalogue currently treats its revert or incompatible ABI as a global RPC
outage. That blocks new key grants even for healthy artists. The system audit's
A01 reproduction confirmed this path. A runtime must control its own discovery
availability without acquiring availability control over other artists.

## Implementation plan

1. Classify deterministic runtime execution/ABI failures separately from
   transport/RPC outages. Unknown failures remain global and fail closed.
2. Bound untrusted runtime enumeration, response bytes, call resources and total
   scan time. A policy excess excludes the whole runtime rather than truncating
   releases, rights or splits. Cancel/drain started reads before writer release.
3. Persist per-runtime exclusion diagnostics with the confirmed snapshot.
   Exclude all records of an unavailable runtime atomically. Keep healthy
   releases fresh and subject to their existing independent on-chain key checks.
4. Cover cold reindex, incremental updates, known-empty optimization, repair
   retry/reconciliation, restart/shared snapshots, checkpoint/reorg and persistence
   failure. A repaired runtime is read fully before exclusion is lifted.
5. Document reader limits, quarantine/retry policy and coordinated API rollout.
   The owner-selected clean-generation deployment remains a later operation.

## Acceptance

A healthy release still gets a verified key verdict with a second runtime that
reverts, has no matching selector, returns invalid ABI, advertises excessive
work or exceeds a bounded scan. The affected runtime cannot get a key grant.
Real RPC failures retain global outage metadata and deny keys; failed writes or
canonicality checks never advance the in-memory authoritative checkpoint.

Tests must use the real Viem error/transport shapes where classification or
cancellation matters. Quarantine metadata must survive local and shared-state
reload and participate in content revisions. Recovery without an event remains
bounded periodic reconciliation, including for excluded runtimes with zero
accepted releases. No deployment, new publication or transaction is part of
this source change. Finality hardening (A09) and other audit findings retain
separate scopes before the full redeployment.

Canonical reader policy: [runtime isolation reference](../reference/catalog-runtime-isolation.md).
