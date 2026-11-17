# Complete Room preparation can collect past a slow fragment — 15 November 2026

**Code checkpoint: implemented and locally tested, before delivery.** Refs
#395. Code commit `3fafe4d6d5b4ab1cbfd702e3ddad0350b3079942`, based on merged
dev `16e0881c2b59a52033088c30969561aea5efebeb`. That base has the identical tree
to #472's fully tested `1e4120f0` ([CI](https://github.com/knzeng-e/dotify/actions/runs/43649181389));
the merge-triggered CI was still running when this branch started.

The [matching 0.1.86 phone report](product-0.1.86-rollout-2026-11-14.md#matching-phone-follow-up)
records a successful first opening with Pause and audible guest/short-lock
behavior, but complete preparation still takes 33.153 seconds (owner timer:
approximately 29 seconds). Authorization and assembly are short; aggregate read
work includes scheduling, transport and body waits. It does not isolate which
part of each read caused the delay or establish a cold benchmark.

Delivery follow-up: [Web/Product 0.1.87](product-0.1.87-rollout-2026-11-15.md)
publishes this correction with independent readback. Matching physical latency
acceptance remains open; the measurements below keep their original scope.

## Reproduced scheduling gap

The complete-file collector previously used the same ordered read-ahead window
as progressive playback. If an early object waited, later completed objects
still occupied the window until the early object's turn finished. No new object
could enter that full window even when the transport had spare capacity.

A deterministic 72-object regression models a two-body relay, one ten-second
early read and 100-ms later reads. On the parent, only **six requests have
started after ten seconds** and preparation is incomplete. With the candidate,
**all 72 finish in ten seconds**, in correct output order, with a peak of two
HTTP bodies and no busy/fallback response. This is a controlled fake-clock model,
not a measured phone speedup or a diagnosis of all of the reported 33 seconds.

## Chosen boundary

Only the complete-rendition collector changes. Four workers claim the next
object when any read completes and retain each authenticated result at its
original array position. Final assembly stays ordered. The collector already
retains the complete rendition, so an ordered append window provides no memory
benefit here. Progressive/managed playback keeps its existing ordered pipeline.

The alternative of increasing concurrency or the deadline is unnecessary for
this reproduced gap and would change the resource/latency contract. Instead,
the candidate preserves the current reader count, relay capacity, priority,
rendition cap and access checks. Reusable semantics and the implementation map
live in [Continuous listening](../../../explanation/continuous-listening.md#adaptive-delivery).

Progress now counts verified bytes as reads complete, rather than waiting for a
contiguous prefix. It never makes a partial source playable. A later-index
authentication error fails without waiting for an earlier slow object and aborts
siblings; cancelled/failed work cannot emit late progress or commit late parts.
Partial output is discarded, and both declared and actual rendition-size checks
remain. No key or clear media is added to a shared cache.

## Validation

On the code tree above, with unchanged locked dependencies reused locally:

- **1,217 unit tests / 157 files pass.** Fifteen focused collector/relay tests
  are a subset: slow-head capacity, ordered output, completion progress, later
  authentication failure, parent/late cancellation and size limits.
- **16 Chromium/WebKit synthetic AAC/crypto cases pass**: collecting all later
  objects while an early segment is held, playable ordered assembly, existing
  two-body capacity, denial even with prepared media, live solo-to-Room handoff,
  explicit/native Pause and transport/authoritative-denial outcomes.
- Web and frozen Product builds/typecheck pass. Changed TypeScript formatting
  and lint pass; existing Vite chunk-size warnings remain. The temporary local
  dependency symlink is removed before committing; these are validation builds,
  not clean deployment artifacts.

No live API/Fly read, publication, signer, service maintenance, new allowance,
Host/SDK change or musical upload is part of this implementation. Web/Product
remain 0.1.86 with the existing server images and policies. Review/merge, a
matched delivery and comparable first-attempt/full-track phone measurements
remain before latency acceptance. Keep #395 open; compact/CASH activation and
the owner's real-recovery deferral keep their separate boundaries.
