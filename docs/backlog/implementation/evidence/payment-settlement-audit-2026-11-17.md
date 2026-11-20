# Native payment settlement audit — 2026-11-17

## Conclusion and scope

**No missing beneficiary transfer was found in the nine inspected payments.**
Seven Product/native contributions and two indexed EVM payments each contain a
real `Balances.Transfer` from the artist runtime to the configured beneficiary.
The inspected amount totals **10.78 PAS**. Three payments, totalling **2.42 PAS**,
return to their own sender; those are settled self-payments, not additional
wallet wealth. The other six payments transfer **8.36 PAS** between different
accounts. This establishes settlement for these references, not an exhaustive
clearance of every historical payment.

The owner had no reference for the reported missing payment. Samples were
discovered from the public catalogue, Dotify's saved native receipt history and
the public EVM index. No transaction, claim, deployment or wallet signature was
performed. CASH is outside this audit: these payments use native **PAS on Paseo
Asset Hub**, not CASH or mainnet DOT. The held SDK upgrade PR #483 was not used.

Source reviewed: `8e3138c05dde3647002983296e0a44293c635c10` (current `dev`
at audit start). Previously delivered Product artifact:
`4cbdb4f4206f91470eb6097ade8f23093f4aa840`. Local source tests and live chain
observations are separate evidence; this audit does not deploy that source or
add physical Host acceptance.

[Machine-readable evidence](payment-settlement-audit-2026-11-17.json) contains
full transaction/block references, beneficiary transfers, account state, pending
reads, index coverage and historical balance comparisons.

## Independent chain verification

Both rails concern chain ID `420420417`, with native genesis
`0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2`.
The native endpoint reports `asset-hub-paseo`, spec version `2005006`, PAS with
10 decimals. The EVM interface uses 18 decimal value units.

The common state anchor is finalized block **15,879,295**. Its native hash is
`0x5ed5929690247f5887350c5ff5b78a9be902f44f43ab90732c3d30e4867d4755`;
the corresponding EVM hash is stored separately in the JSON. **Do not pass an
Ethereum block hash to native `state_getStorage`.** Resolve the native hash by
block number and check chain identity first.

For each native sample, the archive block's extrinsic at index 2 was hashed with
Blake2-256 and matched against the saved transaction reference. Historical
metadata decoded `System.Events`; `ExtrinsicSuccess`, matching
`Revive.ContractEmitted` data/topics, and the exact runtime-to-recipient
`Balances.Transfer` were checked in that extrinsic. The EVM samples were matched
to their native block/extrinsic and actual transfers as well.

| Native block | Rail / purpose | Amount PAS | Beneficiary | Result |
| --- | --- | ---: | --- | --- |
| 15,105,004 | Product tip | 4.20 | `0xC357…c288` | Transferred |
| 15,323,656 | EVM Classic access | 1.42 | `0x2f6B…FF56` | Transferred |
| 15,416,223 | Product tip | 0.50 | `0xC357…c288` | Transferred |
| 15,449,016 | EVM contribution | 0.50 | `0xC357…c288` | Returned to sender |
| 15,501,651 | Product tip | 1.00 | `0xC357…c288` | Transferred |
| 15,501,782 | Product tip | 1.42 | `0x2f6B…FF56` | Returned to sender |
| 15,501,838 | Product profile gift | 1.00 | `0xC357…c288` | Transferred |
| 15,501,936 | Product tip | 0.50 | `0x2f6B…FF56` | Returned to sender |
| 15,700,697 | Product tip | 0.24 | `0xC357…c288` | Transferred |

Two additional balance checks establish actual account increases independently
of settlement events:

- Product tip at block 15,700,697: recipient native free balance increases by
  `2,400,000,000` native units and EVM balance by `240,000,000,000,000,000` units:
  **+0.24 PAS** on both interfaces.
- Classic purchase at block 15,323,656: recipient native free balance increases
  by `14,200,000,000` native units and EVM balance by
  `1,420,000,000,000,000,000` units: **+1.42 PAS** on both interfaces.

For the EVM self-contribution, the sender receives its own 0.50 PAS back while
paying fees: its net block balance change is **−0.006817 PAS**. The contribution
record is therefore compatible with a decreasing wallet balance.

## Which account actually receives the funds?

| Artist H160 | Resolved Substrate account | Resolution observed |
| --- | --- | --- |
| `0xC3571714248588C6E19cDECe2778B75341b2c288` | `5GUq4mo4fVDKF9ZhQwGyBAhciuF2vXJ8N6fxXS6bKC77N6US` | No `Revive.OriginalAccount`; H160 plus twelve `0xEE` bytes |
| `0x2f6BF01a6708C927b288a53B9fE3f9edc689FF56` | `5G7KWbnCUoi1qKvjygWn3JvZNm1b3Z5hzq8V48KpXnpJrNFz` | Native account returned by `Revive.OriginalAccount` |

These are different identities. Inspecting another Host account or another asset
cannot establish whether these PAS payments arrived. The observed mapping
explains where to look; whether the owner was inspecting another account is
**unconfirmed**, not an established cause of the report. Mapping semantics are
documented in the [official account reference](https://developers.polkadot.com/smart-contracts/for-eth-devs/accounts/).

All four checked `musicRoyClaimable(runtime, artist)` values and all seven native
receipt `musicGiftPending(id, recipient)` values are **zero** at the anchor.
Both runtime EVM balances are zero. Their native free balance is the
`100,000,000`-unit existential deposit (**0.01 PAS**); native storage reserves are
separate from payable contribution balances. The JSON preserves those reserves
and does not label them as artist earnings.

EVM and native balances reconcile exactly after the existential deposit and
Revive fractional dust are included: `(free − ED) × 10^8 + dust` for these
unfrozen accounts. The first artist has `90,000,000` EVM dust units; the other
three have zero. Comparing the two raw integers, or only multiplying `free`,
would give a false discrepancy. The checked receipt amounts themselves convert
exactly. Current [Revive source](https://paritytech.github.io/polkadot-sdk/master/src/pallet_revive/lib.rs.html)
also describes the spendable-balance/existential-deposit distinction; the live
values above come from the deployed chain's metadata and storage.

## Compatibility findings and remaining work

### P2 — Native Classic royalty history lacks parity with contributions

`useArtistConsole.ts` selects `viemRuntimeAdapter.listRoyaltyPaymentLogs` for
Product artist history. It reads `MusicRoyAccessPaid`, paid, claimable and claimed
events using `eth_getLogs`. Product CDM's royalty history method explicitly
throws unsupported. There is no matching native Classic royalty history service.

All seven verified native contribution hashes return **null** from
`eth_getTransactionReceipt`, and their `ContributionReceived` events are absent
from `eth_getLogs` at the same block numbers, despite verified native transfers.
Contributions already bridge this gap through `nativeReceipts.ts`,
`nativeContributionLedger.ts` and `nativeContributionHistory.ts`. Classic royalty
history does not. Consequently, an EVM-only empty history cannot prove no native
Classic payment or claim occurred. Current claimable state is read independently.

Before extending payments, add equivalent finalized native access/royalty/claim
evidence and merge it without double-counting EVM/native references. Retain
explicit coverage and unavailable states. This is a read-model deficiency;
the audited Classic example used the EVM rail and settled successfully. No
unindexed native Classic failure was identified in the bounded sample.

### P2 — Product royalty claims confirm inclusion rather than finality

`productCdmRuntimeAdapter.claimRoyalty` invokes `musicRoyClaim` without a
`waitFor: 'finalized'` option; SDK tx 0.5.3 defaults to `best-block`.
`waitForTransaction` is a no-op for this adapter. The artist console re-reads
claimable balance, correctly refusing success when it remains positive or is
unreadable, but that is not a finalized claim proof. Contributions and access
payments explicitly request finalization.

Align royalty claims with that finality boundary and check finalized settlement
before reporting completion. The distinction matters because `musicRoyClaim`
can succeed as a transaction while returning `settled=false` and retaining the
claimable amount. No claim was submitted during this audit; this is a source
finding, not an observed lost payment or reorganization.

### Product clarity — expose the beneficiary and self-payments

The earnings model counts settled recipient shares, including self-payments;
it is not net wallet growth. Show the actual beneficiary account, chain and PAS
asset alongside payout evidence, and identify a contribution to oneself. This
would make the three observed self-payments understandable without changing
their contract semantics. Keep settled income, pending claims, wallet balance,
storage reserves and fees distinct.

## Code and test evidence

- `contracts/evm/contracts/libraries/LibMusicRoyalties.sol`: gas-bounded native
  send; failed sends become claimable through the calling pallets.
- `contracts/evm/contracts/pallets/MusicRoyaltiesPallet.sol`: access settlement,
  split conservation, royalty claim authorization and failed-claim restoration.
- `contracts/evm/contracts/pallets/MusicContributionsPallet.sol`: per-receipt
  pending shares and self-authorized contribution claims.
- `web/src/features/runtime/productCdmRuntimeAdapter.ts`: exact 18-to-native
  value conversion, explicit finalized access/contribution writes, royalty claim
  finality gap.
- `web/src/features/donations/productDonation.ts`: direct transfer resolves
  `OriginalAccount` before falling back; round-trip H160 validation fails closed.
- `web/src/views/artist/ContributionHistory.tsx`: contribution claim action is
  present; gift pending balances are separate from `musicRoyClaimable`.
- `web/src/hooks/useArtistConsole.ts`: royalty claim read-back and EVM-only access
  history. `features/artist-studio/earnings.ts` counts paid/claimed recipient shares.
- `services/api/src/services/nativeContributionProof.ts`: native transaction
  inclusion, finality, dispatch and emitted-log verification.

On the reviewed source, **57 frontend tests in seven payment/accounting files
pass**, and **56 contract tests pass**, including rejected/expensive recipients,
failed and repeated claims, split conservation, authorization, refunds and
reentrancy. Contract compilation succeeds (32 Solidity files). These contract
tests use Hardhat's local EVM, not deployed Revive execution. The separate live
checks above cover successful deployed EVM and native settlement, not a new live
failed-recipient or claim scenario.

Commands used for local checks:

```sh
# web/, Node 22.23.5
npm run test:unit -- src/features/runtime/productCdmRuntimeAdapter.test.ts src/features/runtime/viemRuntimeAdapter.test.ts src/features/runtime/royaltyRuntimeClaims.test.ts src/features/donations/productDonation.test.ts src/features/donations/contributions.test.ts src/features/donations/nativeContributionHistory.test.ts src/features/artist-studio/earnings.test.ts
# contracts/evm/, local Hardhat network
npm test -- test/Contributions.test.ts test/ArtistRuntime.test.ts
```

Public read sources: `https://dotify-api.fly.dev/api/catalog?includeInactive=true`,
read-only `POST /api/contributions/history` for the two runtime addresses,
`https://asset-hub-paseo-rpc.n.dwellir.com` and
`https://eth-rpc-testnet.polkadot.io/`. The JSON provides exact block/transaction
references for reproducing archive RPC reads. Decode historical storage with
that block's metadata; verify native extrinsic identity and matching dispatch
phase before attributing transfers.

Unresolved: the unspecified reported payment, unsaved native receipt history,
other accounts/runtimes/assets, and physical Host signing/receipt acceptance.
No missing-payment root cause is claimed for those cases. Existing PAS evidence
does not validate CASH settlement or justify lifting the separate Host upgrade
hold.
