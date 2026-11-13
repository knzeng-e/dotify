# Development toolchain verification — 2026-11-12

Implementation: `1084bdc149ea4ff25fae0d4793736bff989b6570`, based on tested dev
`c6e6fea8f237ba754bf388f0ba1022f064dc895b`.
This is local candidate evidence on macOS, Node 22.13.1. No runtime service,
wallet, music, key, admission or deployment was changed.

## Results

- All 1,143 unit assertions in 148 files pass with Vitest 5.1.0. Initial migration
  failures identified non-constructable arrow mocks and overly narrow helper
  types; only those test doubles/types changed, without deleting assertions.
- Web and frozen Product builds pass. Existing large-chunk warnings remain;
  successful compilation does not prove mobile performance or listening.
- Lint passes with the two existing App hook-dependency warnings. No rule was
  disabled or warning suppressed by this change.
- All 27 offline deployment/environment/identity guard tests pass, including
  the existing async/sync PAPI dependency probe and the new actual parser
  allowlist/type-information probe. PAPI CLI help starts without a chain call.
- Full Web `npm audit` (including development dependencies) reports zero known
  advisories at this date, compared with ten findings before the change.
  This is scoped to the Web lockfile, not all repository packages or future
  advisories. API Zod remains the separate #432 candidate.
- Production SDK, Host, signer and TrUAPI versions are unchanged. Shared build
  leaves sourcemap-codec/tinyglobby also advance through Vitest's required graph.
  ESLint's ordinary minimatch v3 remains separate from the parser's v11 override.
- Offline backlog and diff checks pass.

## Remaining gates

Exact-head CI, including minimum Node 22.12.0 Web checks and maintained Node22
Product/browser coverage, remains before review readiness. The change adds no
new public capability and does not require a service rollout. It makes no claim
that phone audio/locked-screen acceptance or independent backup recovery is done.

See [the dependency boundaries](../../../reference/development-toolchain.md)
and [#433 scope](../../tooling-security-migration.md).

## Nearby browser follow-up — 2026-11-13

On candidate `5409fbc96dd23e19212af8aa97fb5aac6288b1d1`, CI passes the Node
22.12 Web gate, 331 core browser cases and the three-engine audio gate, but the
Nearby case measures zero guest output after successful signaling. The original
case also passes three unchanged local repetitions, so the first failure's
root cause is not established. Its retained trace remains evidence; this is not
a claimed production-audio correction.

Test source `bcc836d1a6b9913d3c8896843dc94ed0805f0997` replaces the negotiation-only
near-silent oscillator in this one acceptance case with the ordinary Web Audio
capture path and the existing synthetic protected audio. It waits for the current
live, unmuted, enabled receiver, checks that the measurement context is running,
and requires decoded RMS above 0.01 with the same ten-second energy deadline.
It retains real signaling/WebRTC and the guest's zero-key-request assertion.
On energy failure, bounded fixture/audio-state details accompany the trace.
No production module, access check, automatic retry or timeout is changed.

Three local repetitions pass, followed by all nine Web Nearby cases and all
three Product Nearby cases. Targeted ESLint, formatting and diff checks pass.
The new full CI remains the review gate. A successful synthetic browser run does
not establish physical Host, locked-screen or real recovery acceptance.
