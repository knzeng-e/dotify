# Publication, listening reliability and CASH — execution order

## Exact write-window trial activated, 2026-11-10

[The approved custody-only activation](evidence/bulletin-window-activation-2026-11-10.md) delivers #424 from
`59244da5`, identical to tested merged dev `3afd2b58`. A completed provider
snapshot, one stopped-writer apply, preserved prior state/nonces and two
health/readiness checks are verified. One owner-selected new source has a
16-store / 4-MiB write window; proof reads and previous grants remain unchanged.
The maintenance performs zero Bulletin/DotNS operations. Web/Product/public
APIs stay on 0.1.82. Artist publication, audible playback and acceptable latency
for this window remain unverified. #407 stays Now/In Progress before #395,
#388 and the CASH research slices; earlier candidate entries are dated history.

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

## Current execution after #424, 2026-11-10

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
- **Immediate action:** publish the selected new source through the ordinary
  artist app/wallet flow, capture source-matched timings, verify catalogue and
  sound, and assess the actual latency. Existing grants remain at their original
  settings; do not reuse/reset an old job as a funded benchmark. No acceptable
  duration or gain is inferred from the offline schedule.

| Order | Scope / owner ticket | Remaining deliverable and exit gate |
| --- | --- | --- |
| 1 — Now | [Publication latency and acceptance #407](../bulletin-publication-admission.md) | Admission, progress and catalogue feedback are delivered. The approximately 50-minute Street scriptures run identifies repeated finality waits. #424 is now activated on custody for one approved new exact source (16 / 4 MiB); measure actual preparation/proof/store/finality/visibility, complete artist wallet and audible acceptance, then assess acceptable latency. |
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
