# Admitted Bulletin audio recovery — local evidence, 2026-11-12

## Artifact and environment

Code `bd032cd68acf22964e709d38753f7ee23452e83b`, based on merged #437 dev
`a10a171fbc2e841650d58ffff710383ad6103a18`. Local macOS / Node 22.13.1,
synthetic private directories and in-memory Bulletin transport. No production
files, artist media, Fly service, signer, network write or allowance is used.
The [operator procedure](../../../operations/bulletin-prepared-job-recovery.md)
and [ADR 0055](../../../adr/0055-admitted-audio-recovery.md) define the behavior.

## Checks and observations

| Check | Result and boundary |
| --- | --- |
| Complete API suite | 497 tests / 42 suites pass, no failures or skips; 142.1 seconds locally. Loopback HTTP tests run with local listener permission. |
| Prepared recovery | 49 cases: 13 existing safety scenarios run across pilot, admitted standard and admitted compact; 10 additional admission/lineage/ready-cover checks. All pass within the complete API suite. |
| Types and API build | `npm run typecheck` and `npm run build` pass. The built CLI keeps its existing arguments; no new operator key argument. |
| Formatting and hygiene | Changed TypeScript passes Prettier; offline backlog and whitespace checks pass. Local documentation links/anchors are verified before the documentation commit. |

Inspection loads no signer, produces no persistent mutation and reconstructs the
same saved graph. Execution preserves the consumed preparation count, original
source/output, nonce reservations and byte-identical admission lineage. Complete
references retain standard or compact grammar and the original content-key
version. An existing ready cover, its receipts and its claim stay unchanged.

Lost acknowledgements and cancellation retain pending sender/nonces; a later
inspection reconciles them without duplicate stores. A queue-commit race after
storage likewise reuses confirmed blocks. Exhausted cumulative caps do not
replenish. Missing claims/archives, changed bindings/layout/pipeline/key mapping,
other unfinished work and orphan inventories fail closed. Raw profile,
admission or archive whitespace changes also invalidate an earlier plan.

## Remaining acceptance

The encoded test objects in the recovery fixture establish authenticated storage
and persistence behavior, not AAC output; the separate
[real-AAC gate](bulletin-compact-aac-2026-11-12.md) covers decoded samples.
This run does not establish production recovery, provider snapshot durability,
coherent off-volume restoration/rollback, physical Host startup/adaptation or
Room/background behavior, real first sound, hosted memory or lower live latency.
Those #407 gates remain before compact activation.

No service is delivered by this record. Web/Product/public API stay on recorded
0.1.82 and custody on #426. GitHub CI status belongs to the exact pull-request
head, linked in its description; local evidence alone is not a green remote run.
