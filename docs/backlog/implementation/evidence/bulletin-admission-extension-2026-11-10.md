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
