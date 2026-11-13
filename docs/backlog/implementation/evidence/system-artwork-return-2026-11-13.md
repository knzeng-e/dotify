# Bounded artwork recovery on return — 2026-11-13

Base: tested merged dev `0bb52754b14bc366690ac85d1d7ad1dc089d8d28`.
Implementation validated at `412c91122b19924f81717f763e4e32009b413702`; the following evidence-only
commit changes no application or test source.
Branch: `fix/system-artwork-return`. Refs #388. Implemented candidate, not a client
or service delivery; current deployed Product remains 0.1.83. This branch does
not include the independent Pause correction in #459 or payment research #460.

## Demonstrated failure and correction

A synthetic browser fixture fails the first `Image` decode of an already delivered
public cover. On unchanged dev, system metadata remains on its URL fallback after
hidden → visible events; the regression times out at its existing six-second PNG
assertion. On the corrected source, the same test publishes a prepared PNG after
one additional decode, remains paused and starts no further decoding after more
foreground returns. The browser test file is byte-identical between those runs:
SHA-256 `7e57d3ca13b49d1886bd3ae69f42f2cc6b84a1a7b4b5e7fbacfb8224c3600861`.
Baseline hook SHA-256:
`a2d2e20b62a4e87a4cce617a2e78d392bb98044b4d6127f63729dfa906cc2e0e`.

The hook delegates its existing metadata lifecycle to a small imperative
publisher. One visibility listener remembers a foreground return while preparation
is pending and starts at most one recovery when unresolved work settles. It skips
successful PNGs, retains current title/artist and leaves Play/Pause and the audio
path untouched. Cancellation and metadata identity guard every late assignment;
cleanup cannot clear another owner's replacement. No new timer, polling,
persistence, transport owner or network credential is introduced. Public-image
cache limits remain in force.

[The cache reference](../../../reference/public-artwork-cache.md#recovery-on-foreground-return)
owns behavior and limits; [the observation reference](../../../reference/system-artwork-observations.md)
owns the added identifier-free `retry-requested` phase. Neither metadata assignment
nor a running progress bar acknowledges native display or audible output.

## Validation

- Eight new unit cases cover fallback repair without transport changes, prepared
  PNG reuse, pending success versus fallback, one failed recovery, cancellation,
  replacement ownership and rejected PNG assignment. The focused artwork group
  passes **27 tests**.
- The complete Chromium artwork suite and WebKit artwork/host-autoplay suite are
  pass **9 and 10 cases** respectively. These fixtures exercise browser canvas and metadata registration,
  not a physical iPhone lock. The Classic unlock fixture has no audible payload.
- All **1,182 frontend unit tests / 153 files** pass on verified Node 22.23.5.
  Full lint has no errors, retaining the two existing App hook warnings.
  Web/frozen Product builds and scoped formatting/link/backlog checks are verified
  before review. Existing chunk-size and dependency-annotation advisories remain.

Application SHA-256 identities:

- `web/src/features/player/systemArtworkPublication.ts`: `533ad74de381b1a81e250f44ae23ac4e9b980fd8b0de9555bd9b36fa072cf0c4`.
- `web/src/features/player/useSystemMediaSession.ts`: `a7ee3f8abfd449cdadf638b35bb8e6827337d0234f90051a72da97341834919c`.
- `web/src/features/player/systemArtworkObservation.ts`: `dddd84c02f9b344302671ece18d5a61557e344fd11dfd56ce26d898cb19309d1`.

## Device boundary and next step

The owner's missing-cover observation follows a requested signature and immediate
phone lock. Timings from that failed attempt were lost on reload. The next uploaded
report is explicitly confirmed to have cover and sound; it is a healthy control,
not evidence for the failure's cause. This controlled decode failure must not be
attributed to that iPhone without matching evidence. Historical WebKit bugs likewise
do not prove the installed Host's behavior.

After review/merge and a separately reviewed matching client publication, verify
solo and Room immediate locks, explicit native Pause through unlock, repeated
returns, rapid selections, disconnect and actual host/guest sound. Capture a failed
attempt before retry/reload. #388 stays open; recovery on return does not guarantee
that a hidden OS renders artwork before unlock, and a successfully registered but
undisplayed PNG is outside this correction's observable boundary. Real independent
recovery remains deferred as requested. No musical write, SDK change, payment or
service maintenance is performed.

## Local integration preview with pending Pause and CASH branches

On 13 November, a private local-only merge combines #459
`a12d1b48e656d68c7ad54c6e5abb98a40a369795`, this branch's documentation-only
follow-up `49d457b5`, and #460's documentation-only follow-up `126a4e52`.
Preview commit `f2ed7708c3858b01db78a5f9726c789b23a490e1` is **local only**, not a
GitHub/dev merge or release. Its tree is
`d18faf0f9e2180c4f6921605092ca83573a62955`.

The initial combination exposes four documentation conflicts, without an
application-code conflict. Removing duplicate candidate summaries from the shared
manifest/execution index and moving independent ticket/public-page checkpoints
makes the three branches merge automatically. The ticket, reference and dated
evidence remain the authoritative homes. No application/test source changes in
these conflict-avoidance follow-ups. The three Pause files match #459 byte for
byte; the metadata files match this branch's validated implementation.

With the same locked dependencies and verified Node 22.23.5, the preview passes:

- **1,182 unit tests / 153 files**, plus **14 offline CASH research tests**;
- Web and frozen Product builds and TypeScript checking;
- **9 Chromium and 10 WebKit artwork/host-autoplay cases**;
- **10 focused mobile-host Pause cases** across Chromium/WebKit: native/UI Pause,
  same-track Room handoff, unsolicited foreground Play and explicit another-track Play;
- the complete authenticated AAC suite: **103 pass, one designed skip**;
- offline backlog, 375 local documentation links/anchors and whitespace checks.

The first AAC invocation stops before collecting tests because this isolated
worktree has no generated fixture. It is not an application failure or a passing
run. The canonical CI generator then creates the synthetic 24.2-second tone and
encrypted renditions; the full resumed suite produces the result above. No real
music or content key is read. The fixture generator source SHA-256 is
`f1045a688876c5903cb857fd824db13f193b059e35cd977f3ef13c2c49138831`.

This is pre-merge compatibility evidence, not CI or device acceptance of future
merged dev. The complete mobile-host suite is not rerun: the existing WebKit
zero-output-RMS concern documented in #459 remains unresolved. No assertion,
threshold or native capability skip is weakened. Matching actual merged-source
CI/delivery, iPhone locks/native controls and audible host/guest acceptance remain.
