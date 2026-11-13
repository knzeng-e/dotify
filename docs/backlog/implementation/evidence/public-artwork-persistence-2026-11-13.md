# Artwork delivery and prepared PNG reuse — 2026-11-13

Latest source: `d767c466cd030e08b1e2a8f91a09b44d0505abe2`; the optional-storage
correction starts at `bd0a051424a1f0381733f8f8075f9cf9f58d0971`. Based on tested dev
`c6e6fea8f237ba754bf388f0ba1022f064dc895b`. This is an offline #388 candidate;
no client or service has been delivered. The branch starts from the last fully
green dev checkpoint and subsequently integrates #445 from dev, as recorded below.

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

The storage-only PR head `6f8812f63fec4bab2a541e81d5abba3a06137eaa` passes
[quality CI](https://github.com/knzeng-e/dotify/actions/runs/43332982345), including
core browser and W35 checks. This result predates the PNG-reuse extension below.
Exact extended PR-head CI and integration with current dev remain before review
readiness.

## Prepared-PNG extension

Before this extension, a browser regression on the storage-only source observes
`preparedPng: false` on the first metadata registration after closing and
reopening the same cover. The system frame is decoded/composed again even when
the original public image is already available. This is a demonstrated repeated
work path, not a native iPhone timing measurement.

The extension retains successful public frames in a bounded page-memory LRU,
with immutable/inline/generated visual keys and a composition version. The hook
uses a ready PNG for the first registration while rebuilding title/artist from
the current track. Mutable or oversized identities skip retention. Failure and
cancellation never populate it. The reference above owns all exact limits.

Local validation on source `d767c466cd030e08b1e2a8f91a09b44d0505abe2`:

- **1,159 unit tests / 149 files** pass on Node 22.13.1. Ten new prepared-image
  cases cover immutable aliases and descriptor-copy isolation, generated visual
  identities, mutable references, failed-decode retry, cancellation including a
  cached result, LRU count/byte bounds and oversized/private identity refusal.
  The targeted three-file group passes **26 cases**, repeated on the committed
  source.
- All **seven listening-controls scenarios** pass in Chromium and WebKit. The
  added real-canvas case closes a Room into solo, closes/reopens the mini-player
  and requires the identical PNG in the first non-null metadata registration,
  with no additional frame encoding. A second track sharing the cover must also
  receive the prepared pixels immediately with its own title/artist.
- Web/frozen Product builds, full lint and scoped formatting pass. Existing App
  hook and large-chunk warnings remain. The browser probe records at most 64
  compact registration summaries, without retaining PNG history.

## Integration with dev

Merge source `b3d919005c28cb978e79447ecadd2a538c26ec3f` integrates dev
`17e6be04716e6289d9b4bee791950a9c1bbd0bc3` (#445 startup telemetry), without
conflict. All **1,163 unit tests / 150 files**, Web/frozen Product builds and full
lint pass. All seven listening-controls cases pass again in Chromium and WebKit;
the WebKit group also passes its additional host-output autoplay case (eight
total). Existing warnings remain. Local link/anchor checks pass for 72
reference targets across the four updated documents; offline backlog validation
and live Project 5 drift checks pass. Exact extended PR-head CI remains pending.

The earlier 1,159-test observation belongs to the prepared-image source before
that integration; neither result is a native artwork-display measurement.

## Remaining acceptance

This source changes optional public-image storage and prepared system-PNG reuse,
without changing native Media Session layout, badge pixels, audio access or
playback control. Rapid selection changes, matched image/composition/metadata
timing and repeated
solo/Room locks on the actual Host/iOS remain #388 work. Keep its physical gate
open even if browser CI passes. The source adds no setting, storage schema,
key, publication allowance, deployment or network write.

## Security-update integration

Merge `87ffbdff4826439d768cc471a9b433f01146d466` integrates dev
`53df0b850160583789000c5ec7843c31d3edbde7`, including the reviewed API schema
and development-toolchain fixes #446/#447. The only conflict is adjacent links
in the documentation index; both the public-artwork and API-schema references
are retained. Artwork implementation and its browser scenarios are unchanged.

With freshly installed locked dependencies and Node 22.23.5, all **1,163 unit
tests / 150 files**, Web/frozen Product builds and lint pass. All seven
listening-controls cases pass in Chromium and WebKit; the WebKit group also
passes the additional host-output autoplay case (eight total). The two existing
App hook warnings and large-chunk warnings remain. Offline backlog validation,
both conflicted reference targets and whitespace checks pass. Exact updated-head
CI remains a separate check; this integration changes no deployed state or
physical-device acceptance.
