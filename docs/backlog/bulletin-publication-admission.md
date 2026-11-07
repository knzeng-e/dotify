# Bulletin publication beyond the synthetic pilot

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
