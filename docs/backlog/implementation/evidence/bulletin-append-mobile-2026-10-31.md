# Corrected lab 0.3.1: uninterrupted iPhone listens, 2026-10-31

Refs #288 / #287. Following the [0.3.1 publication](bulletin-append-publication-2026-10-31.md), the owner confirms **three complete, uninterrupted 64-second listens**: embedded decoder control, native Bulletin over Wi-Fi, and native Bulletin during a reported Wi-Fi-to-5G switch. Every trace has **16 segment starts and completions, indices 0–15 exactly once**, no cut markers and no post-start waiting/stalled events. This accepts these bounded physical listens; it does not close W32/W33 or establish general network reliability.

## Attempts and provenance

| Mode | Report | First `playing` | Natural end | Audible result |
| --- | --- | --- | --- | --- |
| Embedded decoder control, Wi-Fi | `fc542404-eef3-4515-891f-f4ca625949a6` | 159 ms | 64 s / elapsed 64,297 ms | Owner explicitly confirms no cuts |
| Native Bulletin, Wi-Fi | `54016dbe-e598-4d5a-af69-6af0ddfbe099` | 133 ms | 64 s / elapsed 64,241 ms | Owner answers “Sans coupure” to the native-specific question |
| Native Bulletin, reported Wi-Fi → 5G | `470ceb83-e8a6-4024-8a50-a60002605cdf` | 110 ms | 64 s / elapsed 64,198 ms | Owner reports “Entendu tout sans coupures” |

The [embedded projection](bulletin-append-control-fc542404-2026-10-31.json) and [native Wi-Fi projection](bulletin-append-native-54016dbe-2026-10-31.json) preserve selected fields and all segment append start/completion entries transcribed from the owner's JSON replies. They are explicitly **not complete host reports**. The [network-switch JSON](bulletin-append-network-switch-470ceb83-2026-10-31.json) is the owner's attached file, copied byte-for-byte without annotations or field changes. The separate confirmation statements above supply auditory evidence; absent markers alone do not.

All three runs bind to clean merged implementation `1e286e5c266765427a758fd119f270361acb0375`, lab 0.3.1, the same generated 64-second audio root, managed reader and after-final-append baseline. `operatorHeardAudio` is true; `audibleFirstSoundMeasured` and `productionAccessTested` are false. Native runs report `insideHost: true`. Host cache is **unknown; not cleared**, page cache empty per attempt, with no recovery after reload.

The owner supplies Polkadot app **v0.10.0 (18)** and the same iPhone/Wi-Fi conditions for the paired controls. Native reports identify their environment as **iPhone 16e - iOS v27.0.1**. Separately, their user-agent token reports **iOS 18.7**. These are distinct owner-entered and user-agent fields; neither has been rewritten to resolve the discrepancy.

## What the correction changes

The [pre-correction controls](bulletin-finalization-mobile-2026-10-31.md) both contain two human cut markers and 18 appends, repeating segments 7 and 13 at the managed-demand resumes. The corrected runs resume with **segment 8 near media 22.3 s** and **segment 14 near 46.4 s**, with no duplicates and owner-confirmed uninterrupted audio. The actual baseline finish call remains near media 46.4 s (46.417 / 46.458 / 46.421 s across the three corrected runs). This supports the completed-append bookkeeping fix without changing the ordinary end-of-stream default.

For the embedded control, the wall/media clock differences across progress samples surrounding refills are -0.517 ms and 0.013 ms, versus about 269 / 266 ms in the previous baseline. These are sample-clock observations, **not measured audio-gap durations**. Audible acceptance comes from the owner's separate confirmations.

## Network-switch observation and its limit

The owner reports switching from Wi-Fi to 5G. The raw report retains `network: "Wifi"` and a manual `network-switch-marked` event at elapsed 22,701 ms / media **22.566505142 s**, also labelled `networkNote: "Wifi"`. The direction comes from the owner's accompanying message, not automatic network detection. At this marker the last known buffered end is 56.128 s: approximately **33.56 seconds ahead**. The next two reads complete near media 46.387 / 46.409 s; the stream reaches 64 s without a reported cut.

This proves uninterrupted listening during the owner-reported switch in this attempt. It does **not** prove that later reads traversed 5G or that a failed uncached fetch recovered: Host cache is unknown, read latencies are 1–18 ms, and no connectivity failure/retry is recorded. Do not describe this as a cold-network recovery benchmark.

## Remaining acceptance and next step

The reproduced duplicate-append regression now has physical audible acceptance for this device and synthetic clip. Keep historical failing reports alongside these successful ones. Cold audible startup, longer/protected artist playback, background interruption, uncached network failure/recovery and recurring retention remain separate gates. The 110–159 ms `playing` events are not audible-first-sound or cold-start measurements.

The next useful step is a bounded protected-release integration plan covering publication, signed key access, native playback and retention before production provider activation. Additional synthetic reruns of the same cached minute would add little evidence. No player, encryption, access policy, service, storage provider or deployed record is changed by this evidence update; no publication or renewal is requested.
