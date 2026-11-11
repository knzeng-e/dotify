# Offline Bulletin layout study — 2026-11-11

Refs #407. Branch starts from current dev `fd9d35d5`; its tree
`7f3a52f30d08b9391fd5eacb4e08797c458485bd` is identical to the #428 source with
13 successful PR checks. [ADR 0051](../../../adr/0051-bulletin-compact-layout-study.md)
records the candidate and compatibility/persistence gates.
[Complete deterministic model](bulletin-compact-layout-2026-11-11.json).
The custody image stays `8d070654`, Web/Product/public APIs 0.1.82.

## Model and results

Only deterministic synthetic objects and disposable fixture keys are used.
The existing 16-store / 4-MiB write window, two proof readers and current scheduler
compute equal-duration dependency waves. Original archive, all three renditions,
manifest, ciphertext and object authentication are retained. No artist file,
production key, app configuration, signer, RPC or permanent nonce ledger is used.

Cells below show **blocks / modeled waves**, not seconds or an ETA.

| Synthetic geometry                   | Current standard 256 KiB | Standard 512 KiB | Pack segments, init separate, 256 KiB | Pack after first segment, 256 KiB | Pack after first segment, 512 KiB |
| ------------------------------------ | -----------------------: | ---------------: | ------------------------------------: | --------------------------------: | --------------------------------: |
| Small archive, 23 segments per rate  |                   88 / 8 |           84 / 7 |                                50 / 6 |                            53 / 6 |                            36 / 6 |
| Medium archive, 29 segments per rate |                  108 / 9 |          103 / 9 |                                59 / 6 |                            60 / 6 |                            40 / 6 |
| Large archive, 25 segments per rate  |                 151 / 12 |         118 / 11 |                               109 / 9 |                           111 / 9 |                            65 / 9 |

The unlisted init-only 512-KiB pack is also in the JSON. Its lower block count
still gives the same wave counts as the 256-KiB pack. Synthetic covers remain
8 blocks / three waves and metadata two / two at both standard chunk sizes.
The public-asset tail is not solved by this audio-layout experiment.

A lower store count is not a whole-publication speedup. The smaller real MP3 and
larger previous WAV were not a controlled comparison; these synthetic geometry
cases do not become an artist benchmark by having similar block counts.

## Startup and read amplification

The medium case's 96-kbps first object contains 48,016 ciphertext bytes. Cold
per-object fetched totals are 50,176 bytes on current standard paths, 275,660
on an init-only 256-KiB pack and **61,274** when the first segment also remains
separate. The latter preserves the six-wave result. Init stays a tiny separate
file in all packed variants; packing decoder bootstrap bytes would needlessly
force a large chunk before append.

This is not a warmed playback/network test. Packed cold totals include marker
and manifest revalidation; standard totals use the existing per-path reader.
For later random seeks, even 256-KiB chunks can greatly amplify a small object:
the small-case sampled 96-kbps middle object fetches 535,434 bytes for 48,016.
512-KiB chunks can need two complete 512-KiB blocks across a boundary. The
prototype counts and bounds both partial ends, not only one extra chunk.
Cache locality and actual mobile first sound remain gates; lower write stages
alone are not grounds to ship the format.

## Integrity, compatibility and validation

- The research 256-KiB importer/readdress implementation produces exactly the
  deployed builder's CIDs, blocks and bytes in the baseline regression.
- Both standard chunk sizes reconstruct current paths with the unchanged API
  reader. Packed reads reconstruct every synthetic init/segment and pass ordinary
  AES-GCM decryption, retaining manifest HMAC/scope verification and archive bytes.
- Range tests cross chunk boundaries without reading the archive or other rates;
  a one-segment rendition emits no empty pack. Init/first retention preserves
  small startup fetches. Old paths can still start then fail on a later packed
  segment, which is why an explicit future reference/layout contract is mandatory.
- Corrupt returned CID bytes, validly readdressed altered ciphertext, mismatched
  root/manifest, unsupported markers, invalid paths/sizes, oversized/untyped block
  responses and pre/mid-read cancellation refuse. The transport owns no key;
  caller HMAC/scope verification and object GCM remain necessary.
- **429 API tests / 42 suites pass**, including 14 research cases, with no skips.
  The restricted first run's only two failures were loopback `listen EPERM`;
  rerunning with socket permission passes without weakening HTTP assertions.
  API typecheck/build and changed-file formatting pass.
- The complete model is identical across two runs (SHA256
  `d2469f05d3df8a2dd9405ac96e6a0fba6d9a5b3fa306c1fca6cd7bf15984e521`).
  Outputs contain no runtime timings or random IDs. No network write occurs.

Reproduce from `services/api` after installing the checked-in dependencies:

```sh
npm run research:bulletin-layout
node --import tsx --test scripts/research/bulletinCompactLayout.test.mjs
npm test
npm run typecheck
npm run build
```

The research command accepts no source paths/options. Its modules are outside
`src`, not copied into the API Docker image and not wired to any application
reader/writer. Compatibility of native Host/Web is inspected and specified in
ADR 0051, not exercised on physical devices here. Synthetic bytes do not prove
AAC decode, seeking, adaptation, Room continuity or background audio behavior.

## Next review boundary

Prefer a 256-KiB pack retaining init and the first media segment for the next
integration candidate. Specify reference/layout versioning and immutable
per-identity layout selection; implement bounded Web/API/Host range resolution,
old-layout dispatch and restart/reconciliation tests. Verify real encoded media
and first sound before any separately approved deployment or funded trial.
No old admission, graph, key, nonce, retention or parent/root proof rule changes
in this study. #407 remains Now/In Progress before #395, #388 and CASH research.
