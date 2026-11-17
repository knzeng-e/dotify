# Generated compiled-version recovery compatibility, 2026-11-12

## Source and environment

The owner confirms #439 merged. Its dev merge is
`83c57acb8853398d8305ea4b0479f5cd9cff703e`, with the same tree as green #439 head
`a195efd85b397b5052be8702c94f3a569f7c9b1d`. The next #407 candidate adds a
compiled-version exercise to the existing generated backup workflow. Local
results below bind implementation `6ef2216704194e22b3a6392511500df6801a3ba3`.
The PR records later documentation-only commits and exact-head remote checks.

Local environment: macOS, Node 22.13.1, three isolated clean tracked source
checkouts. Historical APIs are compiled independently with their own lockfile
installations, not replaced with current imports or upgraded dependencies.
Only public structural fixtures and an in-memory chain/signer are used. The
producer removes its originals before the separate consumer process starts.
This local run does not itself prove independent-runner transfer; the existing
producer/consumer workflow supplies that gate, with an added version-comparison
job using the same retained artifact name and separate producer digest.

## Observed behavior

The script imports emitted API JavaScript from the candidate, compatible #438
`61869fb41f91bc69b7430410e4915153af7cc315` and pilot-era #426
`8d0706548416fe5e17711a5d480def7499776c1a`. Both standard and compact cases pass:

- #426's actual recovery command refuses admitted-release state before signer
  loading and leaves its files byte-identical. Its original media parser rejects
  the final compact reference. No module-load failure counts as this refusal.
- Candidate and #438 inspection produce the same original plan. The candidate
  then advances the file journals and loses a new broadcast acknowledgement.
- #438 refuses the stale plan before signer loading, reinspects the **advanced**
  journals and finishes without duplicate stores. No old snapshot is replayed.
- Both compiled reader sets authenticate twelve playback objects per layout.
  Both compiled ready queues consume the same reference with attempts still at
  three, without key derivation, encoding or publication. Account, admission,
  permanent nonce and recovery-audit history remains unchanged across restarts.

The report sets `compiledModulesTested: true`,
`serviceEntrypointTested: false` and `productionTouched: false`. The fixed
compatible revision has the same persistent implementation as this candidate;
this proves that format floor, not arbitrary future schema compatibility.

## Other local validation

API typecheck/build and source/workflow formatting pass. The full API suite on
`f365e864` reports 500 passing cases and two socket-listener cases blocked by the
sandbox (`listen EPERM`); the two affected files subsequently pass all eleven
cases with local loopback permission. No assertions, skips or deadlines are
changed. The prior fourteen generated restore/refusal scenarios remain in the
suite. Exact Linux full-suite results belong to the PR's final-head CI evidence.

Production build exclusions retain all generated helpers outside `dist`.
Historical npm installs report existing advisories (one high on #438's lockfile,
five high on #426's); preserving those frozen controls does not endorse their
redeployment. The separate dependency-security backlog remains authoritative.

## Boundaries and next acceptance

The [canonical procedure](../../../operations/bulletin-generated-restore-rehearsal.md#compare-compiled-historical-versions)
owns pinned revisions, reproduction and interpretation. This harness runs
compiled recovery, reader and queue modules, not a historical HTTP/custody
entrypoint, container image, UID/mount/supervisor or Fly restart. Fixture keys
are public constants; canonical history and authority are simulated. Audio
objects are structural fixtures, not AAC or a physical-device first-sound test.

Actual service/image rollback, independently stored real backups and secret
restoration, current canonical account/receipt reconciliation, physical Host/
adaptation/Room/background, first sound and hosted peak memory remain acceptance
gates. An old idle snapshot can omit a later broadcast intent; an offline digest
cannot establish that no later submission exists. Keep the writer stopped when
that history is uncertain.

No live inspection, image upload, service restart, key/admission/budget change,
artist upload, Bulletin/DotNS operation, renewal or deployment occurs. Recorded
services remain Web/Product/public API 0.1.82 and custody #426. #407 stays Now /
In Progress; Room → artwork → CASH keep their selected order.
