# Product CASH work-tip feasibility

Issue #406 · P2 · Product SDK · Next · Research. Workflow: Project 5.

The owner reopens bounded CASH research on 2026-11-08, after publication/listening
reliability. This supersedes the October scheduling deferral for this new scope;
the September W16 result remains dated evidence, not a claim about newer Hosts.
Coordinate #85 compatibility and #229 native contribution policy; do not reopen
or duplicate their delivered adapter and native PAS work.

## Coordinated SDK candidate, 2026-11-17

The [current-family migration](../design/product-sdk-045-migration.md) now prepares
SDK 0.45/Host SDK 0.34/TrUAPI 0.31 together. Legacy info decoding is corrected;
transaction V2 requires an accepted 0.31.x Host. Its CASH declaration inspector
recognizes caller-ID recovery, but actual support, units, durable status and
artist-policy settlement keep work tips no-go. Nothing is deployed or funded.

## SDK/Host update investigation, 2026-11-17

The [upgrade decision](../design/product-sdk-host-upgrade-decision-2026-11-17.md)
holds the default 0.45 upgrade: the owner confirms iPhone TrUAPI 0.26, while the
verified Desktop 0.9.4 archive bundles 0.29 and SDK 0.45 uses 0.31. Published-codec
checks reproduce the old-info response failure; builds alone do not establish
compatibility. The independent laboratory adds 14 checks without changing app
pins. Actual Host support, amount units and artist-policy settlement still block
CASH; #85 owns the next target-specific migration.

## Reassessment candidate, 2026-11-13

The [dated decision](../design/product-cash-tip-decision-2026-11-13.md) and
[offline tests](implementation/evidence/cash-tip-feasibility-2026-11-13.md) identify
a coherent published SDK 0.40.0 / Host SDK 0.29.0 / TrUAPI 0.26.0
candidate with caller-id/partial-status support, absent from Dotify's pinned pair.
Static Desktop archives contain differing API declarations; their wrapper labels
do not identify the active payment backend. Work tips remain no-go pending shipped-Host/unit evidence
and artist-policy settlement. CoinPayment references exist in the API; support
must be proved rather than inferred from codec availability. #85 owns the next
compatibility decision; no payment or dependency upgrade is enabled here.

## Deliverable and gates

- Pin shipped Host/SDK pairs, actual protocol/API and supported surfaces. Current
  observations: iPhone 0.10.0 (20) / Runtime 0.26.0, while Dotify pins SDK 0.39.0 /
  TrUAPI 0.25.0. Existing connection/playback works; this does not prove payments.
  Installed Desktop and ordinary Web need separate capability decisions. A newer
  npm version is not proof that the installed distribution implements it.
- Verify CASH asset/network and integer amount units from authoritative sources.
  [Current money guidance](https://developers.polkadot.com/apps/architecture/money/)
  places CASH behind Host Coinage services, separate from native PAS fees. It
  supplies architectural context, not the named Host's executable integer unit
  contract. Bind current authoritative payment/unit evidence before implementing CASH.
- Compare a direct gift with a work tip. A direct transfer cannot silently replace
  collaborator/beneficiary splits, optional host share or verified room attribution.
  Choose an honest supported boundary or record the missing external mechanism.
- Test explicit approval, exact recipient/work binding, stable durable payment IDs,
  duplicate/AlreadyExists, restart recovery, partial/failed/unknown results and
  authoritative receipt reconciliation. Unknown means recover, never repay.
- Deliver a dated go/no-go decision and offline runnable tests. If viable, prepare
  a disabled-by-default adapter and bounded funded rehearsal proposal with exact
  recipient, asset, spend cap and reconciliation/rollback. No live money action is
  authorized by this research ticket; no automatic SDK migration or service rollout.

A Completed callback never grants access. PAS purchases/contributions remain
unchanged. [CASH access settlement](product-cash-access-settlement.md) is separate.
Historical evidence: [W16](implementation/evidence/W16.md) and
[the original settlement decision](../design/product-cash-settlement-decision.md).
