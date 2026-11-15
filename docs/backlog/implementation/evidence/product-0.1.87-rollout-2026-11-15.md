# Web/Product 0.1.87 delivery — 15 November 2026

**Published and independently verified; matching phone latency acceptance remains open.**
Web and `dotify-test01.dot` serve frozen `1d3ce02820983614c2e14da888883520f2e60586`, based on tested dev
`54beb9263964e208c557bef0ba5dd2f2a5660af8` after #473. The only tracked packaging change is appVersion
`[0,1,87]`. Refs #395. The [structured public evidence](product-0.1.87-rollout-2026-11-15.json)
contains allowlisted identities and aggregate checks. Private inspection reports,
publication journals, protected-state fingerprints and keys remain outside Git.

## What listeners receive

The [complete-read scheduling correction](room-preparation-read-scheduling-2026-11-15.md)
keeps Room preparation moving while an earlier fragment waits. Each completed
read frees one of the existing four workers to claim another fragment; verified
results retain their positions and the complete sound is assembled in order.
Progress counts completed authenticated bytes, including out-of-order results.
Failure or cancellation discards partial output and aborts sibling work.

This boundary fits complete-file preparation, which already retains the entire
rendition. Increasing concurrency or extending the timeout would change the
resource contract without fixing the reproduced scheduling gap. Progressive
solo playback keeps its ordered pipeline. Authorization, authenticated objects,
the two-body HTTP relay, solo priority, 40-MiB rendition cap and 60-second media
budget remain. The reusable contract lives in
[Continuous listening](../../../explanation/continuous-listening.md#adaptive-delivery).

The controlled 72-object model completes in ten seconds with the correction;
the parent has started only six requests at that time. This is a synthetic
scheduling result, not a phone speedup. The [0.1.86 matching phone observation](product-0.1.86-rollout-2026-11-14.md#matching-phone-follow-up)
records one successful first opening with Pause and audible guests through a
short lock, but preparation still takes 33.153 seconds (owner timer: about 29 s).
Its partially cached state and unknown upstream cache conditions preclude a cold
benchmark claim. That earlier result does not establish acceptance of 0.1.87.

## Exact delivery and independent checks

[Parent dev CI](https://github.com/knzeng-e/dotify/actions/runs/43659962876),
[exact candidate CI](https://github.com/knzeng-e/dotify/actions/runs/43660270481),
[unsigned Product validation](https://github.com/knzeng-e/dotify/actions/runs/43660273426)
and [Host/DotNS alignment](https://github.com/knzeng-e/dotify/actions/runs/43660276137)
pass. Locked dependencies build with Node 22.23.5; fifteen focused collector/relay
tests pass on the frozen release source. The code checkpoint records 1,217 unit
tests and 16 Chromium/WebKit synthetic AAC/crypto cases, including held-fragment
collection, playable ordered output, denial, cancellation and explicit Pause.
These checks do not establish native audible or background behavior.

- Application root: `bafybeieibeevlfoy4pad45aqjr5jc3e6a6qvhwly5fxhtssirwczyvj4su`.
- CAR SHA-256: `62ae14b5132c3391d1e785a58afd5a31e897a23699068ea54dff6165ecddc8cc`; offline reconstruction authenticates
  100 CAR blocks and byte-compares 72 files.
- Actual use: **12 stores / 8 one-off renewals,
  9,514,220 application bytes and 2 DotNS signatures**,
  one operation per exact object and zero musical writes.
- Independent readback byte-compares all 20 outer objects and
  verifies finalized retention at Bulletin block **1651455**;
  earliest expiry is **1852916**. Root/app DotNS records bind
  the same root and appVersion; the separate lab stays 0.3.1.
- Retain **2,351 future operations / 594,839,528 bytes**
  conservatively. This record grants no future write or automatic renewal.

The owner publishes Netlify from the same source and existing settings. All
20 served files / 1,855,563 bytes match
the independent reconstruction. Hosted `clean=false` metadata is reproduced
with a non-code untracked marker in a separate checkout, then the marker is
removed. Entry `./assets/index-2Kg1HyNX.js` has SHA-256 `dfe6b42675f8e820e1d98fa0705fa6b5c54e4f1c0dd431157df7de37f5c1b4b3`. The 390×844 shell opens
without JavaScript errors or sensitive account/upload/key requests; mutating
methods are blocked. This proves served identity and shell behavior.

## Maintenance and trust boundaries

The owner approves the exact app budget and temporary custody exclusion from
the shared storage account. Fresh private metadata inspection finds no active
or uncertain work; protected-state and obligation fingerprints match the prior
completed delivery. Custody is initially running, so the conditional isolated
waiting-process diagnostic is not used. One same-machine stop precedes writes.
Signing intentions are persisted before signing and bound to the exact graph,
call, chain and nonce; an uncertain outcome stops automatic replay.

After independent storage/retention and finalized-DotNS verification, the same
machine restarts once with unchanged image/settings and server source `91f25c77`.
Health/readiness return 200 twice, and protected metadata/permanent nonce
fingerprints are unchanged. The first post-start read-only health observation
is unavailable; a later
machine observation and verification-only health/state checks pass without a
second start. The cause of that initial unavailable observation is not established.
The public API still identifies the previously delivered server source.
The local signer variable is absent and
this version's write authority is consumed.

No server image, key, admission, musical budget, access policy or Host/SDK setting
changes. Compact/CASH activation, automatic renewal and the owner's deferred real
independent recovery remain outside this delivery. Existing artist assets remain.

## Next acceptance

On the iPhone, verify 0.1.87 and use an existing Free track without a wallet.
Open one Room, record preparation time and Pause during the wait, then explicitly
play with audible Web/Desktop guests through a short phone lock. Copy that
attempt's support report before retry or reload, whether it succeeds or fails.
Keep first attempts distinct from warm retries and record unknown cache state
honestly. A report from another session cannot explain a failed attempt.

#395 remains open for comparable starts without retry and audible continuity;
the [measurement guide](../../../how-to/measure-room-startup.md) defines the
broader repeated/full-track gate. Artwork, publication latency, access/value-flow
and public-pilot acceptance remain separate; real recovery stays owner-deferred.
