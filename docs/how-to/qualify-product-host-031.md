# Qualify the Runtime 0.31 iPhone candidate

Use this procedure for #85 / #483. The owner's [20 November screenshots](../backlog/implementation/evidence/product-host-ios-031-2026-11-20.md)
show Polkadot App 0.10.0 (23) with Runtime 0.31.0 configured. They make a target
available for testing; the checks below still need actual device results.

## Prepare an identified candidate

Use the reviewed #483 artifact built from the recorded source commit, with SDK
0.45 / Host SDK 0.34 / TrUAPI 0.31 and its verified info decoder patch. Bind the
qualification link/artifact to its build SHA, app/product identity and delivery
record. The operator must provide that concrete candidate before requesting a
phone test. A build from a different commit or the previously delivered client
cannot stand in for this candidate.

Keep qualification separate from the stable app. Any hosted/Bulletin delivery
follows the [Product publication procedure](../operations/product-devnet-deployment.md)
with its reviewed artifact, scope and budget. Preparing this procedure does not
publish an artifact, install the Host or authorize a transaction.

## First record: no spending or musical upload

1. Open the identified candidate on the named iPhone. Open About and copy its
   support report before another relaunch. No wallet is needed for this read.
2. Retain its `buildSha` and `hostSoftware` observation. A successful 0.31
   observation reports `platform: Ios`, the Host's actual application labels and
   `runtimeVersion: 0.31.0` (or another explicitly reviewed 0.31 patch). Record
   actual values, not a reconstruction from screenshots.
3. If Runtime is absent, older, malformed, unavailable or timed out, retain that
   report and stop the qualification. Do not infer Runtime from app build 23.
   This result does not authorize transaction setup or a second signing attempt.

The collector only reads bounded public `system.info` labels. A successful
report establishes that method on this named build; it does not prove signing,
CASH, native transaction execution or audio continuity.

## Account and listening acceptance

After the wire record passes, use an identified qualification context with the
intended product ID and derivation index. With explicit ordinary account consent,
check that the connected Product account/public-key-to-H160 mapping is the
expected one. Exercise the existing message-signing/key-request flow only when
its matching API/release context is ready; no hidden signer or wallet fallback.
Record the build, account-match result and any support report on failure.

The integrated source includes the audit's NFT-free record ABI, stable artist
identity and active-release paid-grant rules. Do not test those rules against
abandoned contracts or assume the old catalogue is a compatible fresh generation.
Protected Bulletin playback, denied accounts, Room guests, Pause, lock-screen
artwork and track changes require the [matching-generation configuration](../operations/deployment-configuration.md#native-payment-correction-candidate-484).
Keep their device results distinct from the non-spending info record.

## Native payments and CASH are separate records

Native PAS acceptance requires a reviewed exact network, recipient, amount/spend
cap and candidate deployment before any funded exercise. Verify actual finality,
beneficiary balance, direct/pending claims, duplicate-free receipt recovery and
access after policy/deactivation/reactivation changes. Reuse an existing receipt
for repair; unknown or partial outcomes must not cause automatic repayment.
A 0.31 version preflight is only a wire filter, not permission to spend.

For CASH, [#406](../backlog/product-cash-tip-feasibility.md) must establish actual
Host API support, asset/network/units, durable IDs and artist/Room distribution.
The native CASH screen is not that evidence. [#408](../backlog/product-cash-access-settlement.md)
subsequently owns payment-to-access/royalty settlement. Neither is enabled by
this qualification, and no Completed callback grants a listening entitlement.

## Finish the record

Retain separate outcomes for Host info, account/signature, native payment/repair
and media/Room journeys, bound to the exact candidate and device. Keep #483 draft
until its stated promotion prerequisites pass. Desktop and ordinary Web require
their own evidence; do not carry iPhone acceptance across distributions.
