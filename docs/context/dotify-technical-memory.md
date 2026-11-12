# Dotify technical memory

Current code/deployment checkpoint: see the
[selected sequence](../backlog/implementation/listening-and-publication-readiness.md).
Explicit compact reference/dispatch and exact-source admission are implemented
as a candidate, with an automated synthetic AAC/sample and loopback guest gate;
the [prepared-job recovery candidate](../operations/bulletin-prepared-job-recovery.md)
now preserves original admitted standard/compact audio and its storage history.
A [generated cross-runner backup rehearsal](../operations/bulletin-generated-restore-rehearsal.md)
now exercises source loss and coherent restoration of both layouts. Operational
backup/key recovery, historical-binary rollback, physical-device, hosted-memory
and live acceptance remain ahead.
Earlier dated notes retain their original scope.

## Listening security review, 2026-11-11

[The bounded #431 correction](../backlog/listening-security-hardening.md) keeps disconnect and grant expiry
authoritative at key delivery, rejects malformed Room input before mutation and
bounds negotiation work per socket. Shared listening, anonymous guests and free
access retain their existing policies. This is a code candidate alongside #407,
without deployment or new publication authority; physical Host/load acceptance
remains separate. Earlier dated entries retain their historical scope.

## Compact graph and durable layout binding, 2026-11-11

[The next #407 implementation](../adr/0052-bulletin-layout-inventory-binding.md) adds a fixed 256-KiB compact graph constructor
and binds its layout to a distinct journal version before any storage intent.
Current jobs and publications keep their existing format; composition and
prepared recovery refuse compact inventories before producing an unsupported
reference. Restart/lost-acknowledgement tests preserve the same graph, generation,
nonce and attempts. Versioned references, reviewed per-identity admission,
API/Host range readers and real-media acceptance remain next; no compact switch,
service delivery or new trial is enabled. Custody stays on #426 and Web/Product/
public APIs on 0.1.82. #407 remains Now/In Progress before Room/artwork/CASH.

## Offline compact-layout study, 2026-11-11

[The reproducible #407 study](../backlog/implementation/evidence/bulletin-compact-layout-2026-11-11.md) compares
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

[The approved exact trial](../backlog/implementation/evidence/bulletin-eskapade-activation-2026-11-11.md) now publishes and plays, confirmed
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

[The approved custody-only delivery](../backlog/implementation/evidence/bulletin-round-trips-rollout-2026-11-10.md) installs #426 from tested
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

[The next #407 slice](../backlog/implementation/evidence/bulletin-round-trips-2026-11-10.md) orders remaining dependency work only when the local
wave model improves, and reuses bounded completed block-proof data while
refreshing eligibility and canonical mapping. Synthetic audio stages fall
9→8 / 13→12; cover/metadata stay 3 / 2. Graph bytes/CIDs, journal order, nonce
ownership and proof/retention gates remain. 415 API tests, typecheck and build
pass. Review, matched custody rollout and actual latency acceptance remain;
this candidate adds no live admission or musical write. Custody stays `59244da5`,
Web/Product/public APIs 0.1.82; the selected sequence is unchanged.

## Exact write-window trial activated, 2026-11-10

[The approved custody-only activation](../backlog/implementation/evidence/bulletin-window-activation-2026-11-10.md) delivers #424 from
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

[The #407 correction](../backlog/implementation/evidence/bulletin-direct-write-window-2026-11-10.md) separates a future exact release's bounded write
window (up to 16 / 4 MiB) from its unchanged proof-reader limit. Synthetic
151-block schedules use 77 legacy finalized stages versus 13 at the maximum;
these are not live timings. Profiles, existing grants/jobs, keys and budgets are
not retuned. Compatible code, reviewed activation and actual latency acceptance
remain ahead; custody stays `cd7ed569`, Web/Product/public APIs 0.1.82.

## Fresh release succeeds; latency remains open, 2026-11-10

The owner confirms “Street scriptures” publication and listening, after roughly
49 min 54 s of preparation. [The timing diagnosis](../backlog/implementation/evidence/bulletin-street-scriptures-timings-2026-11-10.md) correlates one ready
attempt with 151 stores, two at a time, averaging about 32.5 s through finalization.
The server job clock is 50 min 53.6 s, a separate observation. Publication works;
acceptable latency does not. Keep #407 Now/In Progress: evaluate a bounded direct-
write window and separate proof-read limits before another funded measurement.
No new write, maintenance, profile edit or claimed-slot reset occurs here.

## Exact release allowance delivered, 2026-11-10

[The approved custody delivery](../backlog/implementation/evidence/bulletin-street-scriptures-activation-2026-11-10.md) activates #422 for one exact new
“Street scriptures” source under the existing artist/v3 domain. Green merged-dev
CI, a completed snapshot, compiled stopped-writer inspection/apply, unchanged
protected history/nonces and two healthy readiness checks are verified. The two
original claims remain; one exact additional allowance is active. Zero operator
Bulletin/DotNS operations or key changes occur. Web/Product/public APIs remain
0.1.82. Artist publication, measured latency and audible acceptance stay open in
#407; the selected order remains #407 → #395 → #388 → #406 → #408.

## Exact release allowance candidate, 2026-11-10

[The next #407 slice](../backlog/implementation/evidence/bulletin-admission-extension-2026-11-10.md) prepares an exact-source capacity extension,
without rotating the content key or replacing the queue. Existing slots, part
caps and permanent history remain; offline activation requires a bound checkpoint
and exclusive publisher lease. The owner supplied a new source/cover and selected
the existing artist. Local graph sizing is 151 audio + 10 cover blocks; actual
publisher/full-publication latency is still unmeasured. No live capacity, service
change or musical spending follows from this candidate.

## Timing analysis candidate, 2026-11-09

[The next #407 slice](../backlog/implementation/evidence/bulletin-timing-report-2026-11-09.md) adds an offline allowlisted timing reader and
a restart-reuse regression. One existing release has ready audio/cover and no
metadata claim; its remaining authority is distinct from a new full-release slot.
Read-only canonical checks find that source registered under the other artist,
not this owner/runtime; a second registration would create another release of
the same audio. No duplicate is proposed merely to collect timings. No writing
sample, deployment or admission change occurs; full-publication latency remains
unverified.

## Parallel verification delivered, 2026-11-09

[The custody-only delivery](../backlog/implementation/evidence/bulletin-parallel-rollout-2026-11-09.md) installs #418 from frozen `ec8e82ae` after green
exact-source CI, a completed snapshot and stopped-writer inspection. Two
post-start health/readiness checks and all nine selected journal hashes pass;
v3/v2, five inventories, two jobs and cursor are preserved. Public API replicas
and Web/Product remain 0.1.82. Zero operator Bulletin/DotNS operations, new musical
allowance or key transfer. Full-publication latency remains unmeasured; the two
existing release slots are already claimed, so a new writing measurement needs
separately reviewed admission/budget without resetting state. #407 stays open.

## Execution alignment after #418, 2026-11-09

The [selected plan](../backlog/implementation/listening-and-publication-readiness.md)
is #407 publication latency → #395 Room startup → #388 system artwork → #406
CASH tips research → #408 CASH access research. #418 is merged but not deployed;
prepare its server rollout and a bounded full-publication measurement. #415/#416
are already on custody; Web/Product/API remain 0.1.82. The measured read-check
gain is not whole-release latency. Five older Now scopes move to Next supporting
acceptance; nothing is closed, reset, deployed or funded by this reconciliation.
Earlier dated candidate records retain their original meaning.

## Parallel verification candidate, 2026-11-09

[The next #407 slice](../backlog/implementation/evidence/bulletin-parallel-verification-2026-11-09.md) overlaps independent reads at already selected
finalized hashes, preserving canonical proof, fresh retention and all RPC calls.
Nineteen transport cases and 378 API cases pass. Two small read-only comparisons
show shorter marker-check medians with unchanged request counts; publication/
finality latency remains unverified. No profile, write concurrency, key, budget
or deployed service changes; custody remains f9fdd693 and Web/Product 0.1.82.

## Custody diagnostics delivered, 2026-11-09

[The server-only delivery](../backlog/implementation/evidence/custody-diagnostics-rollout-2026-11-09.md) installs merged #415/#416 on private custody
after both CIs, a completed volume snapshot and stopped-writer inspection.
Health/readiness and all nine selected journal hashes pass; v3/v2, five ready
inventories and two prepared jobs are retained. Web/Product and public APIs
remain 0.1.82. No Bulletin/DotNS operation, new musical allowance or key transfer
occurs. Private timing logs are active, but live per-store latency and faster
publication remain unverified; #407 stays open.

## Publication checkpoint and next diagnosis, 2026-11-09

[0.1.82 is delivered](../backlog/implementation/evidence/product-0.1.82-rollout-2026-11-09.md);
the owner confirms existing-release artist visibility and audible Web/Desktop
playback. The [next #407 candidate](../backlog/implementation/evidence/bulletin-publication-timings-2026-11-09.md)
adds bounded private publisher stage timings before changing concurrency or
formats. It is not deployed and does not claim faster publication; catalogue
latency, long-preparation acceptance and broader production gates remain open.
No new admission, musical write, schema/key reset or deadline extension occurs.

## Fresh development start selected, 2026-11-08

The owner chose a new publication/key domain instead of migrating old test drafts.
#409/#410 are merged. [ADR 0047](../adr/0047-fresh-bulletin-development.md) and the
[fresh setup runbook](../operations/bulletin-fresh-development.md) prepare a new
private queue/publisher with a random content master under a later version, bound
to startup configuration before signer loading. No old history is imported or
reset; the same Bulletin account keeps its nonce/quota/retention obligations.
Actual matched rollout, measured budget and real artist acceptance remain open.

## Multi-release publication candidate, 2026-11-08

#409/#410 are merged. [The #407 implementation](../adr/0046-bounded-multi-release-admission.md)
allows successive artist releases inside a fresh explicit aggregate policy,
reserving audio/cover/metadata together and preserving claims across recovery.
Matched clients bind covers to the track; metadata cannot substitute another
release's assets or rely on expired retention. Local synthetic proof is separate
from fresh-key rollout, quota/renewal obligations and real artist
Web/Desktop acceptance. No live profile, signer, service or musical asset is
changed. Current deployment remains the scoped pilot.

## Owner execution plan, 2026-11-08

[New-release publication admission #407](../backlog/bulletin-publication-admission.md)
now precedes Room startup #395 and shared system-artwork reliability #388. The
current Bulletin profile remains a scoped synthetic pilot; new artist releases
cannot be assumed enabled. The owner reports about 55 seconds for a successful
0.1.80 Room start, and intermittent late cover display in solo and Room. These
need separate measured diagnosis. CASH tip research #406 and access settlement
#408 follow, coordinated with #85/#229; native PAS and pinned SDK stay unchanged.
See [the ordered plan](../backlog/implementation/listening-and-publication-readiness.md).
Planning/code review does not activate general storage, deploy or authorize payments.

## Room preparation delivered in 0.1.80, 2026-11-07

[Web and Product 0.1.80](../backlog/implementation/evidence/product-0.1.80-rollout-2026-11-07.md) deliver #404 from frozen `30702580`, based on
merged/tested dev `e7614b4d`. Both CIs and independent Web/CAR/finalized-retention/
DotNS checks pass; the signer is removed. Client relay reads respect the existing
two-download API capacity and failures expose an explicit local support report.
The owner confirms one phone Room start without retry in about 55 seconds and audible Web/Desktop guests. Startup remains too slow; #395 stays open for latency and broader lifecycle. The owner also reports intermittent delayed lock-screen artwork in both solo and Room; #388 remains open for the shared system-image path.
The owner confirms 0.1.79 connection/short playback on iPhone 0.10.0 (20), Runtime
0.26.0; scoped wire comparison supports the unchanged SDK's used domains, not a
blanket protocol/payment upgrade. Approved writes: 13 stores / 4,425,117 bytes,
7 one-off renewals / 5,061,961 bytes, two DotNS signatures. Preserve 431 future
renewals / 150,484,205 bytes. API/custody/signaling and musical assets are unchanged;
no restart or recurring conservation is activated.

## Listening continuity delivered in 0.1.79, 2026-11-07

[Web, Product and signaling 0.1.79](../backlog/implementation/evidence/product-0.1.79-rollout-2026-11-07.md) deliver merged #401/#402 from frozen
`c656992c`. Both CIs and independent Web/CAR/retention/DotNS/signaling checks pass;
the signer is removed. Closed playback starts fresh, Room exits confirm with a
host solo-continuation choice, discovery panels retain listening controls, and
matched signaling preserves chat paragraphs. Solo/Room system covers use the
larger bottom-right Dotify badge without outer petals. Matching physical checks
remain open in #395/#388. The approved operation uses 13 stores / 4,423,600 bytes,
7 one-off renewals / 5,061,961 bytes and two DotNS signatures. Preserve 411 future
renewals / 140,997,127 bytes. Signaling restarted only after a zero-Room check;
API/custody and music are unchanged. No recurring conservation is activated.

## Explicit player lifetime and Room-to-solo continuity, 2026-11-07

The November 7 candidate removes the local listening checkpoint and retires the actual source/output on player dismissal through useCatalog.clearPlayback. Normal catalog authorization selects a new generation on reopening. An explicitly confirmed host Room exit retains the existing local output/play-pause state while retiring peers; guest/remote closure stops and dismisses. Artist-profile history takes ownership of a departing sheet entry before deferred motion to avoid a cleanup pop race. Catalog focus/scroll restoration remains with the catalog journey controller.
See the [candidate and evidence](../backlog/implementation/evidence/listening-session-continuity-2026-11-07.md). This is not deployed; physical phone close/reopen and native presentation remain acceptance gates.

The follow-up adds a provider-free presentation slot to ListeningSheet and reuses existing playback through ListeningNowPlaying. RoomChat uses a bounded textarea; signaling preserves sanitized newlines only for chat, while requests remain single-line. Limits, membership checks and ephemeral history stay unchanged. Matching signaling rollout is required for end-to-end paragraphs; no service is deployed by the candidate.

## Room lifecycle delivered in 0.1.78, 2026-11-06

[Web and Product 0.1.78](../backlog/implementation/evidence/product-0.1.78-rollout-2026-11-06.md) publish merged #400 from frozen source
`6898863d`. Both CIs and independent Web/CAR/finalized-retention/DotNS readback pass;
the signer is removed. Failed preparation cannot create a silent Room; observed
output interruption pauses at position with visible explicit recovery. Solo and
Room share rounded Dotify petal artwork without tiny room text. The owner confirms
startup without retry and host/guest sound during the requested short phone lock.
Broader lifecycle/recovery and artwork checks remain open in #395/#388.
This bounded application-only operation uses 14 stores / 5,259,623 bytes and
6 immediate renewals / 4,214,282 bytes, one operation per dependency.
Preserve 391 future renewals / 131,511,566 bytes. No automatic renewal, musical
write, API/custody change or service restart. Older checkpoints remain dated facts.

## Full-length Room correction delivered in 0.1.77, 2026-11-06

[Web and Product 0.1.77](../backlog/implementation/evidence/product-0.1.77-rollout-2026-11-06.md) publish merged #399 from frozen source
`0587442d`. CI and independent Web/block/CAR/DotNS checks pass; the local signer
is removed. Complete mobile Room preparation uses at most four authenticated
reads and a complete local AAC index, preserving payloads, access checks,
existing deadlines and the 40 MiB cap; solo remains progressive.
The owner confirms eventual full-length phone-host sound at Web/Desktop guests,
but startup still has delays/errors/retries and locking the phone silences both
host and guests until unlock. Reliable startup, background and lifecycle checks
remain open in #395; the eight-second 0.1.76 result stays separate.
Reserve 371 future renewals / 122,037,661 bytes; no renewal/scheduler is activated.
API/custody, musical assets and policies are unchanged; no service restart occurs.
Older dated checkpoints retain their state at that time.

## Mobile room capture delivered in 0.1.76, 2026-11-05

[Web and Product 0.1.76](../backlog/implementation/evidence/product-0.1.76-rollout-2026-11-05.md) publish merged #397/#398 from frozen source
`e195e3ab`. CI and independent Web/CAR/Bulletin/DotNS checks pass;
the local signer is removed. Managed-only room hosts use authenticated complete
96 kb/s AAC with the existing buffer cap, while solo stays progressive. Room
queue/suggestions/details share listening-sheet motion and access-gate ownership.
The owner confirms foreground mobile-host sound at Web/Desktop guests on the
eight-second release; full-length Room preparation still fails (#395).
Physical lifecycle/background checks (#395) and matching panel acceptance (#396)
remain open. Reserve 351 renewals /
112,567,204 bytes; no renewal or conservation activation occurs.
API/custody source/media/policies are unchanged. An already-stopped custody
instance was restored during preparation after database-lock loss; the code-0
exit/supervisor defect remains a separate reliability follow-up.

## Continuous listening published in 0.1.75, 2026-11-05

[Web and Product 0.1.75](../backlog/implementation/evidence/product-0.1.75-rollout-2026-11-05.md) deliver merged #391/#393 from frozen source
`e095f427`. Exact-source CI and independent Web/block/CAR/DotNS readback
pass; the local signer is removed. Player/Queue motion, title-adjacent room
discovery and room-branded system context are delivered. API/custody, media and
policies are unchanged; no restart or renewal occurs. Reserve
331 renewals / 103,099,297 bytes. Matching
physical #392/#388 acceptance remains open. W33 retains protected denial and
conservation/recovery gates; the merged read-only conservation CLI is not
activated/deployed by this client rollout.

## Listening controls published in 0.1.74, 2026-11-05

[Web and Product 0.1.74](../backlog/implementation/evidence/product-0.1.74-rollout-2026-11-05.md) deliver merged #389 from frozen source `e8d3be90`.
Independent Web/block/CAR/DotNS readback and exact-source CI pass; the signer is
removed. Mobile-player account access, live room release/artist discovery and
corrected system artwork/actions are delivered. API/custody, music, access policy
and the independent lab are unchanged; no renewal or restart occurs. Reserve
311 renewals / 93,634,213 bytes. Physical native #388 acceptance remains open;
W33 retains signed denial, account switching, room-guest silence, conservation
and coherent off-volume recovery. The read-only conservation implementation in
this PR is a separate candidate, not part of the deployed client/API source.

## Conservation assessment candidate, 2026-11-05

[The operator command](../operations/bulletin-conservation.md) keeps conservation
separate from publishing: explicit dependency plan → one finalized metadata
snapshot → per-block/account/quota severity. Supports Product SHA-256 and media
BLAKE2b without loosening media readers; shared CID sizes must agree. Existing
reserve floors are preserved; unknown reads are critical. No signer, automatic
renewal, alert schedule or live activation. Complete inventory, retrievable bytes
and coherent off-volume key/data restoration remain W33/#288 gates.

## Protected account interruption published, 2026-11-05

[Web and Product 0.1.73](../backlog/implementation/evidence/product-0.1.73-rollout-2026-11-05.md) deliver merged #386 from exact tested
source `560e7332`. Disconnect/account/network changes retire the old protected
source and producer; reopening requires explicit normal authorization checks.
Free/profile-only playback is preserved. Independent Web/CAR/DotNS readback passes;
12 app stores / 3,557,988 bytes, eight reuses and two signing requests stay within
the approved cap. The local signer is removed; API/custody, media, admission and
keys are unchanged. The public Free route rejects Classic with NOT_FREE and no
key; this is not a signed unentitled-listener test. The owner confirms sound
stops on disconnect and explicit recovery works on Web, Desktop and mobile.
Account switching, signed denial and room-guest silence remain unverified.
Reserve 291 renewals / 84,178,313 bytes; no renewal is
submitted and earliest reused expiry remains block 1,532,185. W33 stays open for
physical access/interruption, conservation and coherent off-volume recovery.

Next iteration: [#388 listening controls and discovery](../backlog/listening-controls-and-discovery.md) records the
owner's mobile Player disconnect, room track-details and lock-screen artwork/
previous-next requests. The [client implementation candidate](../backlog/implementation/evidence/listening-controls-and-discovery-2026-11-05.md) reuses the existing account sheet,
current room identity and shared playback ownership. Public artwork is resolved
for Media Session and relative-seek actions are cleared. Local automated checks
pass; review, matching delivery and physical lock-screen evidence remain open.
No service/storage policy or deployed version changes.

## Registered Bulletin playback published, 2026-11-04

[Web and Product 0.1.72](../backlog/implementation/evidence/product-0.1.72-rollout-2026-11-04.md) publish merged #385 from exact tested source
`018011d4`. Independent block/CAR/DotNS/Web readback passes; 12 app stores /
3,557,283 bytes, eight reused blocks and two signing requests stay within the
owner-approved cap. The local signer is removed. The fresh eight-second release
is already registered as **Thot Nzeng**, at block 15,321,680 / 1.42 PAS; this
client-only rollout preserves its audio, metadata and access checks. API/custody
remain source `e2dd6148`, with no restart or policy change. The owner confirms hearing all eight seconds on Web, Desktop and mobile.
Next: protected denial/interruption, dependency conservation and coherent
off-volume recovery. W33/#288 remains open.
Older dated checkpoints below describe their state at that time.

## Product 0.1.70 and exact repair admission, 2026-11-03

The [verified rollout](../backlog/implementation/evidence/product-0.1.70-rollout-2026-11-03.md) deploys the required artist-name checks and admits
one exact **Thot Nzeng** metadata repair for the preserved synthetic pilot.
Audio, cover, old metadata, receipts and original allowances remain intact;
no re-encoding or attempt reset occurs. The permit itself sends no metadata and
registers no release. Next: resume the saved draft through normal artist upload
and wallet approval, then verify protected Web/physical Host allowed and denied
listening. Conservation/renewals and off-volume restore remain W33 gates.
Older dated checkpoints below retain their historical meaning.

## Product 0.1.69 deployment, 2026-11-02

The [verified rollout](../backlog/implementation/evidence/product-0.1.69-rollout-2026-11-02.md) updates Web, Product and the existing API/custody
services, and activates one bounded Bulletin cover/metadata policy without Pinata
fallback. The artist no longer chooses an optional archive. At this rollout, the
synthetic audio job still needed controlled recovery with its three attempts
preserved. [The subsequent recovery record](https://github.com/knzeng-e/dotify/pull/380)
confirms ready audio; merged #382 prepares the remaining name-only metadata repair,
without activating it. Registration and protected physical-device acceptance remain
open. No allowance/counter reset, new service or key installation occurred.
Conservation monitoring/renewal and off-volume restore remain open; Capacity stays
deferred research. Older checkpoints below retain their dated meaning.

## Bulletin publication UX, 2026-11-02

The [publication cleanup](../backlog/implementation/evidence/bulletin-publication-ux-2026-11-02.md) removes the obsolete optional client archive
and development-signer choice. The upload service remains authoritative for
storage routing; artist approval, access checks and bounded publication allowances
are unchanged. The server-side public-asset path is merged in #376; this cleanup
does not activate it. The owner selected Bulletin stabilization first; Capacity
remains deferred research. Next: reviewed public-asset activation and pilot
recovery, then conservation inventory, bounded renewal and off-volume restore.

> 2026-10-28 owner decision: retire the optional 3D renderer and Three.js.
> Radar and List remain the supported discovery views. Historical 3D delivery
> notes below are evidence, not a request to restore it. Immersive metaverse
> exploration is deferred, with no implementation commitment.

## Owner priority: stabilize Bulletin, 2026-11-01

Bulletin remains the active storage direction. [Capacity stays deferred research](../research/capacity-storage-evaluation-2026-11-01.md), with no integration, provider switch or live canary in the current delivery scope.

The next bounded work is to finish the public-asset path in #376, then retire the old optional client-side Bulletin archival checkbox so artists do not select infrastructure or trigger a duplicate signer-dependent write. Conservation follows: account authorization and per-block retention are separate clocks; implement verified renewal scheduling/alerts for every dependency, plus coherent off-volume encrypted-data/key recovery and an honest artist-facing availability commitment. Reserved quota alone does not renew data. Preserve existing jobs, attempts, account cursors and immutable budgets; real writes and rollout retain their explicit reviewed bounds. Physical protected Web/Host publication/listening remains acceptance, not inferred from code or a healthy endpoint.

## Public assets follow-up, 2026-11-01

The owner chose Bulletin covers/metadata after confirming the Pinata account's file cap. [ADR 0044](../adr/0044-bulletin-public-release-assets.md) prepares one cover/metadata pair through the existing private writer, with separate caps, the same durable account cursor, signed grants and renewed canonical authority checks. Host-aware reads use native preimages with existing API recovery; Web uses a bounded public image/JSON relay. This is not deployed or an audio-attempt reset. Exact write approval, failed-job recovery, physical protected acceptance and retention remain gates. Older preparation checkpoints below describe their historical state.

## Bulletin publication checkpoint, 2026-11-01

[ADR 0043](../adr/0043-bulletin-artist-publication.md) connects the authenticated
artist audio queue to an explicitly selected Bulletin writer in private custody.
[Product 0.1.68 and its bounded pilot are deployed](../backlog/implementation/evidence/product-0.1.68-rollout-2026-11-01.md).
The private writer admits one exact runtime/content scope and one durable job;
its allowance cannot repeat across new uploads or restarts. Web and Host use the
application readers from #371; server-side signed key access remains authoritative.
Covers/metadata still use Pinata. Normal artist registration and real-runtime
protected Web/physical Host listening, representative timings/costs, off-volume
recovery and recurring retention remain gates. No audio is sent by the rollout
itself, no broader artist allowance is activated, and no new hosting service or
permanent old-runtime layer is introduced. The owner-approved server key reuses
the DotNS account and retains its full authority; it is confined to private custody.

## Delivery checkpoint, 2026-10-26

Use the [current backlog reconciliation](../backlog/implementation/evidence/backlog-reconciliation-2026-10-26.md)
and [candidate plan](../operations/pilot-release-plan.md) before acting on older
snapshots below. They distinguish delivered work, Product 0.1.62 publication,
pending client corrections and the remaining physical/pilot acceptance gates.

## Current architecture

Dotify currently uses:

- React + Vite frontend under `web/`;
- Socket.IO signaling server for rooms;
- WebRTC host-to-listener audio transport;
- Pinata/IPFS for audio, cover, and metadata references;
- server-selected Bulletin publication under an explicit operator allowance;
- no artist-facing optional archive or development-signer choice;
- Paseo Asset Hub EVM contracts;
- artist-owned SmartRuntime model;
- ArtistRuntimeFactory and ArtistDirectory;
- music pallets for registry, NFT ownership, royalties, access, and personhood gating.
- Fastify catalog read model with confirmed event indexing, deterministic
  reconciliation, and an atomic persisted snapshot.

## Active product surfaces

Execution update (September 2026): use
`docs/backlog/implementation/README.md` for implementation order and acceptance.
Product DevNet now has explicit pilot acceptance alongside standalone web;
capability adaptation remains mandatory. Responsive discovery is followed by
optional 3D rendering, measured musical activity, and opt-in coarse-area
discovery, promoted to the next product expansion on 2026-10-14. W19 adds separate
approximate host/listener km radii after schema/privacy review; existing v1
protocol remains inert until implementation. Stablecoins are deferred; Product
compatibility, runtime feature inventory and key portability follow the dated
`docs/backlog/polkadot-alignment-and-nearby-priority.md` decision. These are planned increments, not claims about delivered capability.
Earlier limitations below are historical snapshots: reconcile them with current
code and live evidence before implementing, especially personhood and Product.

### Music / Listen

Catalog browsing, track cards, artwork, description, access badges, player, room-hosting controls, and real open-room discovery.

### Rooms

Room discovery, manual room-code entry, WebRTC join flow, Socket.IO signaling.

Room playback is host-access based: the host may receive a temporary content key after access verification; room guests receive only WebRTC media and should not need wallet/signature friction.

### Artist portal

Wallet-gated onboarding, runtime creation, upload, encryption, IPFS publication, metadata, primary artist share plus additional rights-holder royalty splits, access mode configuration, on-chain registration.

## Current important limitations

- Browser-side protection is demo-grade and should stay local/demo only.
- Production key delivery uses the backend-held `CONTENT_KEY_MASTER_SECRET`;
  `VITE_CONTENT_SECRET` is not a production key boundary.
- Pinata uploads from the browser are unsafe for public production; use the
  backend API when `VITE_DOTIFY_API_URL` is configured.
- Access model v2 retired the separate preview asset path. Denied listeners and
  unauthorized room hosts receive an unlock/personhood CTA and no audio.
- Proof of Personhood is currently mocked/dev-operated.
- Public rooms require hosted signaling.
- Room guests do not receive keys/source files, but WebRTC audio heard by guests can still be recorded outside Dotify.
- `App.tsx` is now a thin shell switch; the remaining frontend risk is targeted
  provider/view profiling rather than wholesale extraction.
- Frontend/e2e coverage exists for the core Classic unlock, artist publish, and
  room join trust flows; broader wallet-provider/device coverage remains open.
- Legacy registry paths should be archived or removed.
- Frontend contract ABIs are generated from Hardhat artifacts; generation must
  stay checked so drift does not return.
- The October 28 [0.1.63 rollout](../backlog/implementation/evidence/product-0.1.63-rollout-2026-10-28.md)
  activates two warm API edges, verified-TLS PostgreSQL with bounded independent
  sessions, and one private custody writer. Keep the shared namespace and
  permanent encryption reservations on rollback; pre-W36 local-state images
  are not compatible rollback targets. Physical/pilot acceptance remains open.
- Production catalog browsing is one backend request when
  `VITE_DOTIFY_API_URL` is set. Local mode uses single-writer
  JSON; the deployed W36 generation uses the migrated PostgreSQL shared store. W37 separates catalog content
  from compact progress, bounds RPC reads/replay ranges, and reuses lookup
  indexes; see [ADR 0036](../adr/0036-bounded-catalog-indexing.md). The dated rollout above records the activated deployment; synthetic scale
  tests do not measure real provider capacity.
- Product SDK / Playground / Humanity integration is a progressive enhancement
  track. The current verified Product SDK snapshot is prototype/reference/
  unaudited, Host APIs require a compatible container, contracts target
  `pallet-revive` / PolkaVM CDM flows, Product sr25519 key/session signatures
  are wired for Product frontend protected playback after explicit host-account
  connection, and Statement Store is constrained to small signed ephemeral data.

## Production spine

Production readiness means the following must work reliably:

1. Artist connects a real wallet.
2. Artist creates or resolves their SmartRuntime.
3. Artist uploads protected audio through a backend boundary.
4. Artist registers a track on-chain.
5. Listener sees track in catalog.
6. Unauthorized individual listener receives no audio and an unlock/personhood CTA.
7. Classic listener pays and unlocks individual full playback.
8. Backend releases a temporary content key only after wallet signature and access check.
9. Host creates room from playable track.
10. Room guest joins through a simple link without wallet/signature.
11. Protected room playback checks host access only.
12. Room guests never receive content keys or source files.
13. Free tracks play without wallet/signature after the backend verifies the on-chain Free mode.
14. Critical flows are covered by tests.
15. Product-host features fail explicitly when the Host or permission is
    unavailable; they do not silently fall back to demo secrets or bypass access.

## Backend direction

Introduce a lean backend service for:

- Pinata uploads;
- content-key custody and delivery;
- wallet signature verification, including EIP-191 and Product sr25519
  request schemes;
- nonce/replay protection;
- access checks against SmartRuntime;
- room host key requests;
- denial responses without keys for unauthorized hosts;
- Free-track unauthenticated key delivery after on-chain zero-address verification;
- health and version endpoints;
- cacheable catalog list/detail endpoints with block-lag metadata;
- confirmed SmartRuntime event indexing and deterministic reconciliation;
- future WebAuthn backend support.

The backend should be boring, typed, and auditable.

Recommended baseline:

- Node.js 22;
- TypeScript;
- Fastify or similarly lean framework;
- viem for EVM reads;
- Zod/Valibot for validation;
- structured logs;
- strict env validation.

## Audio protection direction

Do not claim full DRM.

The target is distribution access protection:

```txt
wallet signature -> backend verifies signature -> backend checks runtime access -> backend releases key -> browser decrypts local audio
```

For room playback, the key is released to the host only. Room guests receive only the ephemeral WebRTC stream.

This prevents bundled frontend secrets and direct full-track source access by unauthorized listeners. It does not prevent recording after authorized playback or after receiving a WebRTC stream.

Document this honestly.

## Room direction

Rooms must become production-stable:

- hosted signaling;
- join links;
- room TTL;
- heartbeat;
- cleanup;
- clear states;
- explicit unsupported-browser behavior;
- simple user language;
- no wallet requirement for room guests;
- host-based access metadata;
- no protected stream plus host CTA when host lacks protected-track access.

Room UX should be benchmarked against Spotify Jam and Jukebox Duo for low friction.

## Contracts direction

The active direction is artist-owned SmartRuntime, not the legacy monolithic registry path.

Maintain and test:

- runtime creation;
- one runtime per artist;
- track registration;
- deactivation;
- Classic payment;
- royalty settlement with claimable fallback for failed recipients;
- personhood-gated access;
- NFT transfer gating;
- isolation between artist runtimes;
- safe upgrade/facet mechanics.

Generate frontend ABIs from Hardhat artifacts.

## Frontend direction

Refactor toward feature modules:

```txt
web/src/app/
web/src/features/catalog/
web/src/features/player/
web/src/features/rooms/
web/src/features/artist-studio/
web/src/features/wallet/
web/src/features/access/
web/src/features/runtime/
web/src/features/uploads/
web/src/shared/
```

Keep chain calls out of presentational components.

Keep user-facing blockchain complexity low.

## Testing direction

Add deterministic tests for:

- Classic unlock;
- artist publish;
- room join;
- room guest no-wallet join;
- authorized host full protected stream;
- unauthorized host no-stream fallback;
- listener never receives room content keys;
- access-state logic;
- locked/full playback state;
- signature verification;
- key request failure modes;
- upload failure modes;
- chain/RPC unavailable states.

Contracts already have meaningful tests; frontend and e2e must catch up.

## Security principles

- No unrestricted Pinata JWT in frontend.
- No production key material in frontend bundle.
- No dev fallback signer in public flows.
- Access checks must fail closed.
- Backend must not trust frontend-provided access results.
- Wallet signatures must include nonce, chain ID, content hash, requester
  address, request purpose, and expiration; Product signatures must also bind
  the Product account public key to the derived H160 requester.
- Replay protection is mandatory for key requests.
- Room listeners must never receive content keys or encrypted source files.
- Logs must never expose secrets, keys, or raw uploaded contents.

## Deployment principle

A public testnet MVP should be reproducible.

A fresh contributor should understand:

- how to run web;
- how to run signaling;
- how to run backend;
- how to compile/test contracts;
- which environment variables are needed;
- which flows are local demo only;
- which flows are production-ready.

Product-mode deployment is a separate readiness track. Playground/Bulletin/DotNS
can make publication easier, but they do not replace backend upload validation,
content-key custody, or room guest/source-key separation.

## Technical mantra

Keep the roots deep, but the fruit easy to reach.

## Prepared Bulletin recovery, 2026-11-02

[Maintenance-only recovery](../operations/bulletin-prepared-job-recovery.md)
authenticates existing output and binds an operator continuation to an inspected
plan. Three preparation attempts, storage caps, account cursors and nonce history
are preserved. There is no new artist action or public route. This implementation
is not live recovery; artist approval and protected Web/physical Host acceptance
remain open, followed by retention/restore work.

## Synthetic pilot recovery completed, 2026-11-02 21:49 UTC

The [approved API-only intervention](../backlog/implementation/evidence/bulletin-prepared-recovery-rollout-2026-11-02.md)
made the original job ready through 16 verified stores / 712,737 bytes. Attempts
remain three; custody and public readiness are restored. Product/Web stay 0.1.69.
The subsequent artist-name rejection is addressed by merged #381/#382, awaiting
client rollout and separately authorized metadata repair. Then the artist can
resume the preserved draft and approve registration.
Protected physical/Web acceptance, conservation/renewal and off-volume restore
remain gates; no broader artist allowance or automatic renewal is enabled.

## Prepared-release recovery rollout, 2026-11-04

[API/custody, Web and Product 0.1.71](../backlog/implementation/evidence/product-0.1.71-rollout-2026-11-04.md)
serve exact source `e2dd6148`. Product finalized 12 stores / 3,556,058 bytes,
reused eight blocks and made two DotNS signing requests. Independent exact
CAR/record/gateway readback passes; the local signer is removed. The original audio remains ready at three attempts,
all original inventory hashes and the name-only repair permit are unchanged.
Explicit recovery previews/restores the admitted title, note, cover and 1.21 PAS
price, then requires an ordinary Publish and wallet action. No new admission,
metadata write or registry transaction occurred during the service/Web rollout.
Custody had stopped after losing its database lease before deployment; same-image
restart restored inspection. Investigate supervised recovery separately while
preserving fail-closed shared-writer ownership. Conservation of reused app blocks
(expiry 1,532,185), protected acceptance and off-volume restore remain open.

## Fresh Bulletin publication trial active, 2026-11-04

[New empty publisher/queue paths](../backlog/implementation/evidence/bulletin-fresh-pilot-activation-2026-11-04.md)
replace the abandoned repair draft as the active target. Same source/image and
installed signer; Product/Web remain 0.1.71. Owner-approved cap: audio 16/1 MiB,
cover 16/512 KiB, metadata 4/64 KiB. Four permanent encryption reservations are
copied and verified, account floor is 1120, and 14 old small state files remain
byte-identical. No musical or registry/DotNS write occurs during maintenance.
The artist starts a normal New release. General draft editing/multi-release
admission, protected acceptance, conservation and off-volume restore remain gaps.
