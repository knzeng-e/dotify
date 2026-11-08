# Bulletin publication beyond the synthetic pilot

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
