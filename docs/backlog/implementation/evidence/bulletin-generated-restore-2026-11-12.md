# Generated Bulletin backup restoration — local evidence, 2026-11-12

## Artifact and environment

Based on merged #438 dev `4521088f470b400a5b9b2b9fc78c57920ab12598`, whose tree
matches the previously green PR head `61869fb4`. Rehearsal code
`242dad8793156f37767d8886df89ecd2a3435755`; final test-only refinement and audio
observations `dd1c0583135249ac0becb740e9f6df5a345247aa`. Local macOS / Node
22.13.1. Public structural media and in-memory chain/signers only; no artist
file, production key, live RPC, Fly service or storage operation is used.

The [reproduction procedure](../../../operations/bulletin-generated-restore-rehearsal.md)
defines the generated bundle, independent-runner workflow and limits. Local
process separation alone is not evidence of a separate disk or machine.

## Observations

| Check | Result and scope |
| --- | --- |
| Complete API suite on `242dad87` | 502 tests / 43 suites pass, no failures/skips, 161.8 s locally. Includes all 49 existing recovery cases after fixture extraction and five new backup tests. |
| Final focused backup suite | Five cases pass on `dd1c0583`, including fourteen restoration/refusal scenarios; no failures/skips. |
| New-process CLI | Producer removes the original synthetic directories; an independent consumer process restores both layouts, authenticates all twelve playback objects per layout and restarts the ready queue without encoding/publication. |
| Types/build and browser diagnostics | API typecheck/build pass; rehearsal helpers are absent from production output. Compact harness typecheck and targeted lint/format pass after adding source-context observations. |
| Repository/docs | Offline backlog, whitespace, changed-source formatting and local links/anchors are checked before the documentation commit. |

The first draft of the bundle omitted empty directories. Recovery could commit
`ready`, but ordinary queue startup refused the absent `incoming` directory.
The final format preserves explicit directories and validates their ancestry;
a missing required empty directory is now a refusal test, not an initialization
fallback. This finding concerns the generated rehearsal, not an intervention on
any real backup.

Coherent restoration preserves encrypted source/output, generation reservations,
consumed preparation attempts, original admission lineage and pending receipt
history. Six altered states per layout refuse without new stores: a missing
reservation, corrupt ciphertext, missing admission, mixed binding, stale active
cursor and unknown submission. Bundle tests also refuse a wrong independently
retained digest, traversal paths, oversized input, symlinks and an existing
restore destination without changing that destination. The source bundle stays
byte-identical throughout consumption.

## Merged-dev audio observation

The merged-dev integration run `43195006599` initially reports one WebKit Host
failure: the first playback in the cold-transport test has a moving media clock,
a running probe, a live capture track and no media error, but zero measured
energy. Other compact cases pass. The generated trace is preserved privately;
no production data is involved. It does not include the normalization source's
context observations, so `dd1c0583` adds the existing bounded, identifier-free
lifecycle observations to fixture evidence. No audio behavior, threshold,
deadline, skip or automatic retry changes. The unchanged merged-dev failing job
is rerun after trace review; final status is recorded in the PR. This is not
accepted as successful audio merely because the clock moves.

## Remaining acceptance

The final-head GitHub workflow must prove artifact transfer between independent
runners; its result belongs to that exact PR head. This local record does not
claim it before the workflow runs. The expected digest/name are retained via
producer job outputs, including when only a failed consumer is rerun.

The fixture master is public and reconstructed from source, not a recovered real
secret. Production backup/key restoration, rollback between reviewed historical
executables, physical Host/native adaptation/Room/background, real first sound
and hosted peak memory remain. An older idle snapshot can omit a later intent;
this active-cursor refusal does not establish universal stale-backup detection.
Current-code ready restart does not equal historical-binary rollback.

No deployment, live inspection, admission, budget, key transfer, renewal or
Bulletin/DotNS operation occurs. Recorded delivery stays Web/Product/public API
0.1.82 and custody #426. #407 remains open before Room/artwork/CASH.
