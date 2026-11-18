# Native PAS payment settlement and EVM/Substrate receipt parity

## Problem

A reported missing artist payout prompted a bounded audit of the two known
artist runtimes. Nine historical payments have real beneficiary transfers;
three are self-payments. Separately, the fixed 100,000 nested-call allowance can
prevent an expensive recipient from using both an immediate payout and its
claim. Hardhat alone cannot establish Revive resource compatibility.

Product Classic royalties also lack the verified native receipt history already
used for contributions. Product royalty claims wait for inclusion rather than
finality, and the UI does not explain the actual native beneficiary account or
self-payments well enough.

## Required implementation

1. Replace the absolute transfer allowance with bounded relative frame budgets,
   preserving recipient isolation, exact accounting, reentrancy protection and
   existing Diamond storage/selectors. Provide a recovery path for expensive
   recipients and test overpayment refunds, failed/repeated claims, and a local
   replacement of the old fixed-stipend facet with a positive pending balance.
2. Verify and save finalized native access/royalty/claim receipts in the existing
   single-writer native journal. Keep contributions and royalty history queries
   separate, revision-consistent, bounded and honest about saved-receipt coverage.
3. Persist Product receipt references for read-only sync retries. Merge native
   and EVM evidence before reconciling claims, without counting the same
   extrinsic twice. Keep the correct receipt links and expose manual verification
   of an existing hash/block without resubmitting payment.
4. Await Product royalty-claim finality and check finalized pending state before
   reporting success. A successful dispatch is not proof of a successful payout.
5. Resolve the real beneficiary with the runtime System precompile; show the
   native PAS account/chain and distinguish self-payments from wallet growth.

## Acceptance and boundaries

Local contract, frontend, API and browser regressions must cover the changed
money, persistence, identity, finality and accounting boundaries. Document the
matched API/client rollout, unchanged journal location and independent backups.

This ticket delivers a reviewable source candidate. Owner-signed facet upgrades,
matched client/API deployment and live Revive/physical Host acceptance remain
separate operational gates before activation or public-pilot claims. No signer,
transaction, treasury redesign, CASH adapter or SDK upgrade is authorized by this
ticket. The held Host SDK candidate stays separate.

Related: #145 (original W05 isolation), #85 (Host acceptance), #408 (future CASH
settlement). The [bounded audit evidence](implementation/evidence/payment-settlement-audit-2026-11-17.md)
records exactly which existing payments were independently checked.

The [source-candidate validation](implementation/evidence/native-payment-settlement-candidate-2026-11-18.md)
records the email review, regression evidence and remaining live acceptance.
