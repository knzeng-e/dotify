# Web/Product 0.1.86 delivery — 14 November 2026

**Published and independently verified; matching phone startup acceptance remains open.**
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

## Next acceptance

On the iPhone, use an existing Free track without a wallet, hear solo playback,
then open one Room and record preparation time, explicit Pause and audible guests
through a short phone lock. Copy the corresponding local support report before
retry or reload, whether successful or failed. A later session's report cannot
explain an earlier failure. Preserve first-attempt and warm-retry distinctions;
native/upstream cache state may be unknown and must not be labeled cold by assumption.

#395 remains open for comparable starts without retry and audible continuity.
The [measurement guide](../../../how-to/measure-room-startup.md) defines the broader
repeated/full-track gate. Artwork, publication latency, access/value-flow and
public-pilot gates stay separate; real independent recovery remains owner-deferred.
