# Publication, listening reliability and CASH — execution order

Owner direction: 2026-11-08. Project 5 owns workflow status; linked ticket files
own scope. One implementation branch/PR per ticket, from current tested dev.
This plan changes priority, not deployed authorization. The existing production
spine, conservation and access gates remain prerequisites for a public pilot.

| Order | Scope / owner ticket | Deliverable and exit gate |
| --- | --- | --- |
| 1 — Now | [New release admission #407](../bulletin-publication-admission.md) | Early truthful refusal, then durable bounded multi-release policy and implementation; reviewed activation followed by actual artist publication on Web/Desktop. No per-track emergency exception. |
| 2 — Next | [Room startup #395](../room-listener-audio.md) | Correlated successful/failed preparation timings, bottleneck correction, repeated full-track phone-host starts without retries and audible Web/Desktop guests. |
| 3 — Next | [System artwork #388](../listening-controls-and-discovery.md), with #87 | Shared solo/Room image preparation and safe reuse; correct cover at repeated locks/track changes, with no audio delay or stale post-disconnect metadata. |
| 4 — Next research | [CASH tips #406](../product-cash-tip-feasibility.md), with #85/#229 | Shipped-Host/API matrix, honest contribution semantics, durable payment/receipt recovery tests and a go/no-go. Prepare a bounded pilot only if supported. |
| 5 — Later research | [CASH access #408](../product-cash-access-settlement.md) | Verified payment → exact access + royalties, replay/crash/refund design and deterministic harness before any funded validation. |

## Current implementation checkpoint, 2026-11-08

#409 is merged with green CI. The next #407 candidate implements
[bounded multi-release admission](../../adr/0046-bounded-multi-release-admission.md),
including matched cover identity, durable aggregate allowances and recovery. The
live scoped pilot remains unchanged. Generation migration, measured operational
approval and actual Web/Desktop artist acceptance are still required before
moving on to the Room/artwork implementation slices.

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
