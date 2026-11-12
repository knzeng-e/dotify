# Compact AAC decoder acceptance — 2026-11-12

This record helps reviewers assess the next #407 code gate. It does not record
a deployment, physical listening acceptance or faster publication.

## Artifact and environment

Test implementation: `2cb7f2255894bb9401051177e2507c1b15c1405f`, from merged
dev `7e1078f074e0ae7e998fe781ade423359fd6c050` (#436).
[Merged-dev CI](https://github.com/knzeng-e/dotify/actions/runs/43132456635) is
green. Local checks use macOS, Node 22.13.1, the lock-matched dependencies and
local FFmpeg AAC encoding.

The 24.2-second public synthetic tone is encoded once into authenticated objects.
Both production graph constructors use those same ciphertext bytes. The local
combined artifact's SHA-256 is
`5a907e9ac55178fac710d1e4aba0f728f72d16a3edc8a05ddcd7d5bd23d6cff1`.
Each generation uses a fresh temporary nonce ledger/generation; this hash names
this run, not a required fixed CID. No artist file or real key is used.

## Observed local result

| Check                       | Result and boundary                                                                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compact AAC browser matrix  | **21 passed, 3 deliberately excluded** across Chromium/WebKit × Web/injected Host, with no automatic retry.                                                                                    |
| Decoder samples             | All 96/160/320 qualities decode into PCM with RMS above 0.01 and the expected duration.                                                                                                        |
| Playback and selection      | Forward/backward seeks, standard → compact → standard selection and cold transport reopening return measurable signal. Chromium uses progressive playback; WebKit uses compatibility playback. |
| Room audio leg              | A real loopback WebRTC guest receives measured normalized audio; the compact compatibility rendition plays to its authenticated end. This is not a physical or full Room UI test.              |
| Adaptive Web reader         | Chromium decodes 96 → 320 → 160 with controlled HTTP delays. These delays are test inputs, not publication or provider timings.                                                                |
| API regression              | **461 tests / 42 suites pass**, zero skips, including the existing media and access checks.                                                                                                    |
| Build and source boundaries | API typecheck/build and dedicated harness typecheck pass. The production API build excludes fixture scripts. Ordinary Web and frozen Product build with API `node_modules` absent.             |
| Formatting and lint         | Web formatting passes; lint has no errors and the same two existing App hook warnings. Builds retain existing large-chunk warnings.                                                            |

The offline backlog check, whitespace check and 508 local file/anchor links in
the changed documentation also pass.

Firefox's local macOS renderer cannot launch: the process reports a sandbox
extension/framebuffer failure before navigation. Its 20-second launch deadline
is retained; no browser sandbox is disabled. The configured Linux CI matrix
still includes Firefox. Its results must be recorded separately before review
readiness; the local result above must not be read as three-engine acceptance.

The configured full matrix has 36 cases and four explicit exclusions: native
HTTP-congestion cases, and WebKit progressive signal. Every engine/transport
retains all-quality PCM and compatibility/guest-signal checks. WebKit's
progressive MediaSource-to-WebAudio energy remains unaccepted by this harness;
existing progressive codec/container tests remain in place.

## What the harness establishes

The loopback service uses the real catalogue media route, bounded HTTP reader
and compact range engine. Only raw RPC responses and the synthetic retained-key
resolver are injected. The Host case uses the actual native adapter with an
injected SDK block source. Progressive native cases require no HTTP recovery;
four compatibility reads may saturate the unchanged two-SDK budget and use only
the matching registered-format API path. External HTTP, archive block reads and
archive/pack/marker URLs are refused by the tests.

PCM samples and the WebRTC guest meter add evidence that a moving clock alone
could not provide. The public fixture key is supplied directly: these checks do
not exercise real wallet/Host identity or production entitlement delivery.
Reproduction and exact scope are in the
[quality gate procedure](../../../operations/dev-quality-gates.md#compact-aac-acceptance)
and [delivery reference](../../../reference/bulletin-compact-delivery.md#automated-codec-acceptance).

## Remaining before activation

Cold transport reopening discards only in-memory caches; it is not durable
prepared-job repair, full off-volume graph restoration, nonce reconciliation or
rollback. The existing stopped-writer repair tool still refuses compact jobs.
Those recovery gates, native adaptation, physical Host/Room/background behavior,
real first-sound latency and hosted memory under work remain ahead. No live
admission, upload, renewal, key transfer, Bulletin/DotNS operation or service
change occurs. Recorded delivery stays 0.1.82 / custody #426; #407 stays open
before Room, artwork and CASH work.
