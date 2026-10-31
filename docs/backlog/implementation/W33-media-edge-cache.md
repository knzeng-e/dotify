# W33 - Serve encrypted media through a read-through edge cache

## Current reconciliation, 2026-10-23

#325 is merged. Edge-first authenticated ciphertext delivery and bounded
pre-warming are implemented, with API/IPFS fallback and unset-by-default public
origins. #288 stays open: the dedicated gateway returned 401 in three authorized
regional probes. Correct access, verify exact ciphertext/CORS/cache behavior,
then activate and measure paired audible startup. Do not interpret HTTP probe
timings as first sound or reactivate DAV2 range readers. See [W33](evidence/W33.md).

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Bulletin continuity research, 2026-10-30

The owner-reported [eight-second mobile evidence](evidence/bulletin-mobile-publication-2026-10-30.md)
now has a [64-second generated-only follow-up preparation](evidence/bulletin-mobile-continuity-2026-10-30.md).
Local controls prove continued segment reads beyond the initial buffer, report
recovery and explicit larger-profile limits. No new storage, renewal, Product
update or provider switch has occurred. Native long listening, cold audible
startup, real network/background recovery and production retention remain open.
The next network run requires an exact reviewed allowance/distribution budget. The subsequent
[owner-approved publication](evidence/bulletin-continuity-publication-2026-10-31.md)
is now complete: 74 new stores, verified records/data and signer removal.
The native mobile Wi-Fi run and paired 64-second embedded control both
complete with audio heard, but both have an owner-reported cut near 46 seconds.
First `playing` is 1,388 ms native and 94 ms embedded, not measured audible
startup or a cold-cache comparison. Neither reports post-start waiting/stalled;
continuity is not accepted. Native delivery is not necessary to reproduce the
cut. The next controlled experiment instruments final append/end-of-stream
in the shared managed reader before varying its timing. Other physical and
production gates remain open; no production storage switch occurred.

The [lab 0.3.0 comparison](evidence/bulletin-finalization-control-2026-10-31.md)
is now [published independently](evidence/bulletin-finalization-publication-2026-10-31.md)
with four new Product stores / 392,466 bytes, retained audio reuse, exact artifact
and record readback, and signer removal. The generated-only wrapper and bounded
notebook change no ordinary caller behavior or production record. The physical
iPhone [paired controls both record two human cut markers](evidence/bulletin-finalization-mobile-2026-10-31.md)
despite delayed finalization; the redundant-append bookkeeping correction is
recorded below, followed by scoped corrected-build physical audible acceptance.
General production acceptance remains open. Keep 91
renewal transactions reserved and recheck retained dependencies before delayed
tests; no renewal was submitted or scheduled.

## Managed-reader append completion follow-up, 2026-10-31

The [paired physical iPhone controls](https://github.com/knzeng-e/dotify/pull/362)
keep two marked cuts even when the successful finish call is delayed. The
[scoped correction](evidence/managed-audio-append-commit-2026-10-31.md) prevents a
completed native append from being forgotten when managed demand stops during
its update. Cancelled downloads, actual evictions and owner cancellation keep
their existing boundaries. The [owner-approved lab 0.3.1 publication](evidence/bulletin-append-publication-2026-10-31.md)
is complete from clean tested dev `1e286e5c`: four stores / 392,466 bytes, retained
audio reuse, independent byte/record readback and signer removal. Keep 91 renewal
transactions reserved; none was submitted or scheduled. The [corrected iPhone
listens](evidence/bulletin-append-mobile-2026-10-31.md) each append 16 segments once:
the owner confirms uninterrupted embedded control, native Wi-Fi and native
playback during a reported Wi-Fi-to-5G switch. Unknown Host cache and substantial
buffering prevent a cold-start or uncached recovery claim. Protected artist
access, background interruption and recurring retention remain open; no
production storage switch is claimed.

## Agent assignment

Implement **W33** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record.

- Branch: `feat/media-edge-cache` created from the latest tested `origin/dev`.
- Dependencies: W30. Refs #88 (this sequence makes the backend read-through decision).
- Release stage: Next (streaming experience track).
- Product purpose: listeners on several continents get the same fast start; a single public gateway is not on the critical path.

## Problem at audit

- DAV2 range reads go only to Pinata gateways, including the shared public gateway (`web/src/services/pinata.ts:142`).
- Range timeouts and full-file fallbacks were observed live (W19 recovery evidence, 2026-10-15).

## Outcome

The 2026-10-17 owner-feedback stabilization adds a bounded API ciphertext
read-through as an interim recovery path. See
[W08/W19 evidence](evidence/W08-W19-stability-2026-10-17.md). It does not complete
this sequence's provider decision, multi-region edge, pre-warming or latency
acceptance. Retain the remaining scope below.

1. **Decision record.** Compare at least two options (for example Cloudflare or Bunny in front of a dedicated gateway, versus a dedicated Pinata gateway alone) on latency from three regions, cost, range support, cache control, and operational burden. Choose one.
2. **Read-through cache.** Media objects are content-addressed and encrypted, so the edge caches `/ipfs/<cid>/...` as immutable. The cache never sees keys or plaintext and cannot serve different bytes for a CID without failing authentication in the client.
3. **Pre-warming.** After publication, the API requests the first segments (or first DAV2 chunks) through the edge.
4. **Client order.** Edge first, then the existing Pinata and IPFS fallbacks. IPFS stays the source of truth.
5. **Honest documentation.** Public docs say the edge is a cache that accelerates delivery and has no authority over access.

## 2026-10-22 execution note

The internal reset retired DAV2. This sequence now applies only to authenticated
v3 manifest/init/segment objects; no legacy range reader is restored. The API
read-through remains the fallback. The owner supplied an existing dedicated
Pinata gateway/CDN, selected by [ADR 0034](../../adr/0034-media-cdn-and-native-storage.md)
without creating another provider account. Prepared code and remaining
provider/three-region audible acceptance are recorded in [W33 evidence](evidence/W33.md).
Six authorized regional HTTP probes return API 200 and gateway 401. This is an
activation blocker, not a successful latency improvement or completed #288.

## Acceptance and meaningful verification

- Latency evidence (time to first byte and time to first sound) from at least three regions, before and after.
- Range requests, 404 handling, and fallback covered by gateway tests.
- No credential or token in cached URLs; cache keys exclude query strings carrying identity.
- Update `docs/operations/deployment-configuration.md` with configuration, cost limits, purge procedure, and rollback.

## Scope boundary

No change to encryption, access checks, or the streaming format. No account creation or spending without explicit owner authorization.

## Handoff

Write `docs/backlog/implementation/evidence/W33.md` using `evidence-template.md`.
