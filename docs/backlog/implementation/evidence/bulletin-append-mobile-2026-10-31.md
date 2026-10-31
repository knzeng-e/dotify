# Corrected lab 0.3.1: iPhone embedded control, 2026-10-31

Refs #288 / #287. The first physical control after the [0.3.1 publication](bulletin-append-publication-2026-10-31.md) reaches 64 seconds with audio heard and **each of the 16 segments appended exactly once**. No cut marker or post-start waiting/stalled event appears in the supplied report. **The owner has not yet explicitly confirmed an uninterrupted audible listen**; absent markers alone do not establish that. Native Bulletin delivery on the corrected build remains next.

## Attempt and scope

- Report `fc542404-eef3-4515-891f-f4ca625949a6`, started `2026-10-31T14:48:04.697Z`; [selected-field projection](bulletin-append-control-fc542404-2026-10-31.json).
- Clean merged implementation `1e286e5c266765427a758fd119f270361acb0375`, published lab 0.3.1; same generated 64-second audio root as the [pre-correction pair](bulletin-finalization-mobile-2026-10-31.md).
- iPhone user agent reports iOS 18.7. The owner supplies **Polkadot app v0.10.0 (18)** and **Wi-Fi**.
- Embedded decoder control, managed reader, after-final-append baseline, experiment applied. `operatorHeardAudio: true`; measured audible-first-sound and production access both false. Host cache remains unknown; page cache is empty per attempt.
- The JSON is explicitly a transcription/projection of selected fields, not the entire host report or a measurement of network delivery.

## What changed in the trace

| Observation | Before correction, lab 0.3.0 | Corrected embedded control |
| --- | --- | --- |
| Segment append starts/completions | 18 each; segments 7 and 13 repeated | 16 each; indices 0 through 15 once |
| First refill starts with | segment 7 again, near media 22.3 s | segment 8, at media 22.287 s |
| Second refill starts with | segment 13 again, near media 46.4 s | segment 14, at media 46.374 s |
| Actual baseline end-of-stream call | media 46.412 s | media 46.417 s |
| Human cut markers | two in each previous mode | none in this report; auditory confirmation pending |
| First `playing` | 77 / 91 ms in the paired controls | 159 ms, not audible-start timing |
| Natural completion | 64 s | 64 s / elapsed 64,297 ms |

The baseline finish call stays at essentially the same position. The demand resumes still occur near media 22.3 and 46.4 seconds, but now continue with the next segment. That is physical trace evidence that the corrected completion bookkeeping removes the redundant appends under this Host's actual managed-demand transitions.

Across the progress samples surrounding those refills, wall/media clock differences are -0.517 ms (media 20.281 to 24.295 s) and 0.013 ms (44.366 to 48.381 s), versus approximately 269 / 266 ms in the previous baseline. These are sample-clock observations, **not measured audio-gap durations or audible acceptance**. The embedded control does not measure Bulletin or Wi-Fi throughput, and one run does not establish device/network reliability.

## Next acceptance step

Confirm whether the owner heard any gap during this embedded control. Then repeat on the same iPhone/Wi-Fi/Host version using **Bulletin through Polkadot app** with **After final append (baseline)**. Listen through 1 min 04 without pausing, mark each heard cut, check heard audio if appropriate and preserve the report. Compare unique appends, buffer progress, actual completion and the owner's auditory observations separately.

No new player, encryption, access-policy, service, provider, storage or deployed record change follows from this observation. Native corrected-build delivery, cold audible startup, background/network recovery, protected artist access and recurring retention remain separate gates. Do not close W32/W33 from this embedded result alone.
