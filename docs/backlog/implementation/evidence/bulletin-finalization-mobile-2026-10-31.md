# Bulletin lab 0.3.0: paired physical iPhone observations, 2026-10-31

Refs #288 / #287. The first [published lab 0.3.0](bulletin-finalization-publication-2026-10-31.md) baseline reaches the end, with audio heard, but the owner marks **two cuts**. Uninterrupted listening is not accepted. The near-playback-end comparison also completes with two marked cuts. Moving the actual finish call later does not remove the symptom; this pair does not establish that redundant appends are its audible cause.

## What was tested

[Original report](bulletin-finalization-baseline-f2ff9553-2026-10-31.json), attempt `f2ff9553-1590-427b-bc1c-1396ca9de921`, started `2026-10-31T12:12:30.476Z`:

- Clean implementation `20ff46df0d5a7c5716dc77afd14d06b4a223ff31`; generated 64-second clip, same retained audio root.
- iPhone user agent reports iOS 18.7; managed reader and `finalizationExperimentApplied: true`.
- **Bundled decoder control (not Bulletin)**, **After final append (baseline)**, owner-reported Wi-Fi. Host app version was not reconfirmed for this attempt.
- First `playing`: 77 ms; natural `ended`: media 64 s / elapsed 64,774 ms; audio-heard checkbox true. `playing` is not measured audible-first-sound timing.
- 104 retained events, 20 embedded-object reads / 778,922 bytes. Host cache remains unknown. Embedded reads do not measure Wi-Fi or Bulletin delivery performance.

## Observations, not causation

| Observation | Media position | Elapsed time |
| --- | --- | --- |
| Managed demand resumes; segment 7 is appended again | 22.281 s append start / 22.290 s demand event | 22,401 / 22,410 ms |
| First human cut marker | 24.197 s | 24,585 ms |
| Managed demand resumes; segment 13 is appended again | 46.360 s append start / 46.371 s demand event | 46,747 / 46,759 ms |
| Actual end-of-stream call | 46.412 s | 46,799 ms |
| Second human cut marker | 47.248 s | 47,802 ms |

The first marker precedes the actual end-of-stream call by over 22 seconds. That call cannot explain both marked cuts by itself. The second marker follows the final append and end-of-stream call; the alternate timing test is still useful for separating those operations. Markers include reaction delay and are not exact gap positions or durations.

Segments 7 and 13 each have two append start/completion pairs. At their repeated append starts, snapshots already cover their nominal intervals: `[0,32.064]` and `[0,56.128]`. There is no new read for either repeated segment in the report. This identifies a **candidate redundant-append path**, not proof that these appends cause audible gaps or that every native eviction was observed.

Code inspection identifies a matching hypothesis in `web/src/features/catalog/managedStreaming.ts`: `endstreaming` aborts the speculative request signal; after `appendSegment` resolves, `requestSignal.throwIfAborted()` runs before the segment is marked present. In the real adapter, a started SourceBuffer append deliberately completes under the owner signal, so a demand stop during that successful append can leave the presence bookkeeping behind. Do not remove cancellation or change production behavior based only on this correlation. Any fix needs a deterministic regression covering completed append versus cancelled download, real eviction and owner cancellation.

The progress-clock differences across the two surrounding sample windows are 268.959 ms (media 20.276 to 24.522 s) and 266.404 ms (44.603 to 48.603 s). These are wall/media clock observations, **not measured audio-gap durations**. There is no post-start `waiting` or `stalled` event; the human markers still establish that `ended` alone is insufficient acceptance.

## Near-playback-end result

The owner supplied the second report `707c164e-01b2-4622-a1d1-6aec150547ad`, started `2026-10-31T12:21:46.768Z`, on Wi-Fi with the same iPhone user agent, implementation, audio root and embedded managed delivery. The [selected-field projection](bulletin-finalization-near-end-707c164e-2026-10-31.json) explicitly identifies its transcription/projection boundary; it is not a complete host report. Host app version remains unconfirmed.

| Observation | Baseline | Near-playback-end |
| --- | --- | --- |
| First `playing` | 77 ms | 91 ms |
| First human cut marker, media time | 24.197 s | 22.935 s |
| Second human cut marker, media time | 47.248 s | 47.125 s |
| Actual end-of-stream call, media time | 46.412 s | 63.167 s |
| Segment indices appended twice | 7 and 13 | 7 and 13 |
| Natural completion | 64 s | 64 s |
| Heard audio / managed experiment applied | true / true | true / true |

The alternate mode takes effect: the request remains at media 46.415 s, while the actual call moves to 63.167 s. Both markers occur before that deferred call. This rules out the timing of the successful end-of-stream call as a sufficient explanation/remedy for these two marked cuts in this pair. It does not rule out every finalization-related effect or other production problems.

The repeated appends and demand resumes remain near media 22.3 and 46.4 s. Repeating a segment whose previous append completed is now a concrete bookkeeping defect to reproduce deterministically, while its audible effect still needs a corrected-build physical comparison. The embedded control proves native Bulletin delivery is not necessary to reproduce the symptom; it does not measure Wi-Fi/Bulletin throughput or rule out separate network stalls in production.

## Next implementation and acceptance

Add a regression for demand stopping during a successful native append, preserve the committed segment without treating a cancelled download as success, and retain real-eviction and owner-cancellation guards. Verify the real compiled AAC adapter locally, then prepare a clean lab candidate after code review. Any later publication needs a fresh retention/budget review and explicit authorization; these reports authorize no new stores or record changes.

The current observations change no player, ciphertext, access policy, service, provider or deployed record. No audible fix is accepted. Corrected-build iPhone listening, native delivery, cold audible startup, background recovery, artist access and recurring retention remain separate gates.
