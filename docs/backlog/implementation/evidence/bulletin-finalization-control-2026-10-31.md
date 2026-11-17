# Bulletin finalization comparison preparation, 2026-10-31

Refs #288 / #287. Base: merged `dev` `30fd44017065028915a0896b8c5f870ba24b5f44` after #360. The [paired mobile observations](bulletin-continuity-publication-2026-10-31.md#native-acceptance-and-next-test) complete 64 seconds but both have an owner-reported cut near 46 seconds, including with embedded bytes. Native Bulletin reads are not necessary to reproduce that symptom. **This is a controlled diagnostic, not a confirmed fix or new publication.**

## One variable, one shared reader

The 64-second lab candidate identifies itself as 0.3.0. Its default is **After final append (baseline)**. **Near playback end (experiment)** delays the successful `endOfStream()` call until the playhead reaches the last second and the entire remaining tail is buffered. Both modes run the existing managed producer, authenticate the same objects, preserve demand-driven reads and retain seek/eviction recovery. A pending finish does not block that producer. Native errors are not deferred, and cancellation removes the pending work/listeners. Tail coverage permits only one 48-kHz sample of numerical rounding: real Chromium reported `63.999999` for the 64-second tail, which otherwise prevented natural completion; larger holes still block finalization.

`web/src/features/catalog/streamingPlayback.ts` adds only an optional typed producer seam. Ordinary Dotify callers supply no override, so they keep the original `pumpManagedAudio` behavior. The generated-only research controller supplies `host/finalization.ts`, which mediates only this producer's source calls and binds native methods/accessors to their real receiver. It does not mutate globals, native prototypes or the actual media source attached to the player. Keeping the experiment here avoids prematurely changing production behavior or copying the reader into a second implementation.

The alternate timing is exposed only for the continuity profile. Standard MSE and Blob playback do not run this managed control: their report's `finalizationExperimentApplied` stays false. Such a report cannot validate the managed experiment. The short profile retains its original clip, version and limits.

## Evidence that can explain a cut

The bounded notebook now retains segment append start/completion, exact end-of-stream request/call, source state and managed demand transitions, duration changes and up to eight buffered ranges per event. **I heard a cut** adds a manual marker at the current playhead; human reaction time is included. It never sets audible-first-sound or operator-heard-audio proof. Those remain separate observations.

The managed observer only appends in-memory snapshots. Existing progress/media/metric callbacks flush them into the notebook; extra buffer events do not introduce a synchronous storage/render pass per event. Observers cannot break authenticated playback. The existing five-attempt / 256-KiB journal, 200-event and 100-read limits and explicit field projection remain. Keys, media bytes and arbitrary metadata stay out of saved reports. A long or highly interactive test can exhaust these evidence bounds; do not infer that absent events prove uninterrupted listening.

## Review map and failure boundaries

1. `research/bulletin-prototype/host/finalization.ts`: can a deferred call run after Stop, close an updating buffer, or finalize over a missing tail? Does a backwards seek still reach the real producer? Baseline must call the native method immediately.
2. `host/player.ts`, `mobile/reports.mjs`: do both variants record their actual managed applicability, preserve duration/source snapshots and keep the cut marker distinct from measured audibility?
3. `finalization.test.mjs`, `finalization-browser.test.mjs`: cancellation, holes, native receiver binding, observer failure and natural completion must remain exercised. Chromium's explicit managed-demand shim wraps real AAC MSE; it is not native iOS ManagedMediaSource acceptance.

No encoder, ciphertext, content-key authorization, contract, gateway, service, dependency pin or deployed Product record changes. The optional seam cannot select a signer or storage provider. Stopping use of the lab is the rollback boundary; no production switch is proposed.

## Verification and physical handoff

Run from the repository root with pinned dependencies and FFmpeg installed:

```sh
npm run test:continuity --prefix research/bulletin-prototype
npm run test:mobile --prefix research/bulletin-prototype
npm run test:continuity-browser --prefix research/bulletin-prototype
npm run test:mobile-browser --prefix research/bulletin-prototype
npm run test:unit --prefix web -- src/features/catalog/managedStreaming.test.ts src/features/catalog/streamingMediaSource.test.ts
```

Validation: 11 continuity/finalization state and fixture checks, eight mobile packaging/journal checks, and 12 existing Web managed-reader/capability checks pass. The three compiled browser controls pass: existing 64-second control, the paired finalization comparison and existing short mobile diagnostic. Web build/`tsc -b`, full lint (zero errors, two existing React-hook dependency warnings), formatting and offline backlog checks pass. The lab TypeScript controller/wrapper also passes a strict local compile using its existing SDK aliases. One full-fixture rerun timed out under concurrent local encoding/typecheck load; rerunning it alone with the unchanged deadline passes. Initial browser testing caught the one-microsecond tail rounding issue above; its regression is retained. Existing Vite large-chunk warnings reflect the intentionally embedded decoder-control bytes, not an added production asset.

The browser comparison uses real compiled AAC and 4x playback with an explicit always-on managed-demand shim over Chromium MSE. It checks both modes naturally reach `ended`, records distinct call positions, preserves manual markers across reload and cancels a pending finish. It establishes regression behavior, not an audible fix, native demand/eviction behavior, network speed or cold first sound.

After review, build a clean-source lab candidate using the existing verified generated fixture. Reuse its audio only after checking retention; preserve its nonce ledger and do not encrypt/publish it again merely to update the diagnostic UI. Determine the exact Product CAR/block budget and obtain publication authorization separately. No new signer activation, store, renewal or DotNS update is part of this preparation.

For the next physical test, select **Bundled decoder control (not Bulletin)** on the same iPhone, keep volume and foreground conditions fixed, and compare baseline then near-end timing. Confirm `finalizationExperimentApplied: true`. Copy both reports and note whether the cut is still near 46 seconds, moves toward the end, or disappears. Use the cut marker after a perceived gap, without treating its timestamp as exact. If the control implicates finalization, repeat native delivery before proposing a production fix. Background, real network changes, protected artist access, retention ownership and production integration remain open.
