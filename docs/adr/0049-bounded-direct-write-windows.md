# 0049 — Bound direct writes independently from proof reads

Date: 2026-11-10. Status: proposed, not deployed. Refs #407; extends ADR 0039/0048.

## Decision and measured reason

“Street scriptures” publishes and plays, but preparation takes roughly 50 minutes.
Its 151 direct stores run at concurrency two; submit-through-finalization averages
32.49 seconds. Repeating small finalized waves is the observed bottleneck.
[Evidence and comparison](../backlog/implementation/evidence/bulletin-direct-write-window-2026-11-10.md).

Keep the existing finalized-wave algorithm and direct extrinsics. Add an optional
`writeWindow` with at most 16 stores / 4 MiB, separate from the existing read
concurrency (at most four, currently two). Every nonce intent is still fsynced
before submission; all started work drains before the next wave. Parent blocks
wait for verified children and the root waits for the archive and entire graph.
Inclusion alone never permits a parent, readiness or another account owner.

The explicit JSON-RPC proof seam queues at most four active requests and 64
waiters. Queued cancellation performs no read, and close rejects queued work.
PAPI's transaction watchers are separately bounded by the write window; four is
not a claim about all SDK wire traffic. A completed store enters a separate proof
lane at the unchanged profile read concurrency. No proof, CID byte read, retention
check or sender/nonce/call/event validation is removed. Existing deadlines stand.

## Exact activation and compatibility

The immutable publisher profile retains its original strict two-field pipeline
schema and normalized hash. An unclaimed **new exact release extension** may
optionally carry `writeWindow`; it applies to that identity's audio, cover and
metadata. Without the field, write limits remain the original profile limits.
The ordinary publisher resolves the extension while holding its lifetime lease,
then journals the complete effective pipeline. Startup and maintenance compare
inventories with the admitted pipeline. A retrospective edit is refused.

The existing stopped-writer request accepts this optional field; the reported
whole-release budget is unchanged. Its checked previous ledger is archived, and
all prior claims, queues, nonce reservations and receipts remain. Existing grants
cannot be replaced, including an unclaimed grant without this setting. Published
or attempted jobs are never retuned, re-encrypted or reset as a benchmark.

Older strict readers reject a window-bearing extension or inventory. Install
compatible code before separately approved activation; after it, keep compatible
code or disable publication, retaining all current state. No profile rewrite,
key rotation, larger allowance, auto-renewal or deployment follows from this PR.
The old exhausted-job maintenance recovery tool remains pilot-only; this change
adds no general multi-release recovery after its normal attempt limit.

## Alternatives and tradeoffs

Changing global profile concurrency would invalidate immutable bindings and tie
proof pressure to writes. Rolling admission before earlier transactions settle
would require a different account-cursor proof; finalized waves preserve the
existing barrier. A nested Utility batch cannot be assumed supported: the pinned
upstream storage extension rejects nested stores for direct indexing. Changing
geometry would change roots and needs separate format/recovery analysis; this
candidate preserves every fragment and rendition, including the source archive.

A larger window can leave up to sixteen uncertain nonces instead of two. It must
stop on uncertainty and reconcile, never fill a gap or re-sign automatically.
The 4-MiB data bound does not guarantee one-block inclusion: signatures, weight,
other traffic and the node pool matter. Metadata exposes block limits, not the
pool's capacity or a throughput guarantee. The offline schedule is not an ETA.
A funded pilot and actual timing/audible acceptance remain separate gates.
