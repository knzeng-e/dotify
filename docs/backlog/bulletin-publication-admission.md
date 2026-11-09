# Bulletin publication beyond the synthetic pilot

## Timing analysis candidate, 2026-11-09

[The next #407 slice](implementation/evidence/bulletin-timing-report-2026-11-09.md) adds an offline allowlisted timing reader and
a restart-reuse regression. One existing release has ready audio/cover and no
metadata claim; its remaining authority is distinct from a new full-release slot.
Read-only canonical checks find that source registered under the other artist,
not this owner/runtime; a second registration would create another release of
the same audio. No duplicate is proposed merely to collect timings. No writing
sample, deployment or admission change occurs; full-publication latency remains
unverified.

## Current remaining scope after #418, 2026-11-09

Issue #407 · P1 · Production spine · Now · Work. Workflow: Project 5.

Admission beyond the original pilot, durable progress and approval/catalogue
feedback are delivered in 0.1.82; existing-release artist visibility and audible
Web/Desktop playback are confirmed. #415/#416 diagnostics are deployed on custody.
[#418 is delivered to custody from `ec8e82ae`](implementation/evidence/bulletin-parallel-rollout-2026-11-09.md),
with green CI and verified state preservation. The earlier 54.7/58.8-minute preparations are still the relevant
whole-release observations; the smaller verification benchmark does not replace them.

Remaining: inspect current obligations and prepare a separately reviewed bounded
admission/budget for a fresh full-release measurement (two slots out of two are claimed),
collect actual preparation/proof/store/finality/
visibility timings, correct the observed bottleneck and verify acceptable full
publication latency. Keep #407 open until that acceptance. No new write budget,
state reset or maintenance follows from backlog alignment. Follow the
[selected sequence](implementation/listening-and-publication-readiness.md).
Earlier candidate/activation entries below are dated history.

## Parallel verification candidate, 2026-11-09

[The next #407 slice](implementation/evidence/bulletin-parallel-verification-2026-11-09.md) overlaps independent reads at already selected
finalized hashes, preserving canonical proof, fresh retention and all RPC calls.
Nineteen transport cases and 378 API cases pass. Two small read-only comparisons
show shorter marker-check medians with unchanged request counts; publication/
finality latency remains unverified. No profile, write concurrency, key, budget
or deployed service changes; custody remains f9fdd693 and Web/Product 0.1.82.


## Custody diagnostics delivered, 2026-11-09

[The server-only delivery](implementation/evidence/custody-diagnostics-rollout-2026-11-09.md) installs merged #415/#416 on private custody
after both CIs, a completed volume snapshot and stopped-writer inspection.
Health/readiness and all nine selected journal hashes pass; v3/v2, five ready
inventories and two prepared jobs are retained. Web/Product and public APIs
remain 0.1.82. No Bulletin/DotNS operation, new musical allowance or key transfer
occurs. Private timing logs are active, but live per-store latency and faster
publication remain unverified; #407 stays open.


## Custody availability follow-up, 2026-11-09

#415 is merged with green PR checks. Preparing its server delivery exposed a
separate availability failure: custody lost its database lock, closed admission
and exited zero, so Fly did not restart it. [The focused correction](implementation/evidence/custody-lease-exit-2026-11-09.md)
marks that fatal teardown as failure while preserving exclusive ownership and
normal operator shutdown. No live restart/deployment/upload was performed;
server activation, live timings and acceptable latency remain open in #407.

## Publisher latency diagnosis candidate, 2026-11-09

[The next #407 slice](implementation/evidence/bulletin-publication-timings-2026-11-09.md) measures publisher queue/setup,
existing RPC/proof reads and the original create/submit/finalize interval, with
first observed PAPI lifecycle milestones. Reports are bounded private logs with
no key/raw error/CID payload, not new custody state or an ETA. Overlapping phase
totals are not wall time. A three-sample read-only root probe is not a store or
throughput benchmark. API/custody rollout and live timing acceptance remain
open; no new publication, maintenance, policy or deadline is activated.


The [0.1.82 delivery](implementation/evidence/product-0.1.82-rollout-2026-11-09.md)
publishes merged #413 to Web/Product/API and custody with independent source,
finality, byte-readback, service and journal-preservation checks. Confirmed
progress, reliable deadlines and the approval/catalogue distinction are live;
no musical admission or allowance is added. The owner confirms existing-release
artist visibility and audible playback on both Web and Desktop. Long-preparation
acceptance and acceptable publication/indexing speed remain open; #407 is not
complete.

## Full-release wait incident and repair candidate, 2026-11-08

The authorized 0.1.81 rollout is recorded in [#412](https://github.com/knzeng-e/dotify/pull/412).
The owner then reports long waits/errors on Web and Desktop. Read-only inspection
finds the first 175-block audio ready after about 55 minutes and the second still
advancing, rather than failed. The [repair candidate](implementation/evidence/bulletin-publication-progress-2026-11-08.md)
orders backend assets, reports confirmed counts, preserves explicit same-draft
resume, and owns deadlines through Node garbage collection. Actual registration,
catalogue/sound and acceptable latency remain open; #407 is not complete. No
live writer is restarted, retried or reset by this investigation/candidate.

## Bounded fresh development publication active, 2026-11-08

[Web/Product/API 0.1.81](implementation/evidence/product-0.1.81-rollout-2026-11-08.md)
activates merged #409–#411 from frozen `1394503f`, with green source CI and
independent application/record/retention readback. The owner approved two complete
new releases globally across the two reviewed artist/runtime pairs. New random
v3 master/empty journals replace recovery of abandoned drafts; retained v2 and
all old paths/account obligations remain. Custody and both key-serving API
replicas have the same active v3 mapping and pass readiness. No musical upload
was performed by the operator; ordinary fresh publication, explicit wallet
registration, catalogue and audible Web/Desktop/mobile acceptance remain open.
Keep #407 In Progress until that evidence, rather than closing it on activation.

## Fresh development start selected, 2026-11-08

The owner chose a new publication/key domain instead of migrating old test drafts.
#409/#410 are merged. [ADR 0047](../adr/0047-fresh-bulletin-development.md) and the
[fresh setup runbook](../operations/bulletin-fresh-development.md) prepare a new
private queue/publisher with a random content master under a later version, bound
to startup configuration before signer loading. No old history is imported or
reset; the same Bulletin account keeps its nonce/quota/retention obligations.
Actual matched rollout, measured budget and real artist acceptance remain open.

## Multi-release implementation candidate, 2026-11-08

#409/#410 are merged with green CI. The implementation supplies the opt-in durable
whole-release policy in [ADR 0046](../adr/0046-bounded-multi-release-admission.md):
audio/cover/metadata share a scoped allowance and global cap; claims survive
restart and cleanup, and lost store responses reuse receipts/ciphertext. Cover
identity is carried by matched clients, and metadata must reference its own ready
objects with fresh canonical retention. The [local evidence](implementation/evidence/bulletin-release-admission-2026-11-08.md) records the tests. The old pilot remains the deployed mode.

Review, fresh-key setup, measured activation budget and actual artist Web/Desktop
acceptance remain open. Migration of abandoned drafts is superseded by the owner
decision above; conservation/coherent recovery remain public-pilot requirements.
This does not activate multiple releases or authorize new musical writes.

Issue #407 · P1 · Production spine · Now · Work. Workflow: Project 5.

## User impact and evidence, 2026-11-08

The owner cannot publish a new artist release on either Web or Product Desktop.
The screenshot fails at audio storage, before registry approval, and suggests
retrying. Read-only inspection confirms custody selects Bulletin for audio and
public assets, with a scoped pilot profile; the recent failed storage job is not
in its admitted inventory. The logs expose stage=storage without the underlying
exception. This establishes a real admission limit; it does not prove there are
no additional failures behind it. Pinata's earlier free-file limit is not evidence
that the active Bulletin publisher is sending this job to Pinata.

The original synthetic pilot is intentionally restricted to one job and exact
release identity. Removing the checkbox did not activate general publication.
Do not weaken that boundary or create another ad hoc artist-name/file exception.

## Owner publication succeeds; artist feedback follow-up, 2026-11-09

The owner confirms an existing Black Panther release registered, later appeared
in Music and played audibly. Screenshots still show an alert and **Publishing…**
after approval. The [feedback candidate](implementation/evidence/artist-publication-feedback-2026-11-09.md)
keeps confirmed approval separate from catalogue visibility, with bounded
read-only checks and an explicit editor action. This is one reported journey,
not separately identified Web/Desktop or both-artist acceptance. #413's storage
candidate and throughput remain separate; #407 stays open. No new upload,
service maintenance, signing or budget is performed by this follow-up.

## Ordered implementation and acceptance

1. **Early, truthful refusal (current candidate).** Reuse the publisher's admission
   checks before a new job reserves nonces/encodes and before retry changes a saved
   job. Return a typed operator-action error. Retain the authoritative check before
   storage because another job may win the race. Persist late admission refusals;
   the client must not automatically retry or discard them. Existing ready releases,
   Pinata mode and legitimate same-job recovery remain supported.
2. **Durable multi-release admission.** Review a policy for admitted artist/runtime,
   release identity, audio/cover/metadata ownership, per-release and aggregate caps,
   consumed attempts, retention obligations and exclusive signer nonce ownership.
   Admission must be inspectable before expensive work and survive restart. A
   rejected/partial release must neither free spent budget nor strand older ones.
3. **Implementation and rehearsal.** Cover concurrent releases, retries/crashes,
   ambiguous submissions, quota/authorization expiry, wrong artist/runtime, edited
   drafts and duplicate registry submissions. Preserve ciphertext, nonce ledgers,
   receipt history and protected key checks. No fallback to Pinata on refusal.
4. **Reviewed activation and actual artist journey.** Prepare measured store/byte
   caps, retention/recovery obligations, rollback and configuration changes. After
   authorization, use an artist-selected release on Web and Desktop: ordinary
   publication, explicit wallet approval, catalogue readback and audible playback.
   This final evidence, rather than the early-error fix, closes #407.

## Boundaries and dependencies

Related #287/#288/#317/#158. General publication requires conservation and coherent
recovery, not just additional chain quota. Existing encrypted preparation snapshots
and receipts remain intact. This ticket does not itself authorize musical uploads,
profile replacement, increased quota, service maintenance, key transfer or a live
payment. The current deployed pilot remains restricted until reviewed activation.
See [execution order](implementation/listening-and-publication-readiness.md) and
[publication runbook](../operations/bulletin-artist-publication.md).
