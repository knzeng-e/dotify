# Optional artwork storage — 2026-11-13

Source: `bd0a051424a1f0381733f8f8075f9cf9f58d0971`, based on tested dev
`c6e6fea8f237ba754bf388f0ba1022f064dc895b`. This is an offline #388 candidate;
no client or service has been delivered. The later dev #445 measurement merge
is independent; this branch starts from the last fully green dev checkpoint.

The [cache reference](../../../reference/public-artwork-cache.md) owns behavior,
limits and failure semantics. This record describes observations, not an iPhone
root-cause claim or native rendering acceptance.

## Demonstrated failure

Before the correction, a controlled Cache Storage `put` that never settles
withholds a fully downloaded public image: the regression times out after the
normal five-second unit-test budget. The old code awaits persistence before
remembering or returning its object URL. Opening/matching/reading Cache Storage
also had no deadline. These are code-level failure paths, not measured causes of
the owner's intermittent lock-screen delay.

The correction publishes the memory result first, bounds optional disk lookup
and has one background writer without a queue. It preserves the existing
public-only keying, MIME/byte/cache/network bounds and metadata owner cancellation.
The tradeoff is explicit: another cover can skip persistence while storage is
occupied; a stalled writer can disable further disk persistence until reload.

## Local validation

- All **1,149 unit tests / 148 files** pass on Node 22.13.1. Six new cache cases
  cover stalled writes with bounded writers, stalled opening and ignored late
  completion, stalled body/cancellation, healthy disk hits, quota rejection and
  Host storage-access denial. The targeted cache/system-artwork group passes
  sixteen cases on the final source.
- Chromium and WebKit each pass all six listening-controls scenarios: generated
  PNGs, mobile account/disconnect, late image completion after disconnect, stalled
  persistence and Room metadata attribution. The stalled-write case requires a
  decoded PNG and an attached prepared audio source while `put` remains pending.
  The Classic fixture has no audible audio payload; this is metadata/source
  readiness evidence, not audible or physical-device acceptance.
- The disconnect test now awaits the shared immutable image's delivery rather
  than an optional disk entry. It still requires cleared metadata/actions and
  removed audio sources after the delayed response.
- Web and frozen Product builds pass; formatting, targeted lint and diff checks
  pass. Full lint retains two existing App hook warnings; existing large-chunk
  build warnings remain visible. No threshold, assertion or timeout is relaxed.

Exact PR-head CI and integration with current dev remain before review readiness.

## Remaining acceptance

This source changes the public-image cache, not native Media Session layout,
artwork composition identity, audio access or playback control. Prepared-PNG reuse,
rapid selection changes, matched image/composition/metadata timing and repeated
solo/Room locks on the actual Host/iOS remain #388 work. Keep its physical gate
open even if browser CI passes. The source adds no setting, storage schema,
key, publication allowance, deployment or network write.
