# Generated Bulletin resource envelope, 2026-11-12

## Source and scope

The owner confirms #440 merged. This next #407 slice starts from dev
`c0755beaa8f75ef63b70984df31712db2d4a4034`, whose tree matches green #440 head
`76d4f54134eed714bc560acbcde3c84ffeaf3e80`. It measures generated real AAC,
queue encryption, both graph constructors and authenticated reads inside the
existing API/encoder Docker images. No runtime production code or service
setting changes. The [canonical procedure](../../../operations/bulletin-resource-envelope.md)
owns reproduction, metric units, resource limits and interpretation.

The complete local four-case run binds implementation
`79d80a4879684bfb8ddd1d6c232000e3b37168b0`, clean tracked state. Follow-up
`80a875b4` requires the exact archive-path refusal using a valid playback byte
bound and adds that observation to the report. The PR records focused follow-up
validation and later exact-head Linux results without treating documentation
commits as new implementation evidence. Both focused 97-second cases pass on
`80a875b4` with exact archive-path refusal; that report marks pending tracked
documentation edits as dirty. The executable scripts were already committed.

## Local environment and observations

Linux/arm64 containers under Docker Desktop, Node 22.13.1 and Debian FFmpeg
5.1.9-0+deb12u1. The existing image builds are:

- API `sha256:8a70e818c48422d452198f988c51e1a1f25c1bb01ee65f514984394f319a63e7`;
- encoder `sha256:5d4144008c4115bf59bf5851428aa5f34fa7e9865ccb12d0f1a3241f757b45cf`.

Each case gets a fresh controller, encoder and synthetic volume. The controller
has 1 GiB, the encoder 512 MiB; both have one CPU, no swap and 64 PIDs. Both
execute as UID 1000 with read-only images, dropped capabilities and an internal
Docker network. No host directory or real secret is mounted or forwarded.

| Generated profile | Layout | Complete graph blocks | Graph bytes | Queue job elapsed, ms | Controller cgroup peak, MiB | Encoder cgroup peak, MiB |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 97 s / 9,312,044-byte WAV | Standard | 121 | 15,420,242 | 15,433 | 161.95 | 71.27 |
| Same source geometry | Compact | 77 | 15,417,299 | 16,556 | 175.02 | 71.03 |
| 900 s / 43,200,044-byte WAV | Standard | 850 | 96,057,727 | 154,351 | 565.39 | 255.92 |
| Same source geometry | Compact | 384 | 96,026,245 | 164,497 | 654.89 | 258.25 |

All four finish ready with an exact layout/reference, verified block CIDs,
authenticated archive **input**, cold-tail and full rendition reads. Neither
controller nor encoder records a cgroup `max`, `oom` or `oom_kill` event. No
container is OOM-killed. No Node GC flag or production limit is changed.

The compact layout has fewer blocks but a **higher observed controller
memory peak** here. Do not infer a RAM improvement, a publication speedup or an
ETA. Each run includes fixture generation/retained verification buffers and
cgroup cache/tmpfs charges; process RSS and cgroup memory are different metrics.
Single sequential observations are not an isolated comparison of graph memory,
and the API's ordinary HTTP, catalogue, relay, SDK and concurrent-upload traffic
is absent. The normal encoder is real; the pin sink and block source are local.

## Harness boundary learned during validation

The first local attempt (`5a10dac8`) incorrectly tried the archive through the
playback reader and failed before any measured case completed. That reader
intentionally excludes archive paths and large archive bounds. The harness was
corrected to authenticate the publisher's retained encrypted input and preserve
the playback exclusion. The follow-up asserts the exact `Unsupported media path`
refusal rather than accepting an unrelated bound/import error. No production
reader boundary was widened. Only generated fixture data was involved.

## Remaining acceptance

The four-case workflow retains a generated numeric report for seven days and
fails on an invalid bound, failed ready result, bad CID/authentication, OOM or
cleanup failure. No rehearsal source/helper is copied into the production image.
All cleanup is restricted to rehearsal-created objects; no global Docker prune.

This is a **local enforced-resource exercise**, not hosted capacity acceptance,
a full API/custody entrypoint, canonical rights verification, a live Bulletin
publication, real secret restoration or audible first sound. Existing
backup/version tests remain separate. Real independently stored backup/key
recovery, canonical history and service/image rollback, hosted peak memory under
actual traffic and physical Host/adaptation/Room/background remain #407 gates.

No live inspection, registry upload, service restart, admission/quota/key change,
artist file read/upload, Bulletin/DotNS operation, renewal or deployment occurs.
Recorded delivery stays Web/Product/public API 0.1.82 and custody #426; #407
remains Now / In Progress before Room → artwork → CASH.
