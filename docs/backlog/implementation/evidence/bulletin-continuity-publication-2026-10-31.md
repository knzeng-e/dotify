# Bulletin continuity diagnostic publication, 2026-10-31

**Available: `dotify-bulletin-lab.dot`, Product `[0,2,0]`, generated clip 64 seconds.** Operator date is Europe/Paris; machine timestamps are UTC. Refs #288 / #287; production delivery/retention acceptance remains open.

This owner-authorized update follows [#359 preparation](bulletin-mobile-continuity-2026-10-30.md). It uses clean merged source `0da3a52827b1266675fb612119e9cd3ded4e7a91` and the existing independent Product. The ordinary Dotify Product stays at `dotify-test01.dot` / `[0,1,67]`; both root and app records were independently checked unchanged. No new name, subscription, service, production setting or artist publication is involved.

## What is published

The generated 64-second chord uses the real encoder and all three required qualities. The standalone diagnostic embeds only its intentionally public test key and playback control, excluding the archival master and private operator state. Native Bulletin is the default; the bundled decoder control requires explicit selection and is not a network benchmark. Reports remain in the local five-attempt notebook until manually copied. This does not implement artist access or authorize a production storage switch.

| Artifact | Verified result |
| --- | --- |
| Source | clean merged `0da3a528` |
| Audio directory | 66 blocks / 5,677,848 bytes |
| Product CAR | 5,272,391 bytes |
| New stores | 74 / 10,950,594 bytes, within 75 / 10,986,543 approved |
| Reused blocks | 1; existing icon verified before reuse |
| Renewals submitted | 0 |
| DotNS signature requests | 3; not a separate confirmed-transaction count |
| Remaining transaction quota | 149; 82 retained for the two audio reserves |

Audio root: `bafykbzacecj2qvfpqevlm6pqkm24fjcmszi6qd5r3ywikxfxx5yhjqsyorot4`.

Product storage root: `bafybeiggb5c66s6fnlrqg3hpobgk4rhfr25qpp5odfqagapyeumrvv5lwa`.

CAR SHA-256: `01df74e4fbab43eb77a46aafbece6ed88c66ac4b2e7bef6a69d5d84fd3f9de46`.

The [machine-readable evidence](bulletin-continuity-publication-2026-10-31.json) contains all finalized storage positions, artifact hashes, record snapshots and quota observations. Every audio block was checked by finalized metadata and raw CID readback. A separate node-RPC traversal authenticated and decrypted all 51 playback objects across the three qualities, using 56 unique raw reads / 3,629,302 bytes and excluding the archival master. This is a data-integrity proof, not physical Host or audible-start evidence. All nine Product blocks were reread independently and their CAR chunks reconstructed to the exact candidate hash. The gateway result was HTTP 200 with the same full CAR hash. Seven embedded files had already been byte-compared with the local candidate.

## Signing, persistence and retention

The replenished owner-selected account had 223 available transactions before submission. The research writer used the real PAPI 3 creator, explicit nonces, a durable submission journal and an account lease. Its measured peak was 2 in-flight direct writes; the root remained last. No storage retry, quota grant, pool fallback or renewal was sent by the operator. Product uploads also used the exact preverified blocks. DotNS changes were restricted to the two diagnostic nodes, the approved content hash and exact root/app text records, with zero registration payment or contract-call value. Network fees and contract storage deposits still apply.

The local signer variable was removed and its absence checked without reading or displaying its contents. A late failure must be reconciled by nonce/CID/record readback; never blindly rerun a publication or reset a nonce ledger. The private generated fixture, permanent nonce ledger and operator journals remain local for recovery.

Keep 66 transactions / 5,677,848 bytes reserved for the new audio renewal and the prior 16 / 713,229-byte reserve separately. A reserve is not a renewal service. The reused icon expires earlier than the new objects (earliest observed Product dependency expiry: Bulletin block 1477259); recheck before delayed use. Rollback requires a reviewed diagnostic-record update to the previous verified root, whose retention must first be checked. Stopping use of the lab changes nothing in deployed Dotify storage.

## Native acceptance and next test

The first [owner-supplied native mobile observation](bulletin-continuity-mobile-wifi-2026-10-31.json) reaches 64 seconds on iPhone over owner-reported Wi-Fi. The first `playing` event is at 1,388 ms, audio was heard, and the owner reports **one audible cut**. Uninterrupted listening is therefore **not accepted**. The exact Host version was not reconfirmed for this attempt; Host cache state is unknown. This is not a cold audible-start measurement.

The supplied timeline has no post-start `waiting`, `stalled` or error event. Its 20 raw reads total 778,922 bytes. Later refill reads finish near media times 23.84 and 46.88 seconds, while earlier buffer observations still extend to 32.064 and 56.128 seconds respectively. These observations do not show obvious buffer exhaustion, but cannot locate the heard cut or exclude a delivery/player interaction. A terminal `pause` at 64 seconds immediately precedes `ended`; it is not evidence of a user interruption.

An offline check authenticates and decrypts the local 96 kb/s fixture, concatenates its init and 16 segments, and decodes it with FFmpeg. The 2,999 packet-duration transitions checked after AAC priming contain no timestamp gap; no silent 100 ms window occurs in the interior, excluding one second at each end. The generated chord has no designed mid-track pause. This check does not reproduce iOS playback or exclude shorter artifacts. The derived JSON retains the timing samples and method, omitting the report UUID, exact start time and raw user agent.

The owner then supplied the requested [64-second bundled decoder control](bulletin-continuity-control-wifi-2026-10-31.json). It completes with sound heard and first `playing` at 94 ms, but **also has an audible cut near 46 seconds**. The owner retrospectively places the native cut near the same point. Both use the same clean source/root and managed reader. Embedded reads do not use Bulletin and are not network benchmarks; native delivery is therefore not necessary to reproduce this symptom. The exact shared media-path cause is still unproven.

| Same generated clip / managed reader | Native Bulletin | Embedded control |
| --- | --- | --- |
| First `playing` event | 1,388 ms | 94 ms |
| Outcome / heard audio | 64 s ended / yes | 64 s ended / yes |
| Heard cut, approximate media time | ~46 s, retrospective | ~46 s |
| Post-start `waiting` / `stalled` | 0 / 0 | 0 / 0 |
| Final raw read, media time | 46.879 s | 46.441 s |
| Wall advance minus media advance, ~44-48 s samples | 266.208 ms | 265.963 ms |

The sampled clock lag is a correlation, not a measurement of audible-gap duration. Sparse/coalesced events and approximate human timing cannot establish causation. The code appends the last two segments during that refill and calls `endOfStream()` after the final append. This call changes the media-source state and can update duration under the [MSE end-of-stream algorithm](https://www.w3.org/TR/2026/WD-media-source-2-20260807/#end-of-stream-algorithm); the supplied reports do not record its call time or native buffer lifecycle. There is no confirmed browser defect or validated app fix yet.

### Next controlled experiment

1. Record final-append start/completion, the exact `endOfStream()` call, source open/ended and managed start/end demand, duration changes and buffered ranges. Preserve these bounded diagnostics in the notebook without keys or audio bytes. Record a human cut marker separately; events cannot assert audibility.
2. Compare the unchanged immediate finalization with a diagnostic-only variant that defers finalization until near the playback end. Keep authenticated bytes, reader, fixture, device and volume constant. Preserve natural `ended`, cancellation, backwards seek and eviction recovery; never use a missing end signal as a workaround. Test embedded data first, then native only if needed.
3. If the cut moves/disappears with finalization timing, investigate that transition before proposing a production change. If it persists, isolate final append/decoder behavior instead. A local candidate must pass regressions and a reviewed distribution budget before another lab publication; this evidence PR changes no player code or live records.

After addressing or explaining the cut, continue to pause/seek, a brief background interval and an actual Wi-Fi/mobile transition. Copy important reports before the five-attempt history evicts them.

The installed Desktop 0.1.4-rc.3 version was verified in its About dialogue. UI automation could not navigate from the dashboard to the diagnostic, so a new native Desktop playback result is not claimed. The prior eight-second mobile observations remain [separate evidence](bulletin-mobile-publication-2026-10-30.md).

The total operator wall observation was 28.8 minutes, including preflight, finality, readback and DotNS. This is not listening startup latency, a regional measurement or a controlled throughput comparison. Reducing publication overhead and establishing recurring retention ownership remain follow-ups before production integration.
