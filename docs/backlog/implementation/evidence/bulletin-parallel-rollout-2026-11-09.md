# Parallel verification delivered to custody, 2026-11-09

Refs #407. The owner explicitly authorized the registry upload, volume snapshot
and brief custody-only maintenance after #419. This record adds no new rollout
or musical allowance. [Bounded machine-readable result](bulletin-parallel-rollout-2026-11-09.json).

## Delivered identity and boundary

- Merged source: `ec8e82ae295d7f40eab781123a5ea31259b04abb`, including #418 and #419.
- Exact-source [dev CI 42698175386](https://github.com/knzeng-e/dotify/actions/runs/42698175386) is green before maintenance.
- Image: `registry.fly.io/dotify-api@sha256:b6ea3405a5c4da964673353f0867f716a480ef78b95e35807f4d5d01c00a4217`.
- Previous image/source: digest `e2c0267da90820f70493dff9c68168a786d17a05d706e1d4a5f8c778794aa98d`, source `f9fdd693`.
- Only the existing private custody image/source marker changes. Web/Product and
  both public API replicas stay on 0.1.82; the API configurations and machine
  versions are unchanged. Signaling and encoder are not updated.

#418 overlaps independent proof reads at exact selected hashes. Canonical proof,
current retention, nonce/receipt authority, write concurrency and deadlines stay
unchanged. Its earlier small verification benchmark does not prove a faster
complete publication. No musical store/finality measurement occurs in this rollout.

## Preservation and availability evidence

A fresh online check finds five ready inventories, two ready jobs, no active job
or pending outcome and cursor 1642. Custody stops normally before the existing
volume snapshot. Snapshot `vs_BOq7aY76BQJte62yLyoy` reaches **created** at
**21:26:30 UTC**, with its completion timestamp after the stop. The create command
succeeded but its response was not JSON; the operator verifies the single new
snapshot rather than creating another. A local guard prevents a duplicate request.

The same bounded read-only inspector runs once on the stopped machine without
importing application, key or signer code. All nine selected journal hashes and
counts match the before-stop observation. Only then is the immutable image
installed, with the normal command, encrypted mount, resources, secrets and
existing on-failure/ten-retry policy retained.

After normal startup, independent checks at **21:29:58** and **21:30:49 UTC** find:

- health/readiness HTTP 200, UID 1000, exact source;
- v3 active and v2 retained, without exporting key values;
- all nine selected journal hashes unchanged, five inventories/two jobs ready,
  no pending outcome and the same cursor 1642;
- unchanged public API replicas. Their separate health/readiness readback is
  also retained privately.

The retrieved post-start log window contains no error/fatal application entry,
lease-loss event or new publisher timing report. This observation is not a
production fault-injection or long-term availability proof. Zero operator
Bulletin operations, renewals, DotNS signatures, musical uploads, secret transfers
or new admissions occur. The dossier is marked complete and its mutation guard
refuses another execution.

## Validation and recovery

The Linux amd64/Node 22.13.1 image is built from frozen clean source and verified
as non-root. The operator-only comparison script is excluded. An old-image →
new-image rehearsal on one synthetic volume with networking disabled preserves
receipts, cursor, counters and journal bytes; deadline ownership survives forced
Node garbage collection. No production audio or keys enter that rehearsal.
Source CI supplies canonical receipt, cancellation and shared-state regressions.

The completed provider snapshot is a rollback resource, not an off-provider
backup/restore proof. Rollback requires quiescence and retains current journals
and secrets; never overwrite a possible newer/uncertain receipt with old state.
If future stopped-state inspection refuses, leave the normal publisher stopped
and reconcile, rather than clearing locks or replaying signing.

## Next gate: actual publication timing

The live read-only ledger inspection finds **two claimed release slots out of
two**, with zero declared slots remaining. Existing ready assets cannot produce
new full-audio store/finality samples. A fresh full-release measurement therefore
needs a concrete file/scope, durable bounded admission and explicit budget review;
this delivery neither resets the ledger nor admits a third release. Claimed slots
are not proof that every existing allowance is spent: unfinished parts of an
existing admitted release retain their original authority, subject to its actual
remaining budget. Inspect those separately before requesting any new allowance.

Correlate publisher attempt/job reports with user preparation, explicit wallet
approval and catalogue visibility. Use attempt wall time and observed milestones;
concurrent/nested phase totals are not additive, and absent milestones are not
zero duration. Define the next correction from those measurements. #407 remains
open for acceptable full-publication latency; #395/#388 and conservation/access/
off-volume recovery retain their separate gates.
