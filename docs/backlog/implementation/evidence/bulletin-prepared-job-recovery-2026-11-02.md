# W33 — recover an exhausted prepared Bulletin pilot

## Identity and result

- Date: 2026-11-02; issue #288 remains open.
- Base: tested dev `ed047180c684396e66d8edb3b6dc9b93d1ce347d` ([green CI](https://github.com/knzeng-e/dotify/actions/runs/41369880536)).
- Branch: `fix/bulletin-prepared-job-recovery`.
- Code readiness: implemented and locally verified; remote CI is a separate gate.
- Release readiness: not deployed; no live inspection, storage write or maintenance executed.
- Deployment context: the separate [0.1.69 release record #378](https://github.com/knzeng-e/dotify/pull/378) preserves a failed synthetic pilot job at three attempts. This change does not alter that deployed job.

The new operator command inspects one complete saved encrypted output and its
original publication inventory, then requires the exact plan hash for a deliberate
continuation. It does not reopen ordinary retries, start/prune the queue, encode
again, reserve a generation, create another job/inventory or replenish budgets.
[ADR 0045](../../../adr/0045-bulletin-prepared-job-recovery.md) records the state
flow and alternatives; [the runbook](../../../operations/bulletin-prepared-job-recovery.md)
contains maintenance and verification steps.

## Verification

API build and typecheck pass on Node 22.13.1. The complete API suite passes
**314 tests / 42 suites**. Thirteen new regression tests exercise the actual queue,
AES authentication, graph builder and publisher/receipt adapter with simulated
canonical authority and storage transport. Structural media is not a playable
artist recording. The final targeted run also verifies that the unchanged queue
reads the recovered ready job after restart and retains its private audit.

The first sandboxed full run had two `listen EPERM` failures for existing IPv4/IPv6
HTTP tests; the full run with local socket permission passes. No test uses a live
storage signer or submits a real transaction.

| Scenario | Observed behavior |
| --- | --- |
| Original three preparation failures | Ordinary retry still returns `STREAMING_RETRY_LIMIT`; output was encoded once |
| Inspection | Authenticates source, manifest, every object and both permanent reservations; no Bulletin session/signer or persistent change |
| Successful execution | Original root/caps, attempts=3, ready reference; unrelated job and nonce/output bytes preserved; original job retained in audit |
| Lost acknowledgement | Pending exact sender/nonces reconcile without duplicate block stores |
| Unknown pending submission | Further stores refused even when its CID is present |
| Queue changed after completed storage | Ready commit refused; freshly inspected continuation reuses confirmed blocks without additional stores |
| Interruption after broadcast | Failed queue/count and durable account barriers retained; continuation completes without duplicates |
| Stale plan, wrong owner/scope/budget, missing inventory/reservation | Refused before signer load |
| Corrupt/missing output or directory link | Refused, with no encoder fallback or queue mutation |
| Live/crash publisher or writer lock | Refused; existing lock is not removed |
| Unsafe audit-directory link | Refused without writing through it |
| Already consumed store allowance | No new store; cumulative cap is not replenished |
| Ready-job restart | Existing queue implementation consumes result with attempts=3, no encoding/publication, audit retained |

Backlog manifest consistency, relative documentation links, changed TypeScript
formatting and `git diff --check` pass. Runtime code changed only in the API; no
frontend/Product/contract build is needed for this operator-only slice.

## Persistence, operations and rollback

No durable schema or setting changes. The existing publisher lease is shared
with the maintenance tool; canonical artist/runtime authority and the existing
server vault remain authoritative. Additive private audits under
`STREAMING_STATE_PATH/recoveries/` must accompany coherent backups. Source/output
are retained by the command until ordinary ready-job cleanup. A killed command
can leave a `started` audit; it does not prove that nothing was broadcast.

Keep the existing queue/profile/inventories/account cursor/permanent reservations
on restart and rollback. Never overwrite newer submissions with an older snapshot.
The server key retains its existing full account authority. No extra hosting,
account provisioning, contract call, renewal or signer installation occurred.

## Remaining gates and handoff

After review/merge and exact-source CI: prepare the API-only rollout and maintenance
window, inspect the deployed saved pilot under exclusive ownership, review its
fresh hash/remaining original allowance, then execute and independently verify
receipts/ready state. Restore custody readiness before the artist finalizes the
existing draft through the normal wallet flow.

Real release registration, protected allowed/denied Web and physical Host
listening, representative costs, retained-dependency monitoring, bounded renewals
and off-volume encrypted-data/key recovery remain open under W33. Capacity stays
deferred research. Local crypto/transport fixtures do not establish those outcomes.
