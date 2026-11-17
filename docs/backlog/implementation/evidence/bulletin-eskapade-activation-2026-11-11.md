# Exact post-optimization trial activated — 2026-11-11

Refs #407. The owner-selected “Eskapade à engong” trial is admitted after the
[matched #426 custody delivery](bulletin-round-trips-rollout-2026-11-10.md).
[Machine-readable activation](bulletin-eskapade-activation-2026-11-11.json).
The activation checkpoint below precedes the later successful publication and
listening acceptance. The final section records the owner result and captured
publisher clocks; acceptable publication latency remains open.

## Authority, source and budget

The owner separately approves the exact selected MP3 and cover, the new bounded
musical allowance, provider snapshot, custody maintenance and private state/timing
inspection. Artist registration remains an explicit wallet action after the
owner triggers Publish in the app. Previous operational approvals are not reused.
The maintenance guard is consumed; it cannot repeat apply or another intervention.

The immutable profile's existing part caps reserve one whole release: audio
320 attempts / 67,108,864 bytes, cover 32 / 8,388,608, metadata 4 / 65,536.
**New maximum: 356 attempts / 75,563,008 bytes**, not a target spend. Failed and
uncertain attempts count. The exact new identity receives the existing bounded
window of at most 16 direct transactions / 4 MiB per finalized wave. No previous
claim, allowance, key, inventory, receipt or permanent nonce is reset or retuned.

All prior conservative reserves remain: 1,895 transactions / 471,714,071 bytes.
With the new reservation: 2,251 / 547,277,079. Fresh public quota observations
cover at least 2,607 available transactions, 622,840,087 store bytes and
547,277,079 renewal bytes before activation. Private inspection also verifies
that the actual retained inventories fit the reviewed prior floor. A quota
increase provides capacity, not authority for another release or renewal.

The selected source lasts about 114.8 seconds, compared with about 90.8 seconds
for the previous MP3. Offline sizing with a disposable key gives 108 audio
blocks / 11,401,205 bytes and eight cover blocks / 191,720 bytes. The same cover
may reuse still-retained CID data; this is not guaranteed to eliminate its proof
checks. The selected local schedule uses nine modeled waves; modeled waves are
not seconds. Local and production codecs may differ, and sizing ciphertext is
never used as publication input. No same-file speedup factor is claimed.

## Activation and preservation

Current tested dev `99b62a3baff6de70fb33f25c194e18cbd0158289` has successful
[CI 42926472731](https://github.com/knzeng-e/dotify/actions/runs/42926472731).
The already tested/deployed #426 image is reused unchanged:
`registry.fly.io/dotify-api@sha256:51714fcf022d38a45eae71ddd7a5c11f6557c1048bc8b37fd98cf99722e3009e`,
source `8d0706548416fe5e17711a5d480def7499776c1a`. No code is uploaded to a registry
or redeployed. Web/Product/public APIs stay 0.1.82; encoder, signaling, resources,
origins, mounts, profile and key configuration are unchanged.

Public finalized/latest checks verify the expected artist runtime and no existing
registration for the selected content hash. Fresh private inspection verifies
ready old work, no uncertain outcome and an unclaimed new identity. A request is
bound to that current admission checkpoint, not a stale earlier trial digest.
Custody stops, a single provider snapshot completes, and the same image starts
idle without the publisher. The compiled CLI inspects, then applies exactly once.
Readback proves that only admission and its new immutable prior-state archive
change; previous archives, claims, jobs, receipts and permanent nonce-tree hashes
are preserved. No initializer, slot refund, lock deletion or old-ledger restoration
is used. Request paths, source hashes and private checkpoint data remain local.

Normal custody resumes and `/health` plus `/health/ready` each pass twice.
Public finalized account observations at different heads have unchanged nonce
and quota/usage state: **zero maintenance Bulletin operations, renewals or DotNS
signatures**. Activation completes at 02:42 UTC on November 11. The provider
snapshot remains at Fly; it is not off-provider recovery evidence.

A separate offline test of the deployed compiled image uses synthetic state,
no network, no production volume or key. It verifies inspect/apply for the selected
scope, rejects replay, binds the write window only to the new identity and leaves
previous profile/queue/nonce/owner state unchanged. That supports the activation
boundary, not chain throughput or musical acceptance.

## Measurement and remaining gates

After activation, the owner is asked to start one new release using the reviewed
files, approve registration and report publication/listening plus approximate
Publish-to-wallet-prompt time. A separately authorized read-only capture is bounded
to this identity and two hours, retaining only validated timing counters, states
and hashes in the reviewed private folder. Raw logs/receipts/keys/audio are not
committed. Repeated observations are not separate attempts; concurrent phase
counters cannot be added into end-to-end wall time. The wallet-render timestamp
is not instrumented, so owner timing remains approximate and distinct.

At this activation checkpoint, publication, catalogue visibility, audible playback,
actual latency and hosted memory under new work remain unverified for this new
identity. Reusing a completed release cannot measure fresh preparation. Keep #407
Now/In Progress, then #395 Room startup, #388 artwork and CASH research. Conservation,
access and off-provider restore remain public-pilot gates.

If a later attempt is uncertain, retain its intentions and reconcile; do not
re-sign blindly. Recovery keeps all current state and window-compatible code,
or disables publishing. The owner-selected files and this record authorize no
additional identity, automatic renewal or further maintenance.

## Later publication, listening and timing acceptance

The owner confirms **publication OK / listening OK**, reporting **7 min 46 s**
between Publish and the wallet request. The exact UI wallet-render timestamp is
not instrumented. All three scoped publisher kinds report success; collection
finishes with zero read failures. The four distinct reports contain one audio,
two successful observations of the same cover job and one metadata report. The
cover recheck is not a second release; repeated collection copies are deduplicated.
No further Fly inspection or writing is needed to interpret these captured data.

| Captured publisher interval | Observed duration / work |
| --- | --- |
| Audio attempt | 435,455 ms (7 min 15.5 s); 108 store calls, peak 16; zero store failures |
| Initial cover attempt | 426,161 ms includes 421,783 ms waiting behind audio; 4,378 ms excluding that queue; no store calls |
| Cover recheck | 7,143 ms includes 2,769 ms queue; 4,374 ms excluding queue; no store calls |
| Metadata attempt | 87,384 ms (1 min 27.4 s); two sequential store calls; zero store failures |

There are **110 observed store calls** in these reports, not new operator writes
or a fresh on-chain inventory audit. The cover is reused. Store/finality timing
aggregates overlap with reads and sibling transactions; they must not be added
into end-to-end wall time or converted into elapsed-time percentages. The audio
report's 108 submit/finalize calls average about **32.04 s** each; first inclusion
averages about **6.10 s**. Metadata's two submit/finalize calls average **32.31 s**.
The evidence therefore keeps repeated finality stages as the main latency target,
with additional read/proof work still present. The selected local nine-wave
model is not a measured count of live waves.

The approximate interval anchored from the audio report's inferred start
(`observedAt - elapsedMs`) through the metadata report is **531,947 ms**, about
8 min 52 s. It covers publisher attempt clocks anchored to log observations,
not the same boundary as the owner's 7 min 46 s. Do not replace the owner's
report, invent a wallet timestamp or reconcile the difference as a UI defect
without instrumentation. Live byte counts and pending journal state are not
independently read again in this acceptance update; local sizing remains local.

The source is longer/larger than the prior MP3 and conditions differ. The owner
result is encouraging behavior evidence, not an isolated optimization speedup.
Successful publication and sound do not establish acceptable latency. Keep #407
Now/In Progress. Next investigate, offline, fewer storage blocks/dependency
stages and their format/resolver compatibility while preserving graph integrity,
canonical receipts, retention, nonce reconciliation and existing playback. The
unchanged public-asset format tail and repeated proof reads remain explicit.
No repeated funded trial, new admission or relaxed proof boundary is implied.
