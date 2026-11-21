# Qualify the Runtime 0.31 iPhone candidate

Use this procedure for #85 / #483. The owner's [20 November screenshots](../backlog/implementation/evidence/product-host-ios-031-2026-11-20.md)
show Polkadot App 0.10.0 (23) with Runtime 0.31.0 configured. They make a target
available for testing; the checks below still need actual device results.

## Read-only candidate preparation, 2026-11-21

The [isolated Host-info client](../operations/host-info-qualification-client.md)
provides the first non-spending reading without the old catalogue, account or
publication services. Its separate 0.1.89 configuration is not a delivered app.
An exact native publication record and verified served bytes are still required
before the phone steps below. Account/signing/onboarding follow the wire record;
this client does not request those actions.

## Prepare an identified candidate

For the first wire reading, use the isolated Host-info candidate described
above. It carries SDK 0.45 / Host SDK 0.34 / TrUAPI 0.31 and the reviewed #483 info
decoder patch. Bind the qualification link/artifact to its source SHA,
configuration digest, app/product identity and native delivery record. The
operator must provide that concrete candidate before requesting a phone test.
A build from a different commit or the previously delivered client cannot stand
in for this candidate. Later account/listening checks need their own identified
full-application context; the read-only client contains no account actions.

Keep qualification separate from the stable app. Any hosted/Bulletin delivery
follows the [Product publication procedure](../operations/product-devnet-deployment.md)
with its reviewed artifact, scope and budget. Preparing this procedure does not
publish an artifact, install the Host or authorize a transaction.

## First record: no spending or musical upload

1. Open the identified read-only candidate on the named iPhone. Tap **Read app
   information** once, then **Copy support report** before another relaunch.
   **View support report** provides a selectable fallback if copying fails.
   No wallet is needed for this read.
2. Retain the `dotify.host-qualification.v1` report's `build.source`,
   `build.configDigest`, `build.appVersion` and `hostSoftware` observation. A
   successful 0.31 observation reports `platform: Ios`, the Host's actual
   application labels and `runtimeVersion: 0.31.0` (or another explicitly reviewed
   0.31 patch). Record actual values, not a reconstruction from screenshots.
   The full listener's About report is a separate format; it does not replace
   this isolated candidate's source-bound record.
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
and media/Room journeys, bound to the exact candidate and device. Automated source
checks and a complete review package allow #483 to become ready for code review;
physical Host acceptance gates stable promotion, not that review status.
An isolated qualification delivery still needs an identified artifact and its
reviewed delivery context. Desktop and ordinary Web require their own evidence;
do not carry iPhone acceptance across distributions.
