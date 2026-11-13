# CASH work tips: 13 November 2026 decision

**Decision: no-go for enabling CASH work tips in this candidate.** Newer published
payment APIs improve interrupted-payment recovery, but Dotify's pinned pair does
not expose them. Installed-Host payment support, exact units and artist-controlled
split settlement are still unverified. This is the bounded #406 reassessment;
PAS contributions keep their existing runtime path. See the
[commit-bound evidence](../backlog/implementation/evidence/cash-tip-feasibility-2026-11-13.md).

This explanation helps contributors decide what must be proved before implementing
a CASH adapter. It does not authorize a payment or an SDK/Host rollout. CASH on
this DevNet has no real monetary value; it is separate from PAS network fees.
The [platform money guide](https://docs.polkadotcommunity.foundation/architecture/money/)
places it on People through Coinage, with a protected representation on Asset Hub.

## What changed since the September decision

The [W16 decision](product-cash-settlement-decision.md) remains historical evidence
about access payments. Do not carry its SDK snapshot or a universal six-decimal
assumption into a new integration.

| Surface inspected                                       | Evidence                                                                      | What it establishes                                                                                                                                                                                           |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dotify SDK 0.39.0 / Host SDK 0.28.0 / TrUAPI 0.25.0     | Installed declarations and implementation                                     | Payment request takes amount, destination and optional purse; Host id comes back afterwards. A lost response can lose the only status lookup id.                                                              |
| Published TrUAPI 0.26.0                                 | Integrity-verified package declarations                                       | Caller-chosen id, `AlreadyExists`, and `ClaimedPartially` are defined. This does not establish that a named phone/Desktop build implements them.                                                              |
| Published SDK 0.40.0 / Host SDK 0.29.0 / TrUAPI 0.26.0  | Integrity-verified package metadata, declarations and Host SDK implementation | A coherent published candidate accepts a fourth caller id and forwards it. The id is optional in the SDK; Dotify would have to persist and always supply it. This is not a verified shipped pair.             |
| Published Host SDK 0.33.0                               | Integrity-verified package declarations                                       | Request-object API includes the id; the package depends on TrUAPI ^0.29.0. No dependency is upgraded here.                                                                                                    |
| Current upstream runtime source, pinned in the evidence | Payment capability implementation                                             | Payment delegates to an installed platform service and can return Unsupported. Its CoinPayment methods explicitly return Unsupported in this source snapshot. This is not a binary audit of the owner's Host. |

The [candidate report](../backlog/implementation/evidence/cash-tip-candidate-report-2026-11-13.json)
removes only the API caller-id blocker. An optional SDK parameter does not prevent
recovery when the caller always supplies its saved id; it also does not establish
Host durability. The offline inspector recognizes both that positional form and
the later request-object form instead of requiring an unnecessary SDK jump.
The dependency range `^0.26.0` permits selecting 0.26.0; it is not an exact lock
or a tested migration. Existing wire tests bind the 0.25 schema, not merely codec 3. Preserve those tests and check handshake/schema compatibility before changing
the application pin.

The SDK's `getPaymentManager()` returns an adapter when a TrUAPI client exists;
it does not confirm payment capability or permission. Public methods in a codec
are not proof that a platform implements them. The lower CoinPayment API does
have partial-clearing references; the blocker must not be described as “no
receipts exist anywhere.”

## A gift is a different promise from a work tip

A direct account payment can express a personal gift if its destination, units,
consent and recoverability are verified. It does not execute the artist runtime's
work-tip policy. Dotify's [native contributions](native-contributions.md) bind an
intent to a work, configured collaborators/beneficiaries, any permitted host
share and verified Room attribution. The runtime records distribution and
claimable shares under that intent.

Replacing this with one CASH destination would silently remove those choices.
Splitting it into several account payments would introduce partial settlement,
multiple approvals and refunds; it would not become atomic runtime settlement.
No trusted collection/exchange relay is introduced by this research. Keep a
future personal gift clearly labeled and separately reviewed rather than calling
it the existing work tip.

## Recovery and receipt contract

The recovery experiment uses synthetic data only. A future implementation needs:

1. Persist exact payer, payee, network/asset and **surface-specific integer unit**,
   amount, work/runtime, policy/Room attribution and the caller-chosen id before
   asking for approval. Concurrent attempts need one durable owner; journal loss
   is a recovery problem, not permission to start a fresh payment.
2. After interruption, look up that same id. `AlreadyExists`, missing status,
   disconnect, app restart or an ambiguous failure must lead to reconciliation,
   never automatic repayment. Verify actual terminal-state persistence on each
   shipped Host, including phone lock/background and account changes.
3. Treat `ClaimedPartially` and CoinPayment `Failed { cleared, reference }` as
   possible value movement. A zero/unknown status is not evidence of a refund.
   Preserve references without treating an unverified root/transaction list as
   authoritative work distribution.
4. Separate Host acceptance, reported completion, verified recipient settlement,
   runtime contribution accounting and access. A `Completed` callback establishes
   none of the latter facts by itself. #408 retains access settlement ownership.

RFC-0006 uses the payment asset's balance units. The current RFC-0017 V1 text
specifies dotUSD **cents**, exponent 2, for CoinPayment balances. Those are distinct
contracts; do not substitute chain decimals, JavaScript floating point or PAS
conversion for a verified Host unit. The observed declarations alone do not pin
RFC-0006 display conversion for the installed Host, so this decision provides no
executable quote. The [pinned RFC sources](../backlog/implementation/evidence/cash-tip-feasibility-2026-11-13.md#primary-source-identities)
make this distinction reproducible.

## Host matrix and next decision

| Target                                                         | Known observation                                                                                                                                                                             | Payment acceptance                                                                                                                                                                                      |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iPhone Polkadot app 0.10.0 (20), owner-reported Runtime 0.26.0 | Earlier account connection and existing audio accepted                                                                                                                                        | Payment method support, exact units, consent, partial status, terminal recovery after reload/lock and recipient proof are untested. A Runtime version label is not an inspected payment implementation. |
| Installed Desktop 1.0.0-rc.1                                   | Static archive contains Nova Host API 0.8.10; its payment declaration returns a Host id after request                                                                                         | No active backend, consent, units or durable status observed.                                                                                                                                           |
| Installed Desktop Dev 0.1.4-rc.3                               | Static archive contains TrUAPI 0.25.0 and Nova Host API 0.12.0. The latter declares caller ids and `PartiallyClaimed: u128`, distinct from TrUAPI 0.26's `ClaimedPartially { actualClaimed }` | Bundled alternatives are not interchangeable. A wrapper version or one included declaration does not establish the active backend.                                                                      |
| Ordinary Web                                                   | No Product Host client                                                                                                                                                                        | CASH Host payments unavailable; do not supply a fallback signer.                                                                                                                                        |

The [static Desktop inventory](../backlog/implementation/evidence/cash-tip-desktop-static-inventory-2026-11-13.json)
records only public bundle hashes and versions. No app was launched and no user
profile was inspected. These are declarations, not successful payment calls.

The separate [software-support candidate](../reference/host-software-support.md)
prepares an optional `system.info` observation through the pinned client. It
reports Host-native software labels, not payment availability, negotiated schema
or durable status; actual named-device collection remains after delivery.

**Next eligible slice:** #85 verifies the published candidate against actual
non-spending Host identity/capability evidence, wire compatibility, exact balance-unit
provenance and status persistence. Then decide whether a separately named personal
gift is useful or an authoritative work-split mechanism is available. A work tip
still needs independently verifiable policy/recipient/Room settlement. No funded
rehearsal is ready until those boundaries are reviewed with an exact asset,
recipient, spend cap and failed/partial/unknown recovery procedure.

## Run the offline checks

From the repository root:

```bash
npm --prefix web run research:cash-tips
npm --prefix web run test:cash-tip-feasibility
```

The report reads installed declarations and prints the no-go reasons. Tests
exercise interrupted acknowledgement, stable-id restart, duplicate calls,
storage failure, changed identities/terms, partial results and the distinction
between Host completion and work/access proof. The simulated Host deliberately
models the newer contract; it is not an adapter, device test, chain-finality
verifier or production payment journal. The program imports no Host transport or
signer and performs no network/payment call.
