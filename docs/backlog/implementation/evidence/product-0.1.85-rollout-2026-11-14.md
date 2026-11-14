# Web/Product 0.1.85 delivery — 14 November 2026

**Published and independently verified; matching physical acceptance is pending.**
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

## Next device acceptance

Use the existing Free **Adang Fobe** without a wallet on iPhone: hear at least
one minute in solo, open one Room, preserve explicit Pause during preparation,
then hear explicit Play at updated Web/Desktop guests and during a short lock.
Copy the local support report before retry/reload, for success as well as failure.
Record preparation time and distinguish the first session attempt, a warm retry
and unknown Host/upstream cache state; never label an unmeasured cache as cold.
The [measurement guide](../../../how-to/measure-room-startup.md) defines the
comparable reporting and broader repeated/full-track gate.

#395 remains open. Earlier 0.1.84 short checks and the later failed follow-up are
historical observations, not acceptance of 0.1.85. Artwork #388, publication
latency #407, access/value-flow and public-pilot gates remain separate; the
owner-deferred real independent recovery stays deferred.
