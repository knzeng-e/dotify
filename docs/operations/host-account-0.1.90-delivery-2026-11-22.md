# Native account qualification 0.1.90 delivery — 22 November 2026

**Published and independently verified; physical account acceptance is pending.**
Product `dotify-test01.dot` now serves the isolated account qualification page
from merged #506, source `ecba4ea0`. It replaces only the prior 0.1.89 native
info reader. Ordinary Web/APIs and the retired stopped publisher are unchanged.

The [structured receipt](host-account-0.1.90-delivery-2026-11-22.json) owns actual finalized receipts,
public records, fees and byte checks. The [approved exact plan](host-account-0.1.90-publication-plan-2026-11-22.md)
retains the finite authority and caps; the [client reference](host-account-qualification-client.md)
owns its behavior and privacy. Refs #85 and #317, both still open.

## Verified delivery

| Observation | Verified value |
| --- | --- |
| Source / app | `ecba4ea0465fba154de65a7db7232be62f854acb` / `0.1.90` |
| Product / purpose | `dotify-test01.dot` / `host-account-addresses-only` |
| Storage CID | `bafybeiasoflsyem37mufbzttqns7ayx4rdnr4vbtia6jdy4mpr6c4oegvi` |
| CAR | 387429 bytes; SHA-256 `2a7605eb925f33779668103db1feea7b8c9b488517d22f61de7b19ef0a2fabcd` |
| Independent readback | 5 outer dependencies / 12 internal CAR blocks / all 9 files byte-compared |
| Bulletin | 4 stores + 1 icon renewal; 423,532 bytes; nonces 2160 → 2165 |
| Native DotNS | 2 zero-value batches; nonces 504 → 506 |
| Actual native fees | 0.0150967638 test PAS |
| Observed net account debit | 0.0150967638 test PAS |
| Future retention floor | At least 2,383 operations / 605,097,938 bytes |
| Snapshot | `vs_kAge1Jea58GCKoAalV13`; 14-day retention |

The exact merged-source quality run is green. The clean build, offline CAR and
served-file hashes match the approved frozen artifact. Independent public reads
verify every stored dependency and reconstruct the CAR/files. Both native
extrinsics are found in canonical Substrate blocks; their exact call bytes match
the plan. Runtime metadata decodes the corresponding canonical fee events,
with zero tips and total fees below the 0.10 test-PAS allowance. Net balance
change is recorded separately; no gross storage/refund breakdown is inferred.
Finalized root/app records point to the same CID and version. The separate
lab remains unchanged. This does not rely on EVM indexing of native extrinsics.

The owner's explicit “oui” authorized the new plan after the earlier maintenance
rejection. A fresh completed volume snapshot preceded the idle maintenance.
The actual custody dependency graph passed unsigned checks before loading the
installed infrastructure signer. Protected metadata, permanent encryption nonce
history and admission archives compare unchanged; no key was exported, no old
API/publisher started and no music or artist runtime was created. The machine's
original configuration is restored, its lock released and the publisher stopped.
Fly initially returned HTTP 408; its approved idle update applied later. The
actual idle configuration was verified before starting under an exclusive
machine lease, reusing the single snapshot. The earlier
[blocked checkpoint](host-account-0.1.90-execution-blocker-2026-11-22.md) is now
historical. All seven operations finalized once; no uncertain pending journal remains.
The operation's authority is now consumed, with no recurring renewal allowance.
This snapshot does not establish the separate PostgreSQL/independent-recovery gate.

## Next iPhone observation

In Polkadot Dev, reopen Dotify (or Debug → Open SPA → `dotify-test01.dot`).
Confirm **Account qualification** and **Source `ecba4ea0` · clean build**.
A stale 0.1.89 info-only page or a different source is a mismatch; stop and
report it. This is not the full listening app.

1. Tap **Read app information** once. Only a supported Runtime enables the next
   button. If unavailable/older/timed out, copy its report and stop.
2. Tap **Share my Dotify account** once and use ordinary Polkadot account consent
   for the intended artist account. No message/transaction signature is needed.
3. Check the displayed public Substrate/EVM addresses. A different Product or
   derivation index can differ from the main wallet address. Acknowledge the
   intended choice only if it is the account you want for your artist space.
4. Use **Copy support report** (or select **View support report**) before any
   retry/relaunch. It deliberately includes public key/addresses: review it before
   sharing. On denial, mismatch, timeout or malformed output, retain it and stop.

The report must identify app `0.1.90`, the exact source and matching configuration
identity from this receipt. It records a public snapshot and optional owner
choice, not a live signing session, chain-mapping proof or artist authority.
Do not treat a successful address display as a signature or access entitlement.
The [qualification procedure](../how-to/qualify-product-host-031.md#account-and-listening-acceptance)
keeps native mapping, signer control, fresh-factory/pending-runtime checks,
artist approvals, matched services, beneficiary settlement and media/Rooms as
separate gates. CASH remains disabled. No further funded action is requested.
