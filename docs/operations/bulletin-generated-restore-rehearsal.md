# Rehearse Bulletin recovery with generated backups

Use this contributor procedure to check whether a **complete synthetic custody
checkpoint** can survive source loss and continue through the existing recovery
command. It tests storage history and authenticated bytes for standard and
compact audio. It never reads an artist file, custody directory, seed or real
content-key secret. It is not a production backup or restoration command.

The workflow also tests the production data-only CLI in separate
[isolated reconstruction jobs](bulletin-isolated-restore.md#generated-independent-runner-acceptance).
Those checkpoints and guards are distinct from the generated bundle below;
neither format is an operational writer restore.

## Run across independent CI machines

The [Generated Bulletin backup restore workflow](../../.github/workflows/bulletin-backup-restore.yml)
uses a producer and a fresh restore runner on the same source revision:

1. The producer creates public fixtures, simulates lost storage acknowledgements,
   captures the queue, encrypted files, admission lineage, nonce reservations,
   receipts and required empty directories, then removes the original state.
2. It uploads only `generated-bulletin-backup.json` to Actions artifact storage.
   The expected SHA-256 and exact artifact name travel separately through job
   outputs; rerunning only the consumer still selects its successful producer.
3. A second runner downloads that bundle, checks its digest and bounded schema,
   and restores it into a new, exclusively created `/tmp` fixture directory.
   It does not rewrite absolute profile bindings or initialize missing state.
4. The consumer runs seven scenarios for each layout and preserves its JSON
   result. Generated bundle/results expire after seven days.

The workflow runs for API changes on `dev` pull requests/pushes and can be
started manually. It needs no Fly login, wallet, signer, hosted setting or new
network permission. Uploads contain generated fixture data only. The fixture
content-key master is a public constant in source; no real secret is backed up.
The SHA-256 catches changed artifact bytes relative to the producer's retained
value; it does not authenticate a compromised workflow or account.

## Reproduce locally

Use Node 22 and the API's lockfile dependencies. From `services/api`, choose a
new output file under a private temporary directory:

```sh
npm ci
npm run --silent bulletin:rehearse-backup -- prepare /PRIVATE/generated-bulletin-backup.json
```

Preserve the printed `sha256` separately. The producer has already removed its
original synthetic directories. In a **new process**, use the exact returned
hash rather than recalculating a value from a possibly changed bundle:

```sh
npm run --silent bulletin:rehearse-backup -- restore /PRIVATE/generated-bulletin-backup.json EXPECTED_SHA256
```

The producer refuses an existing output file. The consumer refuses an existing
restore destination and leaves it untouched. Each successful/failing scenario
cleans only its newly created fixture directory; the retained bundle is unchanged.
A second directory or process on the same disk is a local regression check.
The two-job artifact workflow supplies the independent-runner transfer evidence.
It assumes the same Linux temporary-path contract, not arbitrary cross-OS moves.

## Read the result

A passing report contains fourteen cases: one coherent recovery and six refusals
for each of `unixfs-files-v1` and `rendition-pack-v1`.

| Scenario | Required outcome |
| --- | --- |
| Coherent saved state | Reconcile lost acknowledgements, finish without duplicate stores, retain attempts and original admission/ciphertext/reservations, authenticate all twelve playback objects and restart the normal ready queue without encoding or publishing. |
| Missing nonce reservation | Refuse inspection before loading the synthetic signer. |
| Mixed/corrupt ciphertext | Refuse authentication without modifying restored state. |
| Missing admission | Refuse rather than create another durable claim. |
| Mixed profile binding | Refuse rather than repoint or initialize the publisher. |
| Stale active account cursor | Refuse new stores when the simulated account has advanced beyond the saved active intent window. |
| Unknown pending submission | Refuse new stores while sender/nonce reconciliation remains uncertain. |

The original restore job exercises current-code restart only and still reports
`historicalBinaryRollbackTested: false`. The separate compiled-version job below
has its own result and narrower executable compatibility claims.

The test objects are structural encrypted fixtures, not AAC. Authentication of
restored playback objects is separate from the
[real-AAC sample gate](dev-quality-gates.md#compact-aac-acceptance).

[Dated local evidence](../backlog/implementation/evidence/bulletin-generated-restore-2026-11-12.md)
binds these observations to their tested source.

## Compare compiled historical versions

A third fresh runner downloads the same producer bundle/digest. It checks out
three independent source trees, installs each tree's own locked dependencies
and compiles its production API modules. The contributor script verifies clean
tracked files and both historical commit identities before importing emitted
JavaScript from their separate `dist/services/` directories.

| Revision | Role and accepted observation |
| --- | --- |
| Candidate commit under test | Inspects the checkpoint, writes additional generated intents/receipts, then loses a broadcast acknowledgement. |
| `61869fb41f91bc69b7430410e4915153af7cc315` (#438) | Reinspects the advanced journals, reconciles the pending submission and finishes the original standard/compact graph without duplicate stores. Its readers authenticate all twelve playback objects and its normal queue consumes the ready result. |
| `8d0706548416fe5e17711a5d480def7499776c1a` (#426) | The original recovery command refuses admitted-release state before signer loading and without persistent changes. Its original media-reference parser rejects the compact reference. This is an unsupported rollback control. |

The old inspect plan must fail **before signer loading** after the candidate
advances the journals. The compatible command must inspect again. Both compatible
and candidate ready queues retain attempts at three, the same reference and
account/admission/nonce/recovery history. Saved ciphertext and admission lineage
remain byte-identical; only ready-file cleanup follows normal queue behavior.
The exercise never restores older journals over newer broadcasts.

To reproduce, prepare the generated bundle as above. Use three separate clean
repository checkouts at the candidate and the two exact historical commits.
From each checkout's `services/api`, run `npm ci` and `npm run build`. From the
candidate's `services/api`, use absolute repository-root paths:

```sh
node --import tsx scripts/rehearse-bulletin-binaries.mjs \
  /PRIVATE/generated-bulletin-backup.json EXPECTED_SHA256 \
  /PRIVATE/candidate /PRIVATE/compatible /PRIVATE/pilot
```

The JSON report binds all three revisions, with two layout cases and
`compiledModulesTested: true`, `serviceEntrypointTested: false`. The workflow
retains only this generated report for seven days. Historical dependency
advisories are retained with the frozen lockfiles, not fixed by silently
changing the historical executable; this exercise does not endorse redeploying
those dependencies.

This executes **compiled recovery, reader and queue modules in a harness**, not
an HTTP service, container entrypoint or Fly restart. The candidate's persistent
implementation currently matches #438; this establishes a compatible format
floor and an incompatible older control, not compatibility with every future
schema change. The fixture transport, clock, authority and signer are injected;
no real key or chain is used. Image/UID/mount/supervisor compatibility, current
canonical history, live key restoration and any real rollback still require
reviewed operational acceptance. A passing module test never grants permission
to start #426 against new state.

[Source-bound local evidence](../backlog/implementation/evidence/bulletin-compiled-rollback-2026-11-12.md) records the tested revisions and remaining gates.

## Operational boundaries and remaining acceptance

This harness is excluded from the production API build. It does not add a live
backup exporter, importer, repair endpoint or automatic rollback. Existing
[operator recovery](bulletin-prepared-job-recovery.md) keeps its maintenance,
exact inspected plan and original allowance requirements. No live inspection,
Bulletin/DotNS operation, renewal, key transfer or deployment occurs here.

Before operational recovery, preserve an independently stored coherent checkpoint
and the required secret versions separately, with matching readers and custody
binaries. Establish current canonical account/receipt history before permitting
writes. **An older idle snapshot may not contain a missing broadcast intent**;
this synthetic active-cursor test cannot detect every stale backup or distinguish
all later DotNS activity. Never replay older account/nonce journals over newer
submissions merely because an offline hash matches. Uncertain history requires
operator reconciliation while the writer stays stopped.

Real backup/key restoration, service/image rollback with current canonical history,
physical Host/adaptation/Room/background behavior, first sound and hosted peak
memory remain #407 gates. A generated cross-runner result does not accept those
production journeys or prove improved publication latency.
