# Preserve completed managed audio appends, 2026-10-31

Refs #288 / #287. Base: clean tested `dev` `20ff46df0d5a7c5716dc77afd14d06b4a223ff31`. This fixes a reproduced segment-bookkeeping race in the shared managed reader. **Eliminating the iPhone's audible cuts still requires corrected-build physical acceptance.** No Product publication or storage-provider activation is included.

## Why this correction follows the experiment

The [paired lab 0.3.0 observations](https://github.com/knzeng-e/dotify/blob/a8cbcf20/docs/backlog/implementation/evidence/bulletin-finalization-mobile-2026-10-31.md) in #362 use the same generated 64-second clip, clean source, iPhone user agent, Wi-Fi and embedded managed delivery. Both naturally complete with audio heard and two human cut markers. The alternate mode moves the actual successful end-of-stream call from media 46.412 to 63.167 seconds, but both cuts remain before the deferred call. Deferring that call is not a sufficient remedy for this pair. Markers include reaction delay and are not exact audio-gap measurements; embedded delivery does not measure network performance.

Both reports show completed segments 7 and 13 being appended again when managed demand resumes near media 22.3 and 46.4 seconds. Buffer snapshots already cover those segments' nominal intervals. This is consistent with the race below, but does not by itself prove the audible effect of redundant appends.

## Commit completion belongs to the owner, not speculative demand

`streamingPlayback.ts` authenticates a segment, checks its request signal, then serializes the native SourceBuffer append under the playback owner's signal. Once that append starts, a native demand stop cancels speculative downloads but deliberately does not interrupt the in-progress buffer update.

Previously, `pumpManagedAudio` checked the speculative request signal after that successful append resolved. If `endstreaming` fired before `updateend`, the check threw and the pump forgot that the segment was present. On the next demand cycle it appended the same verified bytes again.

The pump now checks the **owner signal** after a successful append, then commits its presence bookkeeping. The callback contract explicitly says that resolving means an authenticated append completed. It does not interpret a cancelled/rejected download as a successful append. The existing eviction revision still prevents marking data present if it was actually removed during the update; owner cancellation still stops before bookkeeping or end-of-stream. Reads and initialization retain their request signals. No clear-media cache, auth bypass, new retry policy or transport fallback is introduced.

Changing end-of-stream defaults was rejected as the fix: the physical experiment moved that call without removing the two markers. The existing default and lab comparison remain intact. The next continuity diagnostic identifies itself as **0.3.1** so a corrected local candidate is distinguishable from published 0.3.0; the short profile remains 0.1.0. No nonce ledger, fixture ciphertext or deployed record is changed.

## Review path

1. `web/src/features/catalog/managedStreaming.ts`: does successful completion commit independently of a demand stop while owner cancellation and real eviction still win?
2. `managedStreaming.test.ts`: the new demand-stop-during-append test fails before the fix with `[0,0]` instead of `[0,1,2]`. Companion cases keep actual-eviction retries and owner cancellation during the last append explicit. Existing tests retain cancelled-download retry, seek recovery, authentication failure, refill limits and listener cleanup.
3. `web/e2e/audio-continuity.spec.ts`: the controlled managed source stops demand during a real AAC append before native `updateend`. On resume, one init plus each encrypted media fragment must append exactly once, with a single authorization and no archival read. Chromium/WebKit shims are deterministic regressions, not the Product iPhone Host.

## Verification and remaining gates

- Before fix: the new completed-append regression fails; the other 12 managed-reader cases pass.
- After fix: 13 managed-reader and two capability unit checks pass.
- Real encrypted AAC managed-reader browser slice: 15 checks pass across Chromium and WebKit; the native-WebKit-only check is intentionally skipped on Chromium and passes in the local WebKit build. This covers the new append-count regression plus denied access, authentication corruption, actual eviction, stale-track cancellation, warm-source adoption and progressive startup. It does not measure audibility.
- Web TypeScript/build pass. Full lint has zero errors and two existing `App.tsx` hook-dependency warnings. Existing Vite large-chunk warnings remain.
- Seventeen lab controls pass: finalization state/cancellation, compiled 0.3.1 AAC comparison through natural completion, packaging/public-test-key bounds, and bounded report/cut-marker persistence. The compiled comparison uses a Chromium managed-demand shim, not a physical iPhone.

After merge, prepare a clean lab candidate, recheck retention for reused audio and Product blocks, compute its exact distribution budget and obtain publication approval. Then repeat embedded listening on the same iPhone and native Bulletin delivery, preserving reports and cut markers. No new funds, signer, stores, renewals, domain or production setting are authorized by this correction. W32/W33 acceptance remains open for physical listening, cold audible startup, network/background recovery, protected artist access and recurring retention.
