# Publication, listening reliability and CASH — execution order

## Current execution after #418, 2026-11-09

This is the selected execution order. Project 5 owns workflow status; the
manifest owns issue/doc/priority/phase mappings. **Now** means the next work to
execute; **Next** includes unfinished acceptance of already delivered code.
In Progress does not mean every partially delivered ticket runs concurrently.
Older dated prompts and deployment records describe their original checkpoint.
Owner direction is November 8, reconciled after #418 on November 9. Start each
implementation branch from current tested dev; use one PR per backlog scope.

- **Delivered:** Web/Product/API 0.1.82; the owner confirms existing-release
  artist visibility and audible Web/Desktop playback. Custody additionally runs
  #415/#416 diagnostics and failure-exit handling, recorded by #417.
- **Merged, not deployed:** #418 parallel verification reads, merge `1e177640`.
  Reviewed source CI passes; the post-merge dev CI is a separate rollout gate.
  The measured 22–27% gain concerns small verification checks only. Whole-release
  preparation/finality speed is still unverified.
- **Immediate action:** prepare the server rollout of #418, then a bounded
  publication measurement with the deployed stage diagnostics. Inspect existing
  receipts, allowances and retention duties before proposing any new write test.
  No maintenance or new musical allowance is granted by this plan.

| Order | Scope / owner ticket | Remaining deliverable and exit gate |
| --- | --- | --- |
| 1 — Now | [Publication latency and acceptance #407](../bulletin-publication-admission.md) | Admission, progress and catalogue feedback are delivered. Prepare #418 rollout; measure preparation/proof/store/finality/visibility separately, then correct the observed bottleneck and verify an acceptable artist publication journey. |
| 2 — Next | [Room startup #395](../room-listener-audio.md) | Delivery to guests works on the reported path. Diagnose the roughly 55-second mobile-host start; repeated comparable full-track starts must finish without retry and with audible Web/Desktop guests. |
| 3 — Next | [System artwork #388](../listening-controls-and-discovery.md), with #87 | Account access and discovery are delivered. Diagnose intermittent late lock-screen artwork in solo and Room; verify repeated locks/track changes without delaying audio or restoring stale metadata. |
| 4 — Next research | [CASH tips #406](../product-cash-tip-feasibility.md), with #85/#229 | Shipped-Host/API matrix, honest contribution semantics, durable payment/receipt recovery tests and a go/no-go. Prepare a bounded pilot only if supported. |
| 5 — Later research | [CASH access #408](../product-cash-access-settlement.md) | Verified payment → exact access + royalties, replay/crash/refund design and deterministic harness before any funded validation. |

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
