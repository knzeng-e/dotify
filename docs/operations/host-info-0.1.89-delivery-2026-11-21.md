# Native Host-info 0.1.89 delivery — 21 November 2026

**Published and independently verified; physical Host qualification is pending.**
`dotify-test01.dot` now publishes the isolated **Dotify qualification** app
`0.1.89` from merged source `5de0b31e573e11b7d98e2d4717cbe6bce29ae6bf` (#504).
This temporarily replaces the native development listener with the public
Host-info reader. Ordinary Web and hosted APIs are unchanged; the retired
custody publisher remains stopped.

Refs [#85](../backlog/polkadot-product-readiness-and-killer-dapp-roadmap.md) and
[#317](../backlog/fresh-testnet-streaming-cutover.md). The
[structured receipt](host-info-0.1.89-delivery-2026-11-21.json) allowlists the
actual artifact, finalized chain receipts and independent checks. Private
journals and protected-state fingerprints remain outside Git. The
[client reference](host-info-qualification-client.md) owns the reusable behavior;
this record does not infer an actual iPhone Runtime from source configuration.

## Published identity and checks

| Observation | Verified value |
| --- | --- |
| Product / executable | `dotify-test01.dot` / `[0,1,89]` |
| SDK / Host SDK / TrUAPI | `0.45.0` / `0.34.0` / `0.31.0` |
| Storage CID | `bafybeib6pnxpldxmxn5efu5duzd2gv2iyoim3bnuvosehm3tpxqn2satzi` |
| Inner directory CID | `bafybeiam34y7upkqah7e53hrimek44dfa3smkfsrf627j3slmmxek4n3wu` |
| CAR | 270,940 bytes; SHA-256 `b741a1329e6f9c1d8d3b71d4e516b917573440edf90816545f5c4d7172d66ea0` |
| Independent reconstruction | 5 outer blocks / 10 inner CAR blocks / all 7 files byte-compared |
| Bulletin operations | 4 stores + 1 icon renewal; 307,043 bytes total |
| Bulletin nonces | 2155 → 2160 |
| Earliest dependency expiry | Block 1,948,762 |
| Future retention floor | At least 2,378 operations / 604,674,406 bytes |
| Native DotNS signatures / nonces | 2 / 502 → 504 |
| Actual native fees / observed net debit | 0.0150967638 test PAS / the same amount |

The [full quality run](https://github.com/knzeng-e/dotify/actions/runs/44931601058)
passes on the exact merged source. Clean isolated compilation, profile/export
checks and Chromium/WebKit scenarios are source evidence. Independent public
reads later verify all five stored dependencies, reconstruct the frozen CAR,
and compare every logical file, including the embedded manifest and build
report. The build report identifies app `0.1.89`, `clean=true` and source
`5de0b31e`; its configuration digest is
`f4cfbb6b0af3776d7e5be22efaf962236dedc2c559c871e9519ee2dffa3ba024`.

Finalized root and app DotNS records bind the same new storage CID and exact
manifest/version. Their native extrinsics are
`0xec4227c009dbb45c23118bf3168a7732a2694c2280d4c230a36668ffb7063d39`
at block 16,046,764/index 2 and
`0x8bc6997b994e49912df829595440723c56b7e032647491e08d22b7a46d4f0eb1`
at block 16,046,782/index 2. An independent Substrate block read verifies both
extrinsic hashes and exact approved call bytes; this does not depend on EVM
transaction indexing. Canonical `TransactionPayment.TransactionFeePaid` events
for the same two extrinsic indices verify fees of 90,785,830 and 60,181,808 native units, with
zero tips. Their total matches the observed net debit and is below the approved
0.10 test-PAS fee cap. Ownership and the separate lab's 0.3.1 records are
unchanged. Fresh public Host configuration checks pass before and after.

## Scope, accounting and retained state

The owner explicitly approved the [exact plan](host-info-0.1.89-publication-plan-2026-11-21.md)
before the first signing intent. The earlier automatic-approval rejection did
not start its execution command; the later explicit approval resolved it.
The operation stayed within five Bulletin calls, two zero-value native batches,
0.10 test PAS admitted fee estimates and four 1-PAS storage-deposit limits.
The observed debit is the **net account balance change**; independently decoded
fee events account for the same amount. This does not infer gross storage
deposits or refunds. Those limits and the completed authority are not permission
for another write or recurring renewal.

An isolated maintenance process uses the installed infrastructure signer without
exporting its seed. The native publisher account is not the artist account
selected for later onboarding. Exact graph/call, genesis and nonce guards bind
every durable one-shot intent; all seven operations finalized once, with no
uncertain pending entry or extra submission.

Snapshot `vs_3j5m0LmzyeVf9zxqVj0O` is completed with 14-day retention. Before/after
checks preserve the publisher profile, old protected metadata, permanent
encryption nonce history and admission archives. The publisher lock is released,
the original machine configuration restored and the retired publisher stopped.
The data/key recovery and coordinated PostgreSQL/service switch remain separate
work; this snapshot does not establish those acceptance gates.

No music, artist runtime, new publisher/key profile, hosted API, Netlify client
or CASH activation is included. The previous CID remains historical evidence;
returning its retired catalogue to active service is not an automatic rollback.

## First device handoff

In **Polkadot Dev on the iPhone**, close and reopen Dotify; if needed use
**Debug → Open SPA → `dotify-test01.dot`**. The page must show **Host
qualification** and footer **Source `5de0b31e` · clean build**. If it still shows
the listener or another source, report that mismatch and stop.

Tap **Read app information** once and retain **Copy support report**; the
selectable report is under **View support report** if copying fails. Check its
`build.appVersion: "0.1.89"` and exact source/configuration identity. No account,
signature, transaction or music playback is needed.

Follow the [device procedure](../how-to/qualify-product-host-031.md) for actual
values and failure handling. A real source-bound `system.info` observation is
the next gate. Account mapping, fresh-factory artist approvals, matched services,
native beneficiary settlement and protected listening/Room acceptance remain
open. Publishing this reader accepts none of those journeys.
