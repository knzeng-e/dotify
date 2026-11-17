# ADR 0045: Recover a prepared Bulletin job without reopening encoding retries

- Status: implemented; [original synthetic pilot recovered](../backlog/implementation/evidence/bulletin-prepared-recovery-rollout-2026-11-02.md)
- Scope: W33 / #288, the exhausted one-release synthetic pilot
- Related: [publication ownership](0043-bulletin-artist-publication.md), [direct-store reconciliation](0040-bulletin-direct-store-receipts.md)

The [admitted-audio extension](0055-admitted-audio-recovery.md) preserves this
legacy pilot path and adds a separate layout-bound multi-release procedure.

## Problem and decision

The pilot's durable streaming job reached three preparation attempts before any
Bulletin store. Correcting admission does not make a failed job runnable. Ordinary
artist retry must keep its three-attempt ceiling; creating another job would
violate the one-job allowance, and re-encoding would change ciphertext/nonces.

Add a maintenance-only command for one **existing exhausted job with a complete,
authenticated output and a matching existing publication inventory**. It cannot
encode, reserve a generation, create an inventory or change an allowance. It is
not a new HTTP route, artist retry button or general queue-repair command.

## Data and authority flow

1. The operator stops/awaits custody and preserves its coherent persistent state.
   Both the tool and custody use the same exclusive `publisher.lock`; neither
   force-removes a crash lock. An orphaned `writer.lock` also requires inspection.
2. `inspect` authenticates the saved manifest, every encrypted object, the saved
   source and its original content hash using the existing content-key vault.
   Both permanent generation reservations must exist. Files/directories are
   bounded, private and owned; linked files/directories are refused. Canonical
   artist authority is read from the existing chain service. No Bulletin session
   or storage signer is opened, and no persistent recovery state is written.
3. The reconstructed graph must exactly match the original job's scope, root,
   generation, block identities, immutable budget and pipeline. The configured
   pilot scope is mandatory. No other active account job can be bypassed.
4. Inspection returns a SHA-256 plan identity. It binds queue/profile locations,
   full queue bytes, source/output/reservation hashes and account/job inventory.
   It is a freshness check, not a cryptographic delegation or new spending cap.
5. `execute` requires that exact identity and redoes inspection while holding the
   publisher lease, **before loading the signer**. After another authority check,
   it durably records the original job and starts publication through the normal
   Bulletin adapter. Pending sender/nonces reconcile before new writes; existing
   cumulative attempted-store/byte caps and renewal reserves still apply.
6. Only a verified matching root can commit `ready` and its normal audio reference
   in `jobs.json`. The original preparation count remains three. Other jobs are
   not started, expired, pruned or requeued. Source/output and permanent nonce
   reservations remain untouched by this command; normal startup can later
   remove completed job files after the ready reference is durable.

Each explicit execution writes a private audit under `queue/recoveries/`, retaining
its plan, original job, timestamps and `started`, `ready` or `needs-inspection`
state. A killed process can leave `started`; that is not evidence of no broadcast.
No raw provider error, plaintext, signing secret or content key goes into output.

## Failure and compatibility

Before success, the queue stays failed and the ordinary retry ceiling remains.
The adapter may advance its existing receipts/nonce journal even if the command
fails. Preserve those updates: a new inspection produces the current plan, and
another reviewed execution reconciles them. Missing/ambiguous submissions do
not authorize resubmission. A queue write failure after completed storage can
be recovered from the same ciphertext and confirmed inventory without storing
the blocks again. Never restore an older inventory/nonce snapshot over broadcasts.

No queue/inventory schema migration, contract, frontend setting or new secret is
introduced. Audit files are additive. Older API code can read the ready job;
it ignores the new audit directory. Keep that directory in backups and rollback.
The existing server account still retains its full DotNS authority; this tool
does not narrow it cryptographically. Account authorization, retained-block
expiry and application budgets remain distinct checks.

## Alternatives and limits

Resetting `attempts` loses the actual preparation history and reopens encoding.
An automatic exception to artist retry silently expands failure policy. Both are
rejected in favor of a deliberate, inspectable operator action under existing
storage caps. A broader self-service recovery workflow can be designed later
from production experience.

The implementation itself performs no automatic recovery on deployment. The
separately approved intervention recovered the original pilot; renewal, artist
registration and physical protected playback remain distinct acceptance gates. No service interruption or live
transaction is performed by tests. Use the [operator runbook](../operations/bulletin-prepared-job-recovery.md)
and exact deployment review before a real recovery.
