# Publication, listening reliability and CASH — execution order

## Bounded CASH reassessment candidate, 2026-11-13

The [#406 decision](../../design/product-cash-tip-decision-2026-11-13.md) and
[offline evidence](evidence/cash-tip-feasibility-2026-11-13.md) distinguish pinned
payment APIs from the coherent published SDK 0.40.0 / Host SDK 0.29.0 /
TrUAPI 0.26.0 caller-id/partial-status candidate. Static Desktop declarations
do not prove an active payment backend. Work tips stay
no-go pending shipped-Host/unit verification and artist-controlled distribution.
#85 compatibility inspection is the next independent payment slice. This research
adds no payment UI, SDK upgrade, funded trial or access; the pending listening
rollout and physical acceptance retain their order.

## Room continuity candidate, 2026-11-13

[The same-track handoff](../../adr/0059-preserve-solo-during-room-preparation.md)
keeps solo listening active during mobile Room preparation, within the existing
access and media limits. It is an independent #395 product slice, not deployment,
a measured startup speedup or physical background acceptance. Recovery remains
deferred at the owner's request; #407 and the public-pilot safety gates stay open.

## Product work first

The owner has deferred the real second-computer recovery rehearsal until after
the other product-readiness work. Resume publication latency, then Room startup,
reliable solo/Room lock-screen artwork and bounded CASH research in the order
below. Keep the prepared recovery artifacts; do not continue recovery tooling,
request its capture/key-transfer approval or run that rehearsal in this phase.

This is an execution order, not a requirement to close every parent issue before
starting the next independent task. #407 can remain open for deferred operational
acceptance while safe #395/#388 work progresses. Existing deployment/format
activation gates remain; defer an affected activation rather than waive its
safety requirements. Real recovery remains a pre-public-pilot acceptance gate,
with the bounded scope below, and is not marked complete by this deferral.

## Bounded recovery before the public pilot

Recovery protects artists from losing access to their music if the source
computer or storage service fails. It is a public-pilot gate, not a prerequisite
for every development change. The deferred slice is **one real independent
recovery**, not a general backup platform. #407 stays Now / In Progress for
publication latency; resume the rehearsal after the product work above.

When resumed, the slice ends when all of these are evidenced for one existing release:

1. Bind the backup to the selected artist, runtime and registered release
   reference. Record the trusted archive and key-version expectations separately
   from the copied files; a catalogue entry alone is insufficient.
2. Keep a verified encrypted copy on the selected second computer, independently
   of the source computer and Fly. Recover only the agreed content-key version
   through the separate private vault; disclose its full domain scope before
   export. Wallet and publication signers are excluded.
3. Reconstruct and authenticate the complete published audio offline on that
   second computer, with source inputs unavailable and the archive read-only.
   Record the artifact identities, outcome and remaining limits. Do not treat
   cryptographic authentication as an audible listening test or a service restore.

**Stop rule:** after this scenario passes, record its evidence and end this
recovery slice. Add recovery tooling only to execute this scenario
or fix a demonstrated failure/security gap. General backup scheduling, additional
recipient platforms, exhaustive fault matrices and a backup-management UI are
outside this slice; they do not become prerequisites through incidental follow-up.
If a missing capability blocks the scenario, record that exact gap and continue
independent safe work instead of extending the rehearsal indefinitely.

This bounds the development work; it does **not** waive current-history and
service/image rollback, hosted capacity, physical Web/Host listening,
Room/background continuity, conservation, access or value-flow acceptance.
The existing activation gates still apply before a new compact-format rollout;
public-pilot acceptance remains broader than this one recovery result. A
recoverable copy also does not renew Bulletin retention. No real capture,
key export, maintenance or funded trial is authorized by this plan.

### Evidence available and deferred action

Tested dev `93e99042` includes merged [#452 published-block archives](../../operations/bulletin-published-archive.md)
and [#454 explicit offline audio authentication](../../operations/bulletin-published-audio-check.md).
These preserve immutable blocks after temporary queue pruning and authenticate
against explicit reference/key inputs without activating a publisher. The
[V4 generated reader is owner-accepted on the second Mac](evidence/second-mac-v4-2026-11-13.md).
**Real data/key transfer and second-computer authentication are not yet accepted.**

After the product work, finish the concrete one-release encrypted-transfer
procedure and separate key-recovery instructions, obtain the scoped operational
agreement and run that single rehearsal. Until then, preserve the prepared
artifacts without further recovery implementation or capture. Do not repeat
accepted generated/device checks unless changed artifacts or a failure justify it. A failure must leave existing
production files, key versions and publication histories intact.

The [compact-delivery reference](../../reference/bulletin-compact-delivery.md),
[generated recovery procedure](../../operations/bulletin-generated-restore-rehearsal.md)
and [resource probe](../../operations/bulletin-resource-envelope.md) describe
implemented controls and their limits; none proves hosted or physical acceptance.
Delivery remains Web/Product/public APIs 0.1.82 / custody #426.
The separate [Room-start measurement candidate](../../how-to/measure-room-startup.md)
can progress offline; it is not a deployed startup fix. After publication latency,
the selected product order remains #395 Room startup → #388 system artwork →
#406 CASH tips → #408 CASH access.

## Listening security review, 2026-11-11

[The bounded #431 correction](../listening-security-hardening.md) keeps disconnect and grant expiry
authoritative at key delivery, rejects malformed Room input before mutation and
bounds negotiation work per socket. Shared listening, anonymous guests and free
access retain their existing policies. This is a code candidate alongside #407,
without deployment or new publication authority; physical Host/load acceptance
remains separate. Earlier dated entries retain their historical scope.

## Compact graph and durable layout binding, 2026-11-11

[The next #407 implementation](../../adr/0052-bulletin-layout-inventory-binding.md) adds a fixed 256-KiB compact graph constructor
and binds its layout to a distinct journal version before any storage intent.
Current jobs and publications keep their existing format; composition and
prepared recovery refuse compact inventories before producing an unsupported
reference. Restart/lost-acknowledgement tests preserve the same graph, generation,
nonce and attempts. Versioned references, reviewed per-identity admission,
API/Host range readers and real-media acceptance remain next; no compact switch,
service delivery or new trial is enabled. Custody stays on #426 and Web/Product/
public APIs on 0.1.82. #407 remains Now/In Progress before Room/artwork/CASH.

## Offline compact-layout study, 2026-11-11

[The reproducible #407 study](evidence/bulletin-compact-layout-2026-11-11.md) compares
unchanged standard paths with experimental per-quality segment packs. Retaining
init and the first segment separately models 108 → 60 blocks and nine → six
waves with 256-KiB chunks. The prototype preserves ciphertext/HMAC/GCM and
bounds range reads, but existing API/Host paths cannot read later packed segments.
Cold seeks can fetch extra chunks. Next: review explicit layout/reference and
per-identity persistence, then implement/test API/Host integration and real
first sound. 429 API tests pass; this checkout-only experiment changes no
production reader/writer, format, key, budget or service. No write/maintenance
is authorized. #407 stays Now/In Progress; Room/artwork/CASH keep their order.

## Post-optimization publication and listening confirmed, 2026-11-11

[The approved exact trial](evidence/bulletin-eskapade-activation-2026-11-11.md) now publishes and plays, confirmed
by the owner with approximately **7 min 46 s before the wallet prompt**. Captured
scoped reports show successful audio/cover/metadata work, 110 store calls and
cover reuse, without collection failures. Publisher clocks have different
boundaries from the owner's time; overlapping phases are not additive and this
is not a same-file speed comparison. Submit/finalize averages about 32 s per call.
#407 stays Now/In Progress: investigate fewer storage/dependency stages and
format/resolver compatibility offline, preserving proof/retention/nonce gates.
The same #426 image and Web/Product/public APIs 0.1.82 remain; no further trial,
maintenance, allowance or renewal is authorized by this acceptance. Earlier
entries describe their dated checkpoints.

## Publication round-trip optimization delivered, 2026-11-10

[The approved custody-only delivery](evidence/bulletin-round-trips-rollout-2026-11-10.md) installs #426 from tested
`8d070654`, with the same tree as merged dev `bdd6eab0`. Green merged CI, a
completed provider snapshot, compiled compatibility inspection, unchanged
protected histories and two health/readiness passes are verified. Zero Bulletin
operations, renewals, DotNS signatures or new admissions occur. Web/Product and
public APIs stay 0.1.82. Actual publication latency and hosted memory under new
work remain unmeasured; existing ready releases must not be reset for a benchmark.
#407 remains Now/In Progress, before #395, #388 and CASH research. The separate
next-source selection and exact trial budget remain ahead; the maintenance
approval is consumed. Earlier entries below are dated checkpoints.

## Publication round-trip candidate, 2026-11-10

[The next #407 slice](evidence/bulletin-round-trips-2026-11-10.md) orders remaining dependency work only when the local
wave model improves, and reuses bounded completed block-proof data while
refreshing eligibility and canonical mapping. Synthetic audio stages fall
9→8 / 13→12; cover/metadata stay 3 / 2. Graph bytes/CIDs, journal order, nonce
ownership and proof/retention gates remain. 415 API tests, typecheck and build
pass. Review, matched custody rollout and actual latency acceptance remain;
this candidate adds no live admission or musical write. Custody stays `59244da5`,
Web/Product/public APIs 0.1.82; the selected sequence is unchanged.

## Exact write-window trial activated, 2026-11-10

[The approved custody-only activation](evidence/bulletin-window-activation-2026-11-10.md) delivers #424 from
`59244da5`, identical to tested merged dev `3afd2b58`. A completed provider
snapshot, one stopped-writer apply, preserved prior state/nonces and two
health/readiness checks are verified. One owner-selected new source has a
16-store / 4-MiB write window; proof reads and previous grants remain unchanged.
The maintenance performs zero Bulletin/DotNS operations. Web/Product/public
APIs stay on 0.1.82. The owner now confirms the new release publishes and plays,
reporting about nine minutes before the wallet prompt. Scoped readback confirms
the selected window and ready assets; this different, lighter source is not a
controlled speed comparison. Acceptable latency remains open in #407 before
#395, #388 and CASH research; earlier entries are dated history.

## Direct-write window candidate, 2026-11-10

[The #407 correction](evidence/bulletin-direct-write-window-2026-11-10.md) separates a future exact release's bounded write
window (up to 16 / 4 MiB) from its unchanged proof-reader limit. Synthetic
151-block schedules use 77 legacy finalized stages versus 13 at the maximum;
these are not live timings. Profiles, existing grants/jobs, keys and budgets are
not retuned. Compatible code, reviewed activation and actual latency acceptance
remain ahead; custody stays `cd7ed569`, Web/Product/public APIs 0.1.82.

## Actual publication measurement captured, 2026-11-10

“Street scriptures” is published and audibly confirmed by the owner. Preparation
still takes about 50 minutes. [The phase diagnosis](evidence/bulletin-street-scriptures-timings-2026-11-10.md) finds repeated
finality waits across 151 direct stores with concurrency two. #407 remains the
current scope: design/test a bounded direct-write window with independent read
limits, immutable-history compatibility and offline schedule evidence before
another live trial. Do not treat the successful release or longer deadline as
acceptable latency. #395/#388/#406/#408 keep their order.

## Measurement allowance active, 2026-11-10

[The approved #422 custody activation](evidence/bulletin-street-scriptures-activation-2026-11-10.md) is complete:
one exact “Street scriptures” allowance is added without resetting the original
two claims or permanent nonce history. The artist can start the selected fresh
release through the ordinary app/wallet flow. Zero operator musical writes
occurred. Measure actual preparation, storage/finality and catalogue/sound
acceptance next; #407 remains Now/In Progress. Web/Product/public APIs stay on
0.1.82; #395/#388/#406/#408 keep their order. Earlier dated checkpoints below
retain their original meaning.

## Current execution after trial acceptance, 2026-11-11

This is the selected execution order. Project 5 owns workflow status; the
manifest owns issue/doc/priority/phase mappings. **Now** means the work to
execute; **Next** includes unfinished acceptance of already delivered code.
Earlier dated records describe their original checkpoint. Start each new
implementation branch from current tested dev; use one PR per backlog scope.

- **Delivered:** Web/Product/public APIs remain 0.1.82, with owner-confirmed
  existing-release visibility and audible Web/Desktop playback.
- **Measured:** “Street scriptures” publishes and plays but takes about
  50 minutes. The stage diagnosis identifies repeated finality waits at two
  direct writes per wave; successful publishing does not prove acceptable speed.
- **Activated on custody:** #424 from tested `59244da5`, with one separately
  approved new exact identity and a 16-store / 4-MiB window. A completed snapshot,
  stopped-writer inspection/apply, preserved histories and two healthy checks
  are verified; no operator Bulletin/DotNS operations occur during maintenance.
- **Accepted behavior:** the owner confirms the new exact release publishes
  and plays, reporting about nine minutes before the wallet prompt. Readback
  confirms the actual selected window and ready assets, with no pending outcomes.
- **Delivered next optimization:** #426 is now on custody after green merged CI,
  a completed snapshot and preserved-history/availability checks. Existing grants
  and ready jobs are unchanged; no maintenance chain writes occur.
- **Accepted behavior:** “Eskapade à engong” publishes and plays; the owner reports
  7 min 46 s before the wallet prompt. Scoped reports succeed with 110 store calls,
  cover reuse and no collection failures. Publisher clocks are separate.
- **Offline result:** the compact-layout study models 108 → 60 blocks and nine
  → six waves when packing later segments per quality at 256 KiB, keeping init
  and the first segment separate. Range/decrypt tests pass; live readers and
  root/reference semantics remain unchanged.
- **Immediate action:** resume publication latency and the selected product
  work; the [bounded recovery slice](#bounded-recovery-before-the-public-pilot)
  is deferred until afterwards. Current-history/service rollback and the
  existing activation/device/capacity gates remain separate requirements;
  generated tests do not complete them. Cold seeks can overfetch, and modeled
  percentages are not network speedups or ETAs. No deployment, old-identity
  rewrite or new funded trial is implied.

| Order              | Scope / owner ticket                                                            | Remaining deliverable and exit gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Now            | [Publication latency and acceptance #407](../bulletin-publication-admission.md) | Admission, progress and catalogue feedback are delivered. The approximately 50-minute Street scriptures run identifies repeated finality waits. #424 is now activated on custody for one approved new exact source (16 / 4 MiB); publication and listening are now owner-confirmed (about nine minutes reported). #426 dependency-order/proof-reuse is delivered with preserved histories and zero maintenance chain writes. The separately approved “Eskapade à engong” trial now publishes and plays (owner: 7 min 46 s). The offline compact-layout study models fewer stages with startup objects retained. The explicit compact reference, ordinary Web/API/Host dispatch and exact-source admission now have a synthetic real-AAC/sample and loopback gate. Resume measured latency work and review WebKit/native limits. Defer the real recovery rehearsal until after the other product work; retain current-history/service rollback, physical-device and hosted-memory activation requirements, preserving proofs and existing playback. Acceptable latency and hosted memory under new work remain open. Keep the different source sizes and unchanged public-asset tail explicit. |
| 2 — Next           | [Room startup #395](../room-listener-audio.md)                                  | Delivery to guests works on the reported path. Diagnose the roughly 55-second mobile-host start; repeated comparable full-track starts must finish without retry and with audible Web/Desktop guests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 3 — Next           | [System artwork #388](../listening-controls-and-discovery.md), with #87         | Account access and discovery are delivered. Diagnose intermittent late lock-screen artwork in solo and Room; verify repeated locks/track changes without delaying audio or restoring stale metadata.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 4 — Next research  | [CASH tips #406](../product-cash-tip-feasibility.md), with #85/#229             | Shipped-Host/API matrix, honest contribution semantics, durable payment/receipt recovery tests and a go/no-go. Prepare a bounded pilot only if supported.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 5 — Later research | [CASH access #408](../product-cash-access-settlement.md)                        | Verified payment → exact access + royalties, replay/crash/refund design and deterministic harness before any funded validation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## Supporting acceptance gates

[#288 conservation/access/recovery](W33-media-edge-cache.md) remains a public-pilot
prerequisite alongside the sequence above. Existing retention obligations are
immediate duties, even while new feature work waits. Capacity remains research.

The cutover #317, release follow-up #269, native contributions #229, Nearby #274
and pilot #158 move from Now to Next: their delivered code is retained and their
remaining live acceptance is not closed. Use them as supporting gates for the
current sequence, not parallel implementation instructions. #85 compatibility,
#87 cover delivery and the other W13 prerequisites remain explicit; CASH does
not block existing PAS listening or contributions. Project statuses stay
In Progress where partial delivery/acceptance is already underway.

## Current implementation checkpoint, 2026-11-08

[Web/Product/API 0.1.81](evidence/product-0.1.81-rollout-2026-11-08.md) delivers
merged #409–#411 and activates the reviewed fresh v3 domain with two complete
release slots globally. Custody encrypts; both access-checking API replicas share
the same retained/new version map. Old drafts are not migrated and old read keys
and account obligations remain. App writes/records and runtime readiness pass.
Actual ordinary artist publication, wallet registration, catalogue and audible
Web/Desktop/mobile checks still keep #407 open before the Room/artwork slices.

## Evidence and measurable decisions

Product 0.1.80 is delivered; #405 records its readback and owner feedback and is
merged. The owner reports an Adang Fobe mobile-host startup without
retry in approximately 55 seconds and sound at Web/Desktop guests. This is one
approximate observation, not a phase trace or cold-cache benchmark. The new
release failure on Web/Desktop is a separate, higher-priority publication gap.

For #395, expose local sanitized diagnostics after success as well as failure.
Measure access, manifest, queued relay/object reads, authentication/collection,
packaging and media readiness with correlated attempt clocks. Do not add their
concurrent durations as wall time. Record declared network/cache conditions;
never infer them. Capture at least five comparable starts before/after the chosen
correction, report individual timings and retries, and set the latency acceptance
budget from that breakdown before promotion. Existing 60-second post-access
startup and 40 MiB clear-buffer limits remain; increasing them is not the fix.

For #388, reproduce first-load and repeated lock/unlock in both solo and Room,
rapid track changes, failed cover delivery and disconnect during preparation.
Bound prepared-image reuse by immutable cover/composition identity. Artwork must
never gate audio or restore an old track after ownership changes. Native Host/iOS
rendering is a physical acceptance gate; browser MediaMetadata tests alone do
not prove lock-screen behavior. Keep the cover plus bottom-right Dotify badge.

## Delivery rhythm and non-negotiable boundaries

Finish a narrow candidate, its meaningful tests and review first; update the
board and evidence at each merge. Code CI is not device acceptance. Prepare a
matched rollout only once a concrete candidate is reviewable, then ask for any
new live budget/maintenance/funded test that is actually needed. Planning grants
none of those actions. Keep failed drafts and previous receipts, nonce ledgers,
access checks and conservative retained obligations; no reset to make a test pass.

CASH does not block listening or native PAS. Coordinate a Host/SDK change under
#85 using installed distributions rather than latest npm alone; no opportunistic
upgrade in the reliability fixes. Capacity remains research. Conservation #288,
protected denial/interruption and off-volume recovery stay visible alongside
this order; they are not completed by successful playback or more storage quota.
