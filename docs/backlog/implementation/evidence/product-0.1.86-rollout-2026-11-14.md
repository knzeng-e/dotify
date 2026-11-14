# Web/Product 0.1.86 delivery — 14 November 2026

**Published and independently verified; one matching phone check passes, startup latency remains open.**
Web and `dotify-test01.dot` serve frozen `61f4a45214b261adcf2696c12ea30c021294ab7e`, based on tested dev
`fd56e16dae463b31b2ef54eef851e2b2399b51f9` after #471. The only tracked packaging change is appVersion
`[0,1,86]`. Refs #395. [Structured public evidence](product-0.1.86-rollout-2026-11-14.json)
contains allowlisted artifact identities and aggregate checks; private inspection
reports, publication journals, protected-state fingerprints and keys stay outside Git.

## What listeners receive

The [queued-read correction](queued-room-ciphertext-reuse-2026-11-14.md) checks the
existing ciphertext cache again after a Room request obtains a relay slot. If
solo finished that object while Room waited, the queued request reuses it instead
of downloading it again. The controlled regression uses two HTTP requests for
two objects, previously three. Per-purpose authorization and object authentication
still apply; a different authenticated length cannot accept the cached object.

The same cache bounds, two-body relay capacity, solo priority, fallback order,
media limits and deadlines remain. Already active duplicate requests are not
coalesced. Reusable behavior lives in [Continuous listening](../../../explanation/continuous-listening.md#adaptive-delivery).

This is not a diagnosis or measurement of the owner's first 0.1.85 failure at
99%. That failed attempt has no matched support report; the received successful
2.14-second report belongs to another session. The [0.1.85 record](product-0.1.85-rollout-2026-11-14.md)
keeps those observations separate. No phone startup gain is established by this
delivery; a complete iOS preparation may still be slow on a cold/slow path.

## Exact delivery and independent checks

[Parent dev CI](https://github.com/knzeng-e/dotify/actions/runs/43622825346),
[exact candidate CI](https://github.com/knzeng-e/dotify/actions/runs/43636572546),
[unsigned Product validation](https://github.com/knzeng-e/dotify/actions/runs/43636575400)
and [Host/DotNS alignment](https://github.com/knzeng-e/dotify/actions/runs/43636578632)
pass. Locked dependencies build with Node 22.23.5; seven focused concurrency/read
tests pass on the release source. Offline reconstruction authenticates
100 CAR blocks and byte-compares 72 files.
The CI and implementation evidence cover bounded reads, AAC, access denial and Pause;
these browser checks do not establish physical audible or lock-screen behavior.

- Application root: `bafybeicycuewhk7nralp5io3rire75abaug7klkb42f5ueqopoj7ojcp5q`.
- CAR SHA-256: `c502063ea90030484ffb0e815fe817de57ea7f5d993b14e7c31b209e09f63886`.
- Actual application use: **12 stores / 8 one-off
  renewals, 9,513,917 bytes and 2 DotNS signatures**,
  one operation per exact object, zero musical writes.
- Independent readback byte-compares all 20 outer objects and
  verifies their finalized retention at Bulletin block **1648725**;
  earliest expiry is **1850186**. Root/app DotNS records bind
  this same root and appVersion; the separate lab stays 0.3.1.
- Retain **2,331 future operations / 585,325,308 bytes**
  conservatively. This record grants no future write or automatic conservation.

The owner publishes Netlify from the same source and existing settings. All
20 served files / 1,855,260 bytes match the
independent same-source reconstruction. Hosted `clean=false` metadata is reproduced
using a non-code untracked marker in a separate checkout, then the marker is removed.
Entry `./assets/index-BDaRjPsG.js` has SHA-256 `d6f07d7fb9e45525af885973a884644e6889a9839f761b4d2d4f3242692b4284`. The 390×844 shell opens without
JavaScript errors or sensitive account/upload/key requests; mutating methods are
blocked. This proves served identity and shell behavior, not a native listening test.

## Maintenance and trust boundaries

The owner authorizes this exact app budget and temporary exclusion of custody
from the shared storage account. Fresh private metadata inspection finds no
active or uncertain work and preserves the preceding completed delivery's
protected-state and obligation fingerprints. Custody is initially started;
the conditional isolated waiting-process diagnostic is not used. One same-machine
stop precedes the writes. Every signing intention is journaled before signing and
bound to the exact graph, call, chain and nonce; uncertainty stops automatic replay.

After independent storage/retention and finalized-DotNS readback, the same machine
restarts once with the unchanged server image/source `91f25c77`. Its health/readiness
return 200 twice and protected metadata/permanent nonce fingerprints stay unchanged.
The first post-start read-only health observation is unavailable; a subsequent
machine read confirms it is started and verification-only checks pass. No second
start or configuration change occurs, and the cause of that first unavailable
observation is not established.
The local signer variable is absent and this version's write authority is consumed.
The public API still identifies the previously delivered server source.

No server image, key, admission, musical budget, access policy or Host/SDK setting
changes. Compact/CASH activation, automatic renewal and the owner's deferred real
independent recovery remain outside this delivery. Existing artist assets stay in place.

## Matching phone follow-up

The owner reports a first Room opening ready in approximately **29 seconds**, with
Pause respected and audible guests during the requested short phone lock, on
Polkadot app **0.10.0 (20)**. The accompanying report identifies this exact
`61f4a452` build and was observed at `2026-11-14T22:31:51.505Z`. The requested
context is existing **Adang Fobe** without a connected wallet; those contextual
names come from the protocol/feedback, not from redacted diagnostic identities.

The matching trace records one Room preparation (attempt 2, read attempt 1):

| Observation                                 | Value and scope                                           |
| ------------------------------------------- | --------------------------------------------------------- |
| Owner's approximate opening time            | 29 s; keep separate from instrumentation                  |
| Authorization                               | 169 ms                                                    |
| Authenticated manifest ready                | 170 ms                                                    |
| Complete rendition downloaded/authenticated | 33,142 ms                                                 |
| Prepared compatibility source ready         | 33,153 ms; local assembly adds 11 ms                      |
| Objects / encrypted bytes                   | 73 authenticated objects / 3,580,693 bytes                |
| Read sources                                | 16 cached, 57 HTTP, zero native Host or recovered objects |
| Completed read work                         | 100,431 ms aggregate, overlapping work; not wall time     |
| Longest completed read                      | 11,547 ms, including admission/retry/body waiting         |
| Authentication work                         | 39 ms aggregate                                           |

The human timer and instrumented preparation boundaries differ; neither replaces
the other. Complete object reading dominates this captured preparation, while
access and local assembly are short. The trace cannot isolate pure network
latency from relay scheduling or internal retry/body waits. It does not establish
the exact cause of each slow read.

Attempt 3 reauthorizes and reuses that completed source in 176 ms; this is the
normal handoff, not another Room opening or a user retry. Native metadata follows
source selection by 159 ms. The replacement stays paused at the existing position
until the subsequent playback intent, consistent with the owner's Pause result.
A hidden-to-visible interval lasts 34.95 s with approximately the same media-clock
advance. The owner confirms audible guest/lock behavior; clocks alone are not
acoustic proof. Artwork metadata is published as composed PNG in 27 ms, which
does not establish native lock-screen image rendering in this feedback.

This is one successful matched first opening, **not a cold benchmark or a
controlled before/after speedup**. Manifest, init and the first fourteen segments
are already cached; other Host/upstream/network conditions are unknown. It neither
explains the earlier 0.1.85 99% failure nor proves repeated/full-track readiness.
The original delivery-time `physicalAcceptance` JSON snapshot stays unchanged;
`physicalAcceptanceFollowup` records this later observation separately.

## Remaining work

#395 stays open. Reduce complete-rendition read/transport/scheduling latency next,
while preserving the existing access, memory/concurrency/cache and deadline
boundaries. Collect comparable repeated starts, including failures, before
promoting latency acceptance; the [measurement guide](../../../how-to/measure-room-startup.md)
defines that gate. Do not lengthen the timeout to relabel a slow start as fixed.
Artwork, publication latency, access/value-flow and public-pilot gates remain
separate; real independent recovery stays owner-deferred.
