# Exact release allowance candidate, 2026-11-10

Refs #407. Branch starts at merged dev `56831993` (#421), whose source tree has
green PR checks. Custody remains `ec8e82ae`, Web/Product/API 0.1.82. No live
extension, service mutation, musical write or key change occurs in this candidate.

## Why this is the next step

The owner selected a different 1:37 source and its cover, under the existing
Lord Ékomy Ndong artist account. Both original release slots are claimed, and
completing the other prepared source would repeat audio already published by the
other artist. The next useful timing sample therefore needs new bounded capacity.

[ADR 0048](../../../adr/0048-exact-release-admission-extension.md) adds that
capacity for one exact source identity, preserving the existing key domain and
permanent journals. It avoids a new key installation or a queue migration just
to conduct the measurement. A merge makes the mechanism reviewable; it grants
no live capacity or musical spending authority.

## Measured local sizing

Owner-provided source: PCM WAV, stereo 44.1 kHz, 16-bit, 17,045,850 bytes;
probe duration 96.623379 seconds (encoded manifest 96.6). Original cover:
507,933 bytes. No artist file is committed to the repository.

| Local graph | Blocks | Bytes |
| --- | ---: | ---: |
| Encrypted audio, including original archive and three renditions | 151 | 24,289,541 |
| Cover, original and responsive variants | 10 | 631,528 |

Three AAC renditions contain 25 segments each. The codec runs in an isolated
local Linux arm64 image without network; graph/cover sizing uses the existing
custody Linux amd64 image. A synthetic one-off key/nonce reservation is used only
for size calculation, with no production key read or publishable ciphertext.
Local codec time was 14.6 seconds. Emulated graph/encryption time is not server
performance evidence, and production codec output may vary. Metadata is not fixed
until the artist supplies ordinary release details; its inherited cap remains.

A single grant inherits the immutable profile's full caps: audio 320 attempts /
64 MiB; cover 32 / 8 MiB; metadata 4 / 64 KiB. **Total added ceiling: 356 attempts /
75,563,008 bytes**, not a claim that all will be used. Preserve prior obligations
before any activation. The private sizing/checkpoint package retains source
fingerprints and observed quota; public docs do not publish content references.

## Validation and remaining gates

The focused regressions cover stopped-writer exclusion, exact-source isolation,
original-slot preservation, unchanged queue/profile/nonce files, replay refusal,
archive-first interruption, missing/altered lineage, later grants, original part
caps and competing maintenance. Existing v1 admission remains covered by the
original tests. A CLI subprocess with invalid/unavailable production vault
configuration still inspects successfully, proving it does not import that
configuration. Queue/binding schemas are extracted unchanged for this boundary;
the runtime retains compatible exports. **399 API tests pass** (42 suites),
with typecheck/build, formatting, local links, whitespace and offline backlog
checks. The extracted schemas reproduce the current production profile binding
from previously retained metadata. No fresh production journal replay is claimed;
state transitions are tested with synthetic fixtures, and live activation
inspection remains a separate gate.

After review/merge and green CI: prepare the immutable custody image and a
current stopped-state request, refresh canonical non-registration, quota and
retention reserve, then request the concrete maintenance and musical budget.
No local signer is needed for preparation. Artist registration remains explicit
in the wallet. Capture publisher stages with #421 and separately record upload,
encoding, wallet and catalogue intervals. Do not sum overlapping phase totals or
claim an end-to-end speedup from the local sizing run. #407 stays open before
#395 → #388 → #406 → #408.

## CI follow-up: deterministic local WebRTC route

At head `236af7b1`, run 42722466005 passed API/typecheck, Web, Product, contracts
and storage checks; core Playwright passed 330/331. The failure was the initial
440 Hz receiver check in the no-native-capture continuity case. Trace diagnostics
show real offer/answer delivery and a playing host, but both peers stayed `new`;
the receiver track remained muted and its running analyser measured zero. The
host's trickled candidate used a `.local` mDNS name; the listener emitted none.
This points to local ICE establishment, not changed Bulletin allowance behavior.

The Chromium test project now disables `WebRtcHideLocalIpsWithMdns` only in its
launch configuration. These synthetic peers share one runner, already use no
public STUN/TURN and must use direct host routes. Chromium's
[feature definition](https://chromium.googlesource.com/chromium/src/third_party/+/2d844f13ecf60a170083f75046cdc8192a5401ca/blink/common/features.cc)
explains the address-obfuscation layer; removing that resolver dependency from
this local harness leaves real ICE/DTLS/RTP and decoded-tone checks intact.
Production browsers, Host permissions, TURN and application audio code are
unchanged. This does not verify real-device mDNS connectivity.

The continuity regression also requires real local candidates without `.local`
on both peers; the old configuration fails this assertion locally, while its
original two sound cases can pass locally. Peer failure reports now include ICE,
gathering and signaling states and candidate counts, without new address fields.
Existing tone deadlines, frequency tolerances and no-automatic-retry policy are
unchanged. Local join/sync/continuity: **17 passed**; five repeats per continuity
variant: **10 passed**. Web lint has no errors (two pre-existing App hook warnings);
format, whitespace and backlog checks pass. Updated CI is running; its result
remains separate from this local evidence.
