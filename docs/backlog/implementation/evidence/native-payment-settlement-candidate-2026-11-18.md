# Native payment settlement candidate — 2026-11-18

Later source/rollout scope is recorded in the [review follow-up](native-payment-review-follow-up-2026-11-18.md). The results below remain bound to their original source; old-state migration was subsequently removed from the required scope.

## Result and scope

Source candidate tested: `5cfb032dd9345b8823f356c827b31ab713d87352`, based on
`dev` commit `8e3138c05dde3647002983296e0a44293c635c10`. This record and its
incoming documentation links are a later documentation-only change. No API,
client or facet deployment, wallet signature or payment was performed.

The [scope](../../native-payment-settlement-parity.md) delivers bounded native
transfer budgets, finalized native royalty receipt recovery and reconciliation,
and an explicit beneficiary account. The authoritative design is
[royalty settlement](../../../explanation/royalty-settlement.md); delivery and
rollback belong to the [deployment runbook](../../../operations/deployment-configuration.md).

## Review of the audit solicitation

The received KupiaSec email offers a paid audit. Its concrete hypothesis is
that an absolute 100,000-gas nested-call allowance can fail under Revive resource
metering, including when retrying a failed payout through the same claim path.
The sender explicitly did not test Dotify's deployed runtime and refers to
another team's Paseo Asset Hub Next experience. That is a useful portability
lead, not evidence that Dotify artists universally fail to receive payment.

The concern fits the old source: push transfers and claims shared that absolute
allowance. Local tests reproduce a recipient requiring more than it, then show
that an owner-authorized facet replacement recovers the positive debt without
changing storage, rights or paid access. Relative budgets retain bounded
recipient isolation and give the single claim/refund a larger allowance.

[Official EVM/PVM differences](https://developers.polkadot.com/smart-contracts/for-eth-devs/evm-vs-pvm/)
describe resource-metering differences; the
[Revive nested-meter implementation](https://github.com/paritytech/polkadot-sdk/blob/master/substrate/frame/revive/src/metering/math.rs)
is the relevant proportional-resource reference. Local EVM tests cannot prove
compatibility with every native runtime/compiler combination. Dotify's inspected
network is Paseo Asset Hub, distinct from Next.

The [bounded historical audit](payment-settlement-audit-2026-11-17.md) independently
verified beneficiary transfers for nine payments. Three were self-payments;
recorded settlement does not mean an increase in the sender's wallet balance.
No hash was available for the user's reported missing payment, so its specific
cause remains unestablished. No reply was sent to the vendor.

## Local verification

Node 22.23.5, macOS arm64. Frontend and API dependency lockfiles were unchanged.
API dependencies used an existing matching-lock installation; frontend
dependencies used a copy-on-write clone of a matching-lock installation after
the task's earlier install was removed to recover disk space.

| Check                               | Observed result and meaning                                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend unit suite                 | 1,238 passed across 161 files: finality, canonical receipt reconciliation, duplicate/conflicting evidence, persistence/retry bounds, manual repair and account mapping.                                            |
| Contract suite                      | 93 passed: rejected/gas-consuming/reentrant recipients, conservation with late healthy recipients, expensive payer refunds, repeated claims and recovery of actual legacy-stipend debt after selector replacement. |
| API suite                           | Complete sequential rerun: 660/660 passed, 43 suites, no skips or cancellations (347.55 seconds). Focused payment/proxy tests also passed (21 tests).                                                              |
| Browser earnings/contribution flows | 37 passed; a subsequent targeted run passed native Classic plus the new manual hash/block repair (2 tests, 38 unique browser cases in total). Synthetic fixtures only.                                             |
| Typecheck / lint                    | API typecheck and frontend TypeScript passed. Frontend lint had no errors and two existing App.tsx effect-dependency warnings.                                                                                     |
| Clean builds                        | Ordinary Web and frozen Product DevNet builds passed from clean source `5cfb032d`. Existing large-chunk build warnings remain.                                                                                     |
| ABI generation / hygiene            | Generated bindings reproduced; Web/contract formatting, backlog offline check and whitespace check passed.                                                                                                         |

The first broad API run was not green: 651/658 passed, with local socket
restrictions and disk exhaustion affecting seven tests. All seven affected
files subsequently passed in a sequential run (104 tests) after enabling local
test sockets and freeing generated dependency space. The complete-suite rerun passed all 660 tests with Node test-file concurrency
set to one (`--test-concurrency=1` immediately after `--test` in the package
script). These environment failures are retained rather than presented as a
first-pass success.

Reproduction commands from the source checkout:

```bash
cd contracts/evm
npm test
npm run generate:abis
cd ../../web
npm run test:unit
npm run lint
npm run build:product-devnet:frozen
npm run build
npm run test:e2e -- e2e/artist-earnings.spec.ts e2e/artist-gift.spec.ts --project=chromium --workers=2
cd ../services/api
npm run typecheck
npm test
```

The new manual-recovery browser case was added after the 37-case browser run
and exercised in the targeted two-case run. The suite's checked-in command
includes it for subsequent CI runs.

[Synthetic native royalty history screenshot](assets/native-payment-settlement/native-royalty-history.png)
shows distinct native payment/claim receipt links and a retained snapshot after
a simulated history outage. It is not a live earnings or iPhone capture.

## Read-only live account resolution

The new payout-account helper was executed against finalized Paseo EVM block
`15888157` (`0xafdfc55e501f760bc20577743bba4966fdc21bac8cdb2ba2f722ef5a27539893`).
The [paired JSON evidence](native-payout-account-read-2026-11-18.json) records
the helper digest and both H160/SS58 mappings, including a mapped native account
that must not be guessed by padding H160. This validates those two reads only;
it does not validate candidate live transfers.

## Remaining acceptance

Matched custody/edge/client delivery and owner-signed facet activation remain
separate. Before activation, verify real payout, failed-payout recovery and
refund behavior on the exact target Revive runtime, then Product Host finality,
receipt persistence and artist balance readback. Preserve the expanded receipt
journal and backups across rollback. The held SDK/Host upgrade and future CASH
settlement are unchanged and outside this candidate.
