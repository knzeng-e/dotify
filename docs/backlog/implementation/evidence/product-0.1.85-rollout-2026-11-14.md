# Web/Product 0.1.85 delivery — 14 November 2026

**Published and independently verified; partial phone acceptance, initial Room startup still fails.**
Web and `dotify-test01.dot` serve frozen source `02ae5b31d2abb5e54d58201c4976f9dc4800e8f2`, based on tested
dev `26e3b5956bd53d56c42ef458fb547de2fef3fb75` after #469. The only tracked packaging change is appVersion
`[0,1,85]`. Refs #395. [Structured public evidence](product-0.1.85-rollout-2026-11-14.json)
records artifact identities and aggregate results; private inspection reports,
journals, fingerprints and keys remain outside Git.

## Listener behavior and the remaining limit

The [matched Free-track diagnosis](free-room-loading-2026-11-14.md) identifies
successful walletless authorization but slow legacy IPFS segment delivery on
0.1.84. This delivery overlaps at most two managed authenticated segment reads,
keeps ordered appends and native demand/seek ownership, and gives waiting solo
relay reads priority over background Room preparation. The ciphertext cache
retains its 4-MiB bound with a five-minute / 128-entry cap. Authorization and
per-object authentication still apply; it contains no clear audio or key.

The Room failure distinguishes an authorized loading timeout from an access
refusal and records the terminal timeout locally. Free listening keeps its
walletless policy. These changes preserve the 60-second post-access deadline,
40-MiB compatibility limit and existing two-body API relay capacity. A genuinely
cold complete iOS compatibility rendition can still exceed that deadline on a
slow connection. This delivery is not a measured latency gain or proof of a
fully resolved phone failure. Reusable behavior lives in
[Continuous listening](../../../explanation/continuous-listening.md#adaptive-delivery).

## Exact artifacts and readback

[Parent dev quality](https://github.com/knzeng-e/dotify/actions/runs/43589080994),
[exact candidate quality](https://github.com/knzeng-e/dotify/actions/runs/43600307016),
[unsigned release validation](https://github.com/knzeng-e/dotify/actions/runs/43600315669)
and [Host/DotNS configuration](https://github.com/knzeng-e/dotify/actions/runs/43600325712)
pass. Node 22.23.5 builds locked dependencies from a clean Product checkout.
Offline checks authenticate 100 CAR blocks, byte-compare
72 reconstructed files and verify all 20 outer objects.

- Application root: `bafybeidqk4zg5dvmvx5vu7rvnlb4gdiyiic2gyegxgzuq4nvpgyzmgyxva`.
- CAR SHA-256: `5dd7753d7bb30e395a3c9eb4a7965059d4394d026ac986c9b23e1b111e685ad8`.
- Actual use: **12 stores, 8 one-off renewals,
  9,513,792 application bytes, 2 DotNS signatures**,
  zero musical writes. Each exact object is charged once.
- Independent finalized readback authenticates and byte-compares all 20 outer
  objects and verifies retention at Bulletin block **1644858**, with
  earliest expiry **1846336**. Root/app records bind the same
  content and reviewed appVersion; the separate lab remains 0.3.1. This is a
  point-in-time observation, not automatic conservation.
- Retain **2,311 future operations / 575,811,391 bytes**
  conservatively, including previous obligations. No future write is authorized here.

The owner publishes Netlify from the same commit and existing settings.
All 20 served files / 1,855,135 bytes match an independent
same-source reconstruction. Hosted `clean=false` metadata is reproduced with a
non-code untracked marker in a separate checkout; tracked source is unchanged
and the marker is removed. Entry `./assets/index-BzIHRJAy.js` has SHA-256 `f78f50a50b6b961ee0c339c6bff15e48b421574f3d3660284ffc9ef785630529`.
The 390×844 shell opens without JavaScript errors or sensitive account/upload/key
requests, with mutating methods blocked. Shell/byte checks do not establish
native audible playback or wallet approval.

## Maintenance and trust boundary

The owner authorizes this exact new app budget and a temporary exclusion of
custody from the shared storage account. The same custody machine is running and
idle; the conditional isolated waiting-process diagnostic is not needed. A fresh
inspection confirms no active/uncertain work before one same-machine stop.
Every signing intention binds the exact graph, call, chain and nonce. A failed or
uncertain result stops the operator for reconciliation rather than automatic replay.

After independent object and finalized-DotNS readback, the same custody machine
restarts once with source `91f25c77ddb117f97bba4b7808a7ad2fb4b8e244` and its unchanged
[previously delivered server image](service-security-rollout-2026-11-14.md).
The first post-start read-only verification is unavailable. A subsequent state
read confirms the machine started; verification-only checks then obtain
health/readiness 200 twice with unchanged protected metadata/permanent nonce
fingerprints. No second start or configuration change occurs; the first failed
observation does not establish a service fault or its cause. The local signer
variable is absent and this version's write authority is consumed. The public API version endpoint still
identifies the same `91f25c77` source.

No API/custody/encoder/signaling image, key, admission, musical asset, access
policy, Host/SDK setting, compact selection or CASH capability changes. No
recurring renewal or real recovery rehearsal is activated.

## Owner phone result — 14 November 2026

Responding to the requested walletless iPhone / Adang Fobe protocol, the owner
reports **Polkadot app 0.10.0 (20)** and continuous solo listening. The first Room
attempt shows **“Room audio is taking too long”** after approximately one minute,
with preparation displayed at **99%**. A second opening of the same track becomes
ready quickly. After that retry, Pause is respected and guests/phone locking are
reported OK under the requested Web/Desktop and 15–30-second protocol. Per-guest
results and actual lock duration are not separately restated.

This accepts the reported solo and successful-retry continuity, not initial
no-retry Room startup. The quick second attempt is consistent with the deployed
bounded in-memory ciphertext cache. It is not proof of a persistent 99% clear-audio
checkpoint: cancelled collection is discarded, and reuse must still pass access
checks and authenticate its objects. The first attempt's cache state and network
conditions are unknown, so it is not a controlled cold benchmark or a measured
before/after speedup.

The displayed percentage counts collected authenticated media bytes. It does not
prove that every object, MP4 assembly and native readiness has finished. Without
a matched failure trace, the 99% observation does not identify a specific slow
object or prove which final preparation phase missed the deadline.

### Received report: successful preparation from another session

The subsequently supplied report identifies the exact `02ae5b31` build and iOS
Polkadot App 0.10.0 (20), observed at `2026-11-14T15:54:53.053Z`. Its Room
preparation attempt 2 authorizes access in **164 ms**, finishes collection at
**2,134 ms** and produces the compatible source at **2,137 ms**, measured from
that preparation attempt's start. It reads/authenticates 51 objects / 2,404,018
encrypted bytes: ten cached, 28 through the Host and 13 through HTTP recovery.
The Host category is specifically the native Bulletin transport label; the
redacted report does not identify the selected release. The maximum completed
read is 525 ms. Work totals overlap; they are not additional
wall time. Handoff attempt 3 reauthorizes/reuses the prepared source in 366 ms.
The report also records PNG metadata publication at 53 ms and successful native
playing events; these are not acoustic proof.

There is **no timeout or minute-long Room preparation in this trace**. The owner
confirms it comes from **another listen/session afterwards**. It therefore does
not measure the first failed attempt or its immediate retry. Keep the directly
reported failure open and this successful trace separate: it cannot identify
the slow final object, establish the cause of the 99% failure, or turn a partially
cached preparation into cold-start acceptance. No reproduction is requested just
to replace the missing trace; if the failure recurs, copy its report before retry
or reload.

## Remaining gate and next task

Keep #395 open for the first-attempt failure and comparable repeated/full-track
startup. Inspect the matched first-attempt/retry phases and reduce the remaining
collection/assembly/native-readiness bottleneck while preserving access checks,
current deadlines, media limits and explicit Pause. Do not treat a warm retry as
initial startup acceptance or extend the timeout merely to relabel this failure.
The [measurement guide](../../../how-to/measure-room-startup.md) defines comparable
reports. Earlier 0.1.84 results retain their dated scope. Artwork #388, publication
latency #407 and access/value/public-pilot gates stay separate; real independent
recovery remains owner-deferred. No new deployment or storage authority is granted.
