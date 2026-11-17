# Custody diagnostics and availability delivery, 2026-11-09

Refs #407. Owner-authorized server-only maintenance delivers merged #415/#416
to the existing private custody service. Web/Product and both public API replicas
remain on **0.1.82**; there is no new client release.

## Result and evidence

- Frozen source: `f9fdd693399761baa6d88d155d6768dccde40dee`.
- [Merged dev CI 42652248697](https://github.com/knzeng-e/dotify/actions/runs/42652248697)
  and [reviewed #416 CI 42647688065](https://github.com/knzeng-e/dotify/actions/runs/42647688065)
  completed successfully before execution.
- Delivered immutable image: `registry.fly.io/dotify-api@sha256:e2c0267da90820f70493dff9c68168a786d17a05d706e1d4a5f8c778794aa98d`.
- Linux amd64, Node 22.13.1, UID 1000. Private health/readiness return HTTP 200
  at 16:45:13 UTC and again at 16:46:37 UTC, with the exact source marker.
- Nine selected profile/owner/admission/queue/inventory files remain byte-identical;
  five inventories and both prepared jobs are ready, no pending intent, cursor
  unchanged at 1642. v3 is active and v2 retained. No key value was exported.
- Both public API machine configurations/images are unchanged and both are
  started. Post-start logs show no new lease-loss/preparation failure or
  publication-attempt report in the observation window.
- **Zero operator Bulletin operations, renewals, musical uploads or DotNS signatures.**
  No admission, key, SDK, service count, volume, scaling or recurring task changes.

The [machine-readable result](custody-diagnostics-rollout-2026-11-09.json) contains only public source/image and
bounded outcome fields. Full configurations, journal hashes and raw logs remain
private in the local operation package; no keys or uploaded bytes are committed.

## Why custody was stopped

The previous process lost its database ownership connection at 02:58:14 UTC,
closed admission, then exited zero. Fly's existing `on-failure` policy therefore
did not restart it. #416 marks that protective shutdown as failure while a normal
SIGTERM stays successful. The replacement must acquire the same exclusive lock.
No in-process lock reacquisition, journal reset or ambiguous-write bypass is added.
The underlying database-disconnect cause remains unknown; the existing ten-retry
cap can still be exhausted during a sustained outage.

## Maintenance and persistence

The owner explicitly approved the registry upload, volume snapshot, stopped-state
inspection and custody update/start. The snapshot `vs_0OzD2XDxyopt9QLqAp79` reached
`created` at 2026-11-09T16:39:00Z. This provider snapshot is neither an
off-provider backup nor a restore rehearsal.

Before normal startup, a one-shot Node inspector on the stopped machine imported
only fs/path/crypto and exited without serving the app, opening a database or
loading a signer. Its correlated report found all owned work settled and hashed
the nine selected tracking files. An active/pending/non-ready/locked or malformed
state would have stopped activation. Its temporary command was restored to
`node dist/index.js`; only the custody image/source marker changed permanently.
The volume, resources, private network, secrets, version map and restart policy
were preserved; independently read-back configuration checks passed.

Local old-image → new-image rehearsal used synthetic state and no network:
receipts/counters/cursor and journal bytes survive, under UID 1000. Six inspector
acceptance/refusal cases pass. Real PostgreSQL CI covers normal exit versus
forced lease loss; no production database failure was induced. The Fly snapshot
create command returned non-JSON output and log reads use concatenated pretty
JSON; both outputs were reconciled in read-only checks, without repeating the
snapshot request or inspector startup.

## Boundaries and next evidence

#415 now emits bounded private attempt timings. They contain no key, address, CID,
raw error or transaction payload. Concurrent/nested phase totals are not wall
time, lifecycle hints are not finality proof, and unfinished calls stay explicit.
No new publication attempt was triggered by this rollout, so **live per-store
timings and faster publication are not yet accepted**. Past ready jobs cannot
reconstruct those measurements. Further writing tests need valid existing scope
or a separately reviewed admission/budget; this maintenance creates neither.

Keep #407 open for publication/indexing latency and remaining artist acceptance.
Room startup #395, system artwork #388 and CASH research retain their ordered
gates. Earlier owner Web/Desktop listening acceptance belongs to 0.1.82 and is
not newly attributed to these private server changes.

Rollback after quiescence uses the previous custody image
`registry.fly.io/dotify-api@sha256:431a80dfa9a924e109c0b90d9c9aff223bf17a532bb59cda7a6b92a24ebf0f24`
and source `26430e56`, preserving all current journals and keys. That image also
restores the code-zero availability defect. Never overwrite a journal or resume
an uncertain writer to make rollback appear healthy. Earlier full retention
reserve **1,183 operations / 320,588,055 bytes** remains bookkeeping unchanged;
no automatic conservation or new quota is activated.
