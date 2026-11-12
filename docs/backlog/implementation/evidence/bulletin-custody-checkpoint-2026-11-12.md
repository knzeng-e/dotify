# Data-only custody checkpoint candidate — 2026-11-12

## Artifact and scope

Initial implementation commit: `013e14c52af572eaa4f56953d57ecaffcc3179cc`,
from tested merged dev `2508605841854ac07835a7feb22e6296b3d788a9` (#441).
Review correction: `c54c6a14cff807a3fd6b99b72d41d9be7b165718`.
Documentation-only follow-ups do not change their respective source trees.
All three dev workflows were green before this branch started. Scope: #407;
the [selected sequence](../listening-and-publication-readiness.md) stays
publication readiness → Room → artwork → CASH research.

The maintenance CLI inspects a settled multi-release domain, captures an exact
plan into private hashed objects and verifies that copy without the source.
The [runbook](../../../operations/bulletin-custody-checkpoint.md) owns commands,
limits and refusal handling; [ADR 0056](../../../adr/0056-data-only-custody-checkpoint.md)
owns the data-only decision. This is not a live inspection, independent backup,
key-recovery or service-restoration observation.

## Local checks

Node 22 / macOS arm64, locked API dependencies, generated temporary state only.
The CLI tests run without application environment and with no configured signer
available. Fixtures use injected transport and public test keys, never real
artist files, service directories or wallet secrets.

| Check                                   | Observation                                                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| API typecheck and production build      | Pass; the compiled maintenance CLI is included, test fixtures are excluded.                                                               |
| Full API suite on implementation commit | **511 tests / 43 suites pass, no failures or skips** (166.12 seconds), including all nine checkpoint cases.                               |
| Focused checkpoint suite                | Nine cases pass, including standard and compact exact copies, source deletion, refused active/uncertain work and CLI inspect/copy/verify. |
| Formatting / whitespace / backlog       | Pass.                                                                                                                                     |
| Changed-document links and anchors      | **366 local links/anchors pass** in the changed Markdown documents; the new public-page link resolves.                                    |

The first local fixture run refused macOS `/var` → `/private/var` aliases as
designed. Tests now create their generated roots under the canonical temporary
parent; production path/privacy checks were not weakened.

## Review correction: retain output-nonce proof after normal cleanup

The [automated P2 finding](https://github.com/knzeng-e/dotify/pull/442#discussion_r4551506658)
identified a real gap in the initially green candidate: output reservations were
checked only while the prepared manifest remained on disk. Normal startup removes
ready ciphertext, and seven-day retention later removes the ready queue entry.
Neither action is allowed to remove the permanent output reservation.

`c54c6a14` validates every audio inventory's generation against the retained nonce
ledger, independently of temporary queue/files. A retained manifest must agree
with that inventory generation. Unencrypted public-asset generation labels are
not treated as nonce reservations.

Two new layout regressions use real `StreamingJobs.start(false)` cleanup and its
eight-day clock/`runNext()` retention path. Both intact pruned states inspect,
copy and verify successfully. Removing **only** the output reservation while
leaving the source reservation makes inspect/copy refuse without output creation
or source mutation, with and without a ready index. The new regressions fail on
`fe8ff21` with two missing-rejection failures and pass after correction; all
**11 focused checkpoint cases** pass. The initial 511-test table above belongs
to `013e14c5`, not a claim that the review gap was covered. Corrected full-suite
and integration results are bound to their exact head in [PR #442](https://github.com/knzeng-e/dotify/pull/442).

## What the generated cases establish

Both layouts retain every planned byte, including admission archives, receipts,
recovery journals and nonce reservations. The source tree remains byte-identical.
Private sibling signer/content-key sentinels are absent from all objects. After
the test deletes its original queue/publisher, offline verification still passes
with the retained manifest digest. The result is deliberately not a runnable
queue, and the writer-activation flag stays false.

Active/orphan leases, unfinished queue work, an active publisher, pending
receipts, missing reservations, extra files, source links/hard links, open
permissions, directory aliases and legacy pilot profiles refuse. Changed plans
do not create an output; existing destinations and their sentinel remain intact.
Verification rejects wrong digests, changed/linked/extra objects, an incomplete
marker, oversized manifests, path traversal and missing logical ancestry.
Aborted calls preserve source state. CLI failures reveal neither paths nor raw
exceptions. These are process/filesystem regressions, not physical disk-failure
or malicious-host tests.

## Not exercised or authorized

No Fly access, live private read, real checkpoint, key transfer, image upload,
service restart, allowance/quota change, Bulletin/DotNS operation, renewal,
musical publication or deployment occurs. Recorded delivery remains Web/Product/
public APIs 0.1.82 and custody #426.

The new copy stays on the fixture's disk; prior generated cross-runner tests
exercise a different synthetic restoration harness. Neither proves independent
storage or secret recovery for real custody. This CLI does not authenticate GCM,
prove remote retention, inspect canonical account history, restore state or
activate a writer. One active settled domain is supported; historical pilot
domains and separately held keys/configuration need their own recovery plan.
Actual data/key recovery and service/image rollback must preserve newer account
intents, receipts and nonce history. Physical Host/Room/background, first sound,
hosted memory and separately authorized publication latency acceptance remain
before compact activation and #407 closure.
