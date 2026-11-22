# Account 0.1.90 — exact native publication plan, 22 November 2026

**Prepared and not executed.** This plan makes the next #85 iPhone account
check reviewable after merged #506 and the accepted 0.1.89 Host-info record.
The [structured plan](host-account-0.1.90-publication-plan-2026-11-22.json)
binds exact artifact bytes/CIDs, native calls, nonces, maintenance and spend caps.
The [account-client reference](host-account-qualification-client.md) owns client
behavior, report privacy and the later device procedure. Refs
[#85](../backlog/polkadot-product-readiness-and-killer-dapp-roadmap.md) and
[#317](../backlog/fresh-testnet-streaming-cutover.md); both remain open.

## Frozen candidate and user experience

| Identity | Value |
| --- | --- |
| Source | `ecba4ea0465fba154de65a7db7232be62f854acb`, merged #506 |
| Product / app / purpose | `dotify-test01.dot` / `0.1.90` / `host-account-addresses-only` |
| Product SDK / Host SDK / TrUAPI | `0.45.0` / `0.34.0` / `0.31.0` |
| CAR | 387,429 bytes; SHA-256 `2a7605eb925f33779668103db1feea7b8c9b488517d22f61de7b19ef0a2fabcd` |
| Storage CID | `bafybeiasoflsyem37mufbzttqns7ayx4rdnr4vbtia6jdy4mpr6c4oegvi` |
| Inner directory CID | `bafybeicgazzxntx5xrduzgnkc2yjyufzg5twactvetcxfac5f5o6fxbsmu` |
| Replaced development entry | Delivered 0.1.89, CID `bafybeib6pnxpldxmxn5efu5duzd2gv2iyoim3bnuvosehm3tpxqn2satzi` |

Publishing would replace the native development info reader with the account
qualification page. Opening it requests no account. An explicit Host-info read
must report Runtime 0.31.x before **Share my Dotify account** is enabled. This
separate gesture requests Product `dotify-test01.dot`, index 0; local SS58/H160
addresses and an unchecked owner acknowledgement enter a public support report.
It creates no signer or runtime and contacts no chain, catalogue or Dotify API.
The infrastructure signer used to publish this page is not the user's later
artist account. Local derivation and owner choice are not native mapping or
signer-control proof. Ordinary Web, APIs, key/profile activation, music and CASH
stay outside this plan. This is not a listener release or a merge to `main`.

## Bulletin scope and conservation

The public finalized reading at block **1,759,397** finds account
`5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca` at nonce **2160**,
with 4,873 operations, 877,200,584 store bytes and 865,402,089 renewal bytes
available. Authorization expires at block 1,831,359. These observations must be
repeated before execution; drift stops the operation.

| Operation | Bytes | Action |
| --- | ---: | --- |
| CAR header frame | 3,021 | Store |
| CAR application data frame | 381,305 | Store |
| CAR embedded manifest frame | 3,103 | Store |
| Outer storage root | 154 | Store |
| Existing icon | 35,949 | Renew once |
| **Maximum** | **423,532** | **5 operations** |

The admitted nonces are **2160–2164**. Four application blocks are absent and
the existing icon has a valid receipt at block 1,747,182/index 0, expiring at
1,948,782. Keep the carried floor from the
[0.1.89 delivery](host-info-0.1.89-delivery-2026-11-21.md):
2,378 operations / 604,674,406 bytes. The conservative future floor becomes
**2,383 operations / 605,097,938 bytes**, counting this whole scope including
the reused icon again. No retention scheduler or musical allowance is enabled.

## Native DotNS scope and limits

The same infrastructure account maps to
`0xe3e3a0916d27c5174313f16e1507a286985a8ac8` on Paseo Asset Hub.
Two signatures at observed native nonces **504–505** would each submit exactly
`Utility.batch_all(setText,setContenthash)`:

1. `dotify-test01.dot`: qualification display manifest and new storage CID.
2. `app.dotify-test01.dot`: version `[0,1,90]` and the same CID.

Every inner Revive call transfers **zero value**. The exact resolver targets,
record strings, encoded SCALE calls and weights are in the structured plan.
Observed native precision is 10 decimals with NativeToEthRatio 100000000.
Unsigned estimates are **0.0106022823 + 0.0065471955 = 0.0171494778 test PAS**.

| Bound | Maximum test PAS |
| --- | ---: |
| Fee estimate admitted per signature | 0.05 |
| Fee allowance for both signatures | 0.10 |
| Storage-deposit limit per inner call | 1.00 |
| Aggregate storage-deposit limits, four calls | 4.00 |
| Aggregate declared fee/deposit exposure | 4.10 |

Deposits are ceilings, not an expected four-PAS debit. Repeat fee checks before
each native submission and independently decode finalized fee events afterwards;
record net account debit separately from gross storage/refunds. Unknown outcomes
stop for reconciliation, never an automatic duplicate submission.

## Preparation passed and blocked boundary

The merged tree matches the fully green PR head `f196cd73`. The exact merged
[quality run](https://github.com/knzeng-e/dotify/actions/runs/45035106617) is tracked
separately; it must pass before execution. The clean account build and rendered
graph guard pass on `ecba4ea0`. All seven served-asset hashes still match after
offline packaging; all twelve internal CAR blocks, nine packaged files and five
outer dependencies are byte/CID verified. No storage write is made.

Fresh public reads verify previous 0.1.89 root/app ownership/contenthash/records
and keep the separate lab at 0.3.1. Fresh Host configuration matches. Both
native calls round-trip exactly through local PAPI 3.3.0 and quote with a mock
signer that throws if a real signature is requested; all four store calls
encode. Two signing-boundary tests reject call/genesis/nonce/value/deposit/weight
drift. These local/public checks do not substitute for current custody checks.

**Automatic approval review rejected the temporary custody readiness command
before it started.** Its reason is that explicit 0.1.90 authorization is needed
for remote configuration/start changes, which risk disruption or incorrect
restoration. No staging or maintenance process ran remotely, no private signer
was loaded, and no blockchain call executed. Before/after provider reads show
the same original configuration and stopped state. Protected-state comparison
and actual custody-environment unsigned readiness remain pending.

## Requested finite maintenance and publication sequence

After explicit approval of this plan, repeat fresh Host, owner, quota, receipt
and nonce checks and require green CI for the frozen source. Create **one fresh
volume snapshot with 14-day retention** before the remote operation. The existing
completed preparation snapshot `vs_3j5m0LmzyeVf9zxqVj0O` is historical baseline,
not a substitute for that execution snapshot or a full PostgreSQL recovery gate.

Temporarily replace only the stopped machine's command with an idle Node
process using the same image/mounted volume. Verify the old API/publisher is
absent, protected metadata, permanent encryption nonce history and admission
archives match the retained baseline, and no publisher lock/job is active.
Stage only this operation's exact plan/operator/guards; run unsigned checks
against the installed dependency graph. A mismatch stops before key loading.

Only then arm a fresh, hash-bound, short-lived permit for the five Bulletin
operations and two native batches. Keep durable one-shot signing intents and
reconcile any uncertain result. Use the installed infrastructure signer in
place without exporting its seed. Independently verify finalized stored bytes,
DotNS records, source/version and native fee events. In every exit path restore
the original machine configuration and leave the retired publisher **stopped**;
do not start its old API/publishing command. Preserve existing protected files
and all previous publication journals. No recurring authorization is requested.

The earlier 0.1.89 permission is consumed. Approval of this plan is needed for
both reversible remote maintenance and the paid irreversible publication; a
merge alone does not authorize them. No owner authorization, execution permit
or publication journal exists for 0.1.90. Do not request a phone test until the
identified candidate is actually delivered and independently read back.
