# Mobile Host audio startup correction, 2026-10-28

Refs #88; [W08](../W08-first-sound.md) and [continuous listening](../../../explanation/continuous-listening.md).
This is a reliability follow-up, not acceptance of the physical-device matrix.

## Starting point and observation

- Base: `200d6195a99b8565cd572cc55a696d479985023f` (`origin/dev`).
- Branch: `fix/mobile-audio-startup`.
- Tested implementation: `c29573b1f1b9b1835edd21c8ce9828bbf376acf3`.
  The following commit only records this evidence and operational guidance.
- Owner report after Product 0.1.63: tracks remain on Preparing audio in the
  mobile Host; ordinary Web playback works. Back to Kemet is a Free release.
- Read-only live probes: its public manifest, 96 kb/s init and first ciphertext
  segment return HTTP 200, respectively 17,035 / 781 / 49,864 bytes, in about
  0.19 / 0.19 / 0.33 seconds from this operator. This is neither an audible
  measurement nor proof of the mobile network path. No payment or tip was sent.

## Reproduced defects and decision

Two WebKit regressions failed before the correction: a fresh player with
implicit preloading disabled never starts, and an engine requiring Play before
metadata is trapped by the transport's readiness gate. Both pass after the
correction. They model concrete Host restrictions; no remote inspection of the
physical iPhone was available to certify its exact internal failure.

The native source now loads explicitly after listener installation. Play waits
for source authorization/preparation, rather than for `canplay`. Native readiness
still owns seek availability, history and startup completion. The initial manual
Play retains its selection attempt instead of becoming unrelated replay evidence.
Prepared successor adoption retains its exact buffered node without `load()`.

A single 60-second deadline starts after authorization and includes all media
preparation retries. Readiness, replacement and cancellation clear it. Expiry
aborts owned work, retires its native source, clears pending UI and exposes the
existing audio-unavailable retry. Late results cannot become a newer selection.
The deadline does not run while a wallet signature is being requested.

A native loading correction is smaller than a streaming-engine rewrite or new
Host permission. The current authenticated MSE/compatibility rendition, key
service, access policy and WebRTC transport are unchanged. No archival fallback,
new source key or payment retry is introduced.

## Validation

- `npm run test:audio-continuity`: **52 passed** in Chromium/WebKit (1.8 minutes),
  covering implicit preload, gesture-only resource selection, timeout/retry,
  stale deadlines, authenticated media, ABR and prepared successor adoption.
- `playwright test e2e/audio-startup.spec.ts e2e/mobile-host-playback.spec.ts
  e2e/room-continuity.spec.ts --workers=2`: **20 passed** (48.7 seconds),
  including successive Play ownership, source replacement, local output gating
  and real RTP audio continuity through native/Web Audio capture.
- `npm run test:unit`: **1,027 passed**. Final TypeScript check, Web build and
  `build:product-devnet:frozen` pass. No signer or publication was used.
- `npm run lint`: zero errors; two pre-existing App.tsx dependency warnings.
- Offline backlog manifest, new evidence links and `git diff --check` pass.

The media is real locally generated AAC with authenticated synthetic encryption;
no production key or clear music is persisted in the tests. The full audio
suite ran against frozen source without editing/reloading its test server.

## Release boundary

Not deployed by this PR. Publish the reviewed client, then repeat cold Free,
already-authorized protected and room-host playback on the exact installed
Polkadot App version. Confirm actual audible output, foreground/background and
resume behavior. Do not pool Web or synthetic results as physical Host evidence.
No contract, API, database, secret or permission changes are required.

## PR #342 review follow-up

[The pending-playback comment](https://github.com/knzeng-e/dotify/pull/342#discussion_r4395634454)
identified that the enabled control still forced `playing: false` until
`canplay`. A Play request could therefore leave an apparent Play button whose
next click actually paused the element.

Implementation `3dc0736f45915e7ab8d0040661e02cc0da6a211b` preserves native
play/pause intent in the pending transport shared by PlayerTransport and
PlayerDock. Displayed time/duration stay zero and seeking stays disabled until
readiness. New source generations reset the preceding track's play state.

The regression mounts the real PlayerTransport, uses a gesture-required native
element and holds its first authenticated media segment before `canplay`. It
failed in Chromium and WebKit before the correction. It now verifies Play to
Pause, cancellation before readiness, a paused late buffer, manual restart and
reset when replacing a playing source. No production session or media is used.

Review validation: `test:audio-continuity` passes **56 cases** in Chromium and
WebKit (2.1 minutes); Web build/typecheck pass; lint has zero errors and the same
two existing App.tsx warnings. Offline backlog/diff checks pass. This follow-up
is still not a physical Host or deployed-client acceptance claim.
