# Bulletin mobile continuity preparation, 2026-10-30

Refs #288 / #287. Builds on the [eight-second mobile observations](bulletin-mobile-publication-2026-10-30.md), now merged through #358. Those native listens establish basic delivery; the bundled Wi-Fi/5G controls do not measure Bulletin network performance. This increment prepares a longer isolated test. **No new content, renewal or Product publication has been submitted.**

## What changes

The `continuity` profile generates a reproducible 64-second chord, long enough to outlive the player's unchanged 30-second buffer. It uses the real encoder, all three required 96/160/320-kbps renditions, v3 manifest authentication and per-object decryption. A single-rendition shortcut was rejected because it would deviate from the actual format. No production audio format, access check, service, secret, dependency pin or deployment setting changes.

The fixed larger profile requires explicit caller selection. Fixture metadata cannot silently raise limits. The short profile retains its 1-MiB/40-transaction network limits and 60-second attempt deadline. Continuity has an 8-MiB/160-transaction ceiling, 64-file graph limit and 180-second attempt deadline; each raw block remains at most 512 KiB and the graph at most 128 blocks. A missing profile selection for a larger fixture, unknown values or repeated CLI options fail. The operator still requires the local signer descriptor and exclusive account lease for any future write; unresolved nonces never automatically retry.

Before admitting the larger fixture, the loader authenticates its manifest and decrypts its archival master locally, comparing it byte-for-byte to the generated source. That master and all private operator/nonce state stay out of the standalone control bundle. Readdressing preserves ciphertext and the permanent nonce ledger; existing directories cannot be overwritten.

Reports now preserve media-relative read times, progress/buffer observations and an explicit human network-switch marker. A marker is a note, not automatic verification of a handover. Background events remain observations; a healthy session is not stopped merely because the page becomes hidden. The existing local-only five-report/256-KiB journal, explicit copying, bounded fields and key exclusion remain in place. The UI shows the selected clip duration and attempt limit.

## Evidence and exact future budget

See the [machine-readable record](bulletin-mobile-continuity-2026-10-30.json). Local fixture identity:

`bafykbzacecj2qvfpqevlm6pqkm24fjcmszi6qd5r3ywikxfxx5yhjqsyorot4`

| Item | Locally verified value |
| --- | --- |
| Duration | 64 seconds; 16 segments per rendition |
| Complete directory | 66 blocks / 5,677,848 bytes |
| Decrypted playback objects | 51; archival master excluded from playback |
| Proposed initial stores | 66 transactions / 5,677,848 bytes |
| One later renewal reserve | 66 transactions / 5,677,848 bytes |
| Total transaction reservation | 132, before independent Product distribution |
| New real signatures / submissions | 0 / 0 |

The retained earlier AAC reserve is separate. The last observed account quota does not cover this new transaction reservation. Do not infer permission to top up or publish. Recheck finalized quota, retention and other account activity before proposing a live run. The 8-MiB/160 ceiling is a hard research bound, **not an approved spend**. Distribution embeds a lazy decoder-control chunk of about 4.84 MB before compression plus the app; its exact stored block/byte count needs a separate reviewed publication candidate. Product download time is outside the per-attempt `playing` timer. Lazy loading does not guarantee the Host has not already downloaded/cached the Product archive.

The repository writer already returned the correct PAPI 3 transaction creator. The previous publication failure came from an ad hoc operator mixing a PAPI 2 signer object with a PAPI 3 client. This change rejects that object before RPC and adds a manual read-only construction probe with the pinned real PAPI 3.3.0 and `getFakeTxCreator`. It built 120 bytes against finalized DevNet metadata at block 1,434,307 with nonce 948. Its RPC provider allowlists only reads and refuses all submission methods. The synthetic signature is invalid, never broadcast, and no real key is loaded. This proves construction compatibility, not dispatch success or future live throughput.

All 79 targeted checks pass: original prototype (38), pipeline (23), mobile packaging/journal (7), continuity boundaries (3), shared Host harness (6), and two compiled browser controls. They cover the original prototype/pipeline/mobile behavior and the new profile's explicit limits, generated-source proof, archive exclusion and read-only RPC boundary. A compiled Chromium mobile-viewport test runs the real 64-second control at 4x speed, observes progress beyond 30 seconds and further reads during playback, exercises pause/seek/stop and persists the network marker across reload. Native mode outside the Host fails without loading control data or making an HTTP fallback. This is a regression test, not real-time physical-device or network performance evidence; AAC decoded end time has a 150-ms tolerance.

## Reproduce and next gate

From the repository root, after installing the pinned research/API/Web dependencies and FFmpeg:

```sh
npm run continuity --prefix research/bulletin-prototype -- prepare /private/tmp/NEW-source /private/tmp/NEW-blake
npm run continuity --prefix research/bulletin-prototype -- plan /private/tmp/NEW-blake
npm run pipeline --prefix research/bulletin-prototype -- plan /private/tmp/NEW-blake --profile continuity
npm run continuity --prefix research/bulletin-prototype -- build /private/tmp/NEW-blake /private/tmp/NEW-product --allow-public-generated-key
npm run test:continuity --prefix research/bulletin-prototype
npm run test:continuity-browser --prefix research/bulletin-prototype
```

Only the separate `probe:writer` command reads DevNet; CI never runs it. `continuity` commands cannot load a signer or submit. A failed encoder attempt may already have reserved nonces: retain its private ledger and choose new directories, never reset it to retry encryption. The old sequential renewal command does not accept this larger profile or the pipeline journal. A reserved renewal is not an implemented recurring renewal service.

After review, prepare an exact distribution budget and obtain authorization for the new stores/publication separately. Then record native 64-second listening on iPhone and Desktop, a deliberate pause/seek, an observed background interval and an actual Wi-Fi/mobile transition with the operator's marker. Stop/save a failed attempt before retrying. Keep cache state unknown unless independently controlled. Cold audible first sound, protected artist access, recurring retention ownership and production integration remain W32/W33/W13 gates. Rollback is to stop using the separate diagnostic; Dotify's current storage is untouched.
