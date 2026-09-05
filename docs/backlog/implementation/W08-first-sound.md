# W08 — Make artwork and first sound dependable

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W08** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/first-sound` created from the latest tested `origin/dev` when work starts.
- Dependencies: W01.
- Release stage: Pilot.
- Existing issue: #88 (reconcile current state; do not close an epic for a partial slice)
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

A new listener sees a credible catalog and reaches audible music quickly on real devices.

## Read first

- `web/src/features/catalog`
- `web/src/shared/utils/audioV2.ts`
- `web/src/components/CoverImage.tsx`
- `services/api/src/services/audioV2.ts`
- `docs/backlog/24-access-streaming-v2.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Reconcile #88 and #87 before coding. Treat cover work as a linked slice of #87 rather than closing both issues through an unrelated patch.
2. Measure catalog, artwork, key authorization, first media chunk, decryption, buffering, and actual audible start separately. Capture cold/warm cache and gateway failure with build SHA, device, connection, and sample count.
3. Fix the largest measured bottleneck with bounded timeout/fallback and cancellation. If proposing backend read-through, document egress, cache bounds, authorization, partial content, and operational costs.
4. Provide honest progress/retry states and good cover fallbacks. Preserve the retired-preview doctrine: never add an unauthorized excerpt or source-key leak to improve startup metrics.

## Acceptance and meaningful verification

- Real Free playback, denied protected track, paid authorized playback, broken gateway, slow key service, interrupted navigation, and corrupted DAV2 chunk.
- Proposed pilot target: p75 first sound <=2 seconds on the agreed mobile test profile after a play gesture; report observed values, failures, and samples even if the target is missed.
- Audio decoding verified in a real browser; mocked network completion is insufficient.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No playback-engine rewrite without measured need, new preview system, or broad CDN purchase.

## Release condition

Required before pilot; record the agreed test profile and any explicitly accepted latency exception instead of inventing universal performance.

## Handoff

Write `docs/backlog/implementation/evidence/W08.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
