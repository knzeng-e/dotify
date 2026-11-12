# ADR 0055: Recover admitted audio from its existing immutable layout

- Status: implementation candidate for #407; no deployment or live execution
- Extends: [ADR 0045](0045-bulletin-prepared-job-recovery.md)
- Related: [admission](0046-bounded-multi-release-admission.md),
  [layout binding](0052-bulletin-layout-inventory-binding.md),
  [compact delivery](0054-explicit-compact-delivery.md)

## Problem and decision

The original maintenance command only accepts one standard synthetic pilot.
New artist publications have durable per-release claims; compact audio also
uses a different physical graph and registered reference. Reopening encoder
retries or treating a compact root as standard would change ciphertext or break
listening. Recovery must continue the original publication rather than create a
replacement release.

Extend the stopped-writer command to recover one exhausted, authenticated audio
job whose original durable claim and inventory already exist. The immutable
admission selects standard or compact graph construction. No CLI layout switch,
new claim, inventory initialization, re-encoding or retry reset is available.
The normal publication adapter remains the sole writer and reconciler.

## Binding and state flow

The existing publisher lease excludes custody for both inspect and execute.
Inspection reads the queue, private source/output, both permanent nonce
reservations and canonical artist authority. For admitted work it also checks
the fresh key binding, profile/queue/publisher bindings, normalized admission
lineage and every owned inventory, including standard public assets. All these
raw files enter the plan snapshot. The exact owned inventory set must match the
files on disk; another unfinished or uncertain publication blocks this action.
Metadata reads retain their 2-MiB per-file bound and recovery caps owned
inventories at 192 (64 complete releases). The audio graph retains its existing
byte/object bounds; this is not a streaming-memory optimization.

The job ID must match its original audio claim and deterministic release
identity. Inventory layout and effective pipeline must match that admission,
including any exact-source write window. Reconstructed ciphertext must match the
original root, generation, block identities, byte counts and cumulative budget.
A missing claim fails before the normal adapter could create one.

Execution redoes this inspection before signer loading and requires the exact
plan hash. The existing authority, retention, quota, nonce and conservative
attempt rules still apply. Public-asset authority is explicitly denied in the
maintenance composition. The command calls only audio publication and commits a
ready queue reference derived from the matching ready inventory. It preserves
the queue's consumed preparation attempts, source/output and nonce reservations.
A ready cover and its receipt history are not republished or modified.

## Compatibility and failure

Legacy pilot plan/audit schemas stay v1; admitted plans/audits use v2 and expose
layout, admission digest and effective pipeline. Raw admission archives are
included even though their normalized digest ignores whitespace. Any byte
change after inspection invalidates the plan. Always inspect with the reviewed
execution revision; a hash is a freshness check, not spending permission.
Queue and inventory schemas remain unchanged. Compact references require the
compatible readers from ADR 0054, including after recovery.

A lost acknowledgement keeps the existing pending sender/nonce and attempts.
Uncertain results block new sends until the ordinary adapter can reconcile them.
If storage finishes before the queue commits, a new inspection/execution can
reuse those confirmed blocks. No old journal may be restored over newer sends.
An interrupted audit may stay `started`; it is not evidence of no broadcast.

## Alternatives, validation and remaining gates

Increasing the artist retry ceiling would reopen encoding and hide the failure;
creating another queue job could consume a second allowance. Neither is used.
A general repair/migration framework is unnecessary for this development slice:
the operator can resume only complete, exactly bound prepared audio. Missing
ciphertext, claims or reservations require investigation, not reconstruction.

Synthetic tests cover legacy pilot, admitted standard and admitted compact
recovery, lost acknowledgements, aborts, queue-commit races, exhausted budgets,
changed bindings, missing lineage and another uncertain publication. They do
not establish production recovery, disk-loss restoration, hosted peak memory or
physical Host playback. See the [operator procedure](../operations/bulletin-prepared-job-recovery.md).
Coherent off-volume restore/rollback and physical-device acceptance remain #407
gates. This decision activates no service, publication, key, quota or writer.
