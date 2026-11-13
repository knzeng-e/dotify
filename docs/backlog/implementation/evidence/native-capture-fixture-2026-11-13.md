# Native capture fixture correction — 2026-11-13

**Test-only candidate; not a player fix or physical-device acceptance.** Refs
#395. The [Pause correction](explicit-pause-authority-2026-11-13.md) is now in
dev `5ec237bf`. This follow-up makes its local output-energy check representative
of the encoder and removes a race in test setup. No playback, permission,
dependency, service, payment or deployment behavior changes.

## Finding and correction

The Room mock used a 60-second, 8-bit mono WAV at 8 kHz. A standalone loopback
control, without Dotify or the SDK, measures no MediaElement-to-WebAudio signal
for that source in this Darwin arm64 Playwright 1.61.1 WebKit runner, despite
advancing media/context clocks. The same signal at 48 kHz measures the expected
440/660-Hz tones before and after replacement; Chromium measures both rates.
The [filtered control facts](native-capture-fixture-control-2026-11-13.json)
bind the environment, input hashes and last sample of each observation window.
They contain synthetic inputs only, no account, real music or key.

This is not a claim that 8-kHz audio is universally unsupported. The
[Web Audio specification](https://www.w3.org/TR/webaudio/#MediaElementAudioSourceNode)
requires resampling when source/context rates differ; these results identify a
local interoperability limitation, not its engine-level cause or the owner's
phone defect. The production [AAC encoder](../../../../services/api/src/services/streamingTranscoder.ts)
already sets its output to 48 kHz. The test still uses PCM rather than pretending
to cover that encoder or authenticated AAC decoding.

`roomJoinMock.ts` now uses 48 kHz only for the explicit native-capture E2E
scenario. Duration, amplitudes, channels and tone identities stay the same.
Ordinary fixtures retain two-second 8-kHz silence; synchronized non-capture
fixtures retain their smaller 8-kHz tone. The E2E environment flag remains
required: query parameters alone cannot enable the larger fixture. Two fixed
tones are memoized to avoid duplicate multi-megabyte data URLs, and base64
conversion uses bounded chunks instead of a multi-million-argument call.

The browser helper also awaits the expected autoplay Pause button before
clicking it. Its previous one-time `isVisible()` snapshot could see Play just
before asynchronous startup and then wait forever for playback to be paused.
The failing attachment showed playback and nonzero energy, with no Pause click
having occurred. Waiting for the expected action fixes this setup race without
adding sleeps, skips, retries or weaker output assertions.

## Validation and source identity

The sample-rate implementation is `d20806128bdf304eeed3e9aa3953abb96595c4ca`;
the setup correction is `ab86ee5542081be90875c05d1b4b5b756d2aa737`, including
the owner's merged #459. Application source is unchanged from that dev base.

- Before the correction, combined local preview `f2ed7708` reaches the suspended
  replacement assertion and fails: RMS 0, required greater than 0.01. Earlier
  setup failures before that assertion are excluded from output-defect proof.
- The first 48-kHz combined run has 43 passes and one autoplay setup race. Its
  successful WebKit output case passes all unchanged energy/frequency checks;
  the setup correction above addresses the independently observed race.
- Four new unit cases validate WAV headers, real signal energy/frequency,
  duration, ordinary fixtures and the production-disabled guard. All **1,178
  frontend unit tests / 153 files** pass on the fixture branch.
- Typecheck, focused formatting/ESLint, full lint and Web/frozen Product builds
  pass. Two existing App hook warnings and existing bundle advisories remain.
- Complete mobile-host suite on `ab86ee55`: **44/44 pass**, two consecutive
  runs of all 22 Chromium/WebKit cases, with one worker. This includes output
  energy/frequency after suspension and replacement, residual silence, native/UI
  Pause, Room handoff and Room → solo. No retry, skip or timeout change.
- Local compatibility preview `f70955795d652f3a41913440e7a167696ee11246`
  (tree `895d834c8a6a1b5f5c71d0b07d104961077ff0d4`) combines the reviewed
  Pause source, #461 artwork implementation and #460 offline research with this
  correction: the same **44/44** repeated mobile-host cases and four fixture
  unit cases pass. No app source changed after the earlier combined unit,
  artwork and authenticated-AAC checks described in #461. This local-only
  preview is not merged-dev CI, deployment or physical acceptance.

Source SHA-256:

| File | SHA-256 |
| --- | --- |
| `web/src/e2e/roomJoinMock.ts` | `8f4d58b835fa42c29759e39c22c81bc4446d199f1e03244681a92d0ed0681088` |
| `web/src/e2e/roomJoinMock.test.ts` | `18dd300e1e40d578f1e27fc1732d5bc9d186d7d2866255db9cbf7668313d41cb` |
| `web/e2e/mobile-host-playback.spec.ts` | `9dbffbbbb360003bda06d95be2ad7348969c009b515a355e08981e1966a263f4` |

## Remaining acceptance

This narrows the earlier local zero-RMS concern; it does not prove audible
physical iPhone output, native locked-screen commands or guest delivery. After
owner review and a separately reviewed matching client publication, retain the
actual solo/Room Pause, unlock, explicit Play, source replacement, access teardown
and audible host/guest checks. The owner's later healthy cover/sound report
remains a control, not a diagnosis of the missing-cover attempt. Keep #395/#388
open and real independent recovery deferred.
