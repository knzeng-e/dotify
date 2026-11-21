# Host-info 0.1.89 — exact publication plan, 21 November 2026

The native qualification candidate is built and verified, but **not published**.
Explicit authorization of the operations below is pending after automatic
approval review refused the execution. No chain call or private signing was
performed. An isolated maintenance check and a custody-volume snapshot were
completed; the original machine configuration is restored with the old
publisher stopped.

This advances [#85](../backlog/polkadot-product-readiness-and-killer-dapp-roadmap.md)
before [#317](../backlog/fresh-testnet-streaming-cutover.md). The
[structured plan](host-info-0.1.89-publication-plan-2026-11-21.json) contains exact
CIDs, byte hashes, records, encoded native calls, nonces and caps. It is a review
record, not an executable approval or a delivery receipt. The reusable client
boundary remains in [Host-info qualification](host-info-qualification-client.md).

## Candidate and resulting behavior

| Identity | Prepared value |
| --- | --- |
| Source | `5de0b31e573e11b7d98e2d4717cbe6bce29ae6bf`, merged #504 |
| Product / executable | `dotify-test01.dot` / app `0.1.89` |
| Display name | Dotify qualification |
| SDK / Host SDK / TrUAPI | `0.45.0` / `0.34.0` / `0.31.0` |
| CAR | 270,940 bytes; SHA-256 `b741a1329e6f9c1d8d3b71d4e516b917573440edf90816545f5c4d7172d66ea0` |
| Storage CID | `bafybeib6pnxpldxmxn5efu5duzd2gv2iyoim3bnuvosehm3tpxqn2satzi` |
| Previous native app | 0.1.88; CID `bafybeielip24ywdkjeu6bvi47oqg4gevb5uoms4f3rapbjg2tnqx4gjop4` |

Publishing would replace the development Product's app entry with the isolated
reader. Opening it requests no account or transaction. Its explicit **Read app
information** action reads bounded public `system.info`; **Copy support report**
exports the actual observation and source/configuration identity. It contains
no catalogue, account, signer, chain adapter or Dotify API flow.

This is a qualification delivery, not a full listener release or promotion to
`main`. Ordinary Web, hosted APIs, artist runtimes, new key/profile activation
and CASH remain outside the operation. The retired catalogue is not imported
or reactivated as an automatic rollback.

## Exact chain scope and caps

Bulletin account: `5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca`.
The checked genesis is in the structured plan. At finalized block 1,747,073,
nonce is **2155**; authorization has **4,878 operations**, **877,471,678 store
bytes** and **865,438,038 renewal bytes** available, expiring at block 1,831,359.
These are observations, not guarantees for a later execution.

| Operation | Bytes | Kind |
| --- | ---: | --- |
| CAR header frame | 2,417 | New store |
| CAR application data frame | 265,926 | New store |
| CAR embedded manifest frame | 2,597 | New store |
| Outer storage root | 154 | New store |
| Existing icon | 35,949 | One renewal |
| **Maximum** | **307,043** | **5 operations** |

The five planned Bulletin nonces are **2155–2159**. There is no musical-write
allowance. Preserve the [carried retention floor](fresh-cdm-2026-11-21.md):
2,373 operations / 604,367,363 bytes before this candidate. The conservative
future floor after it is **2,378 operations / 604,674,406 bytes**, including the
reused icon again. This does not activate a renewal scheduler.

DotNS uses that account's mapped H160
`0xe3e3a0916d27c5174313f16e1507a286985a8ac8` on Paseo Asset Hub, with observed
native nonce **502**. Two planned signatures, nonces **502–503**, each submit
`Utility.batch_all(setText, setContenthash)` to the verified content resolver:

1. `dotify-test01.dot`: qualification manifest and new storage CID.
2. `app.dotify-test01.dot`: app version `[0,1,89]` and the same storage CID.

Each contract call transfers **zero value**. Native decimals **10** and
`Revive.NativeToEthRatio = 100000000` were checked. Quote-only estimates are
**0.0106022823 + 0.0065471955 = 0.0171494778 test PAS**. The finite limits are:

| Bound | Maximum test PAS |
| --- | ---: |
| Fee estimate admitted per signature | 0.05 |
| Fees admitted for both signatures | 0.10 |
| Storage-deposit limit per inner call | 1.00 |
| Aggregate storage-deposit limits, four calls | 4.00 |
| Aggregate declared deposit and fee exposure | 4.10 |

Storage-deposit limits are ceilings, not an estimate that 4 PAS will be spent.
Actual finalized debit and records must be read back. The testnet publisher is
an infrastructure account; this does not create an artist runtime or use the
owner's selected Polkadot artist account.

## Guards and prepared evidence

The source tree matches the fully tested PR head `e92f6d27`. The
[merged-source quality run](https://github.com/knzeng-e/dotify/actions/runs/44931601058)
is green. Clean compilation, two profile guards and 20 focused unit tests pass.
The packaged CAR has ten verified internal blocks; all seven packaged files
and five outer Bulletin blocks were compared byte for byte. The original five
served assets retain their build-manifest hashes.

Two operator guard tests reject changed calls, genesis, nonces, value, deposit
or weight limits. The actual custody Node/dependency graph reports
`ready-no-signing`, including both native fee quotes. PAPI 3 byte formats and
mock-signature fee estimates were verified without loading a private signer;
the exact native calls round-trip unchanged. The signer-free control binds the
installed publisher profile hash and preserves existing metadata, permanent
encryption nonce history and admission archives.

Snapshot `vs_3j5m0LmzyeVf9zxqVj0O` is completed with 14-day retention. A text-only
snapshot response was reconciled against before/after provider inventories
without creating another snapshot. SFTP ownership and PAPI 3 input-format
issues stopped the preparation before key loading; corrected unsigned operator
copies were retained. The old publisher remains stopped.

## Authorization and post-publication gates

Automatic approval review rejected the attempted execution because paid,
irreversible blockchain writes that publish/modify a service had not received
explicit authorization for this exact operation. The execution command did not
start. Approval must name this candidate and the bounded scope above; merging
this plan alone does not execute it.

After approval, repeat fresh Host configuration, ownership, quota, nonce and
unsigned private-state checks. A hash-bound, short-lived permit admits only the
reviewed calls. Every signing intent is durably recorded before one signature;
unknown outcomes stop for reconciliation without automatic resubmission. Restore
the original machine configuration with the old publisher stopped afterwards.

Then independently verify finalized storage receipts, all block bytes, the CAR,
DotNS owner/text/content hashes and actual served version/source. Only that
named native delivery can precede the [iPhone procedure](../how-to/qualify-product-host-031.md).
Actual Host info, account mapping, artist-signed onboarding, matched services and
native value/media acceptance remain open. No phone action is requested yet.
