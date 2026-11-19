# A05 paid release access — 20 November 2026

## Decision and artifact

The owner chose to preserve a prior Classic buyer's access while the release
remains active, including after a switch to HumanFree. Deactivation still denies
new access and retains payment history. The [paid-access reference](../../../reference/paid-release-access.md)
is authoritative for the rule and its limits.

- Issue: [#499](https://github.com/knzeng-e/dotify/issues/499).
- Tested source: `645284916ff743957cc3aae1e05274ecb81a0b1f`.
- Base: tested `dev` `61007d851f1ea1e3aefcaa5eb2ac85eb965a7139` (#496).
- Local macOS arm64, Node 22.13.1, Solidity 0.8.28, optimizer 200 runs,
  via IR and Paris EVM target. Dependencies and SDK/Host pins are unchanged.
- A08 [#498](https://github.com/knzeng-e/dotify/pull/498) is independent and was
  not merged into this source. Its larger contract/Web counts remain separate
  evidence, not tests removed by A05.

No live purchase, upgrade, merge, deployment, reset or old-state import occurred.
The direct local runtime fixtures test storage-bound grants; the complete
factory/bootstrap suite separately preserves real one-runtime-per-artist setup.

## Reproduction and contract checks

Before editing the Access facet, all four new `PaidAccessPolicy.test.ts` tests
fail at the old denial of a real local Classic buyer after a HumanFree switch.
After the correction, the full contract suite passes **121 tests**, including:

- Actual local purchase followed by HumanFree, Free, a higher Classic price and
  repeated mode changes; the paid grant remains and repeat payment is refused.
- HumanFree deactivation denies both buyer and artist, keeps payment history,
  then reactivation restores the existing grant without another purchase.
- Missing/unsupported/dirty/reverted personhood evidence cannot remove paid
  access or admit an unpaid newcomer. Paid access does not make the buyer pass
  the personhood predicate or proof-gated listen analytics. A supported Full
  response is a positive control for those unchanged proof gates.
- Another wallet, zero address, another content hash, another runtime with the
  same hash, and an unknown release do not inherit the grant.

The existing policy matrix now expects an active prior buyer to retain access
under HumanFree without personhood. Inactive access still fails first. No public
selector or storage definition changes.

## API and product checks

The full API suite passes **697 tests**, including three new policy-boundary
cases. Individual and Room-host verdicts for the HumanFree candidate must hold
at both finalized/current canonical hashes. A latest denial, unfinalized-only
allow or inactive current record denies keys. Private paid access is not public
zero-address access, does not transfer to another requester and is not inferred
from `musicAccHasPaid`. API production authority code remains unchanged.
The final authority test file separately passes **38 tests**; API typecheck passes.

The full Web suite passes **1,258 tests** across 163 files. A new HumanFree gate
case keeps account checking available for earlier buyers without another payment.
Existing receipt/readback tests now verify the active-release persistence terms
and fail-closed payment recheck. Artist Rights adds a static notice using the
existing presentation style, with no new state, effect or network request.

Web and frozen Product/CDM builds pass. Contract/Web formatting and lint pass;
two existing App hook-dependency warnings and existing large-chunk build warnings
remain. API/Web ABI, Product bindings and metadata regeneration have zero drift.
Offline backlog, whitespace and 19 added/new local documentation links/anchors
pass at the source commit; the added root README link also resolves. Evidence
links are checked separately. CI results belong to the PR head and are distinct
from these local observations.

The earlier A06 baseline is 117 contract / 1,257 Web / 694 API tests. A05 adds
four contract cases, one Web case and three API cases; A08's independent cases
are not part of this base.

## Remaining boundaries

This source implements the selected entitlement, not perpetual media availability
or a guarantee against administrator facet/initializer replacement. A disclosed
key or recording cannot be recalled. It adds no refund mechanism, legal license,
real-human proof, CASH rail or SDK/Host upgrade.

Deliver the matching Access facet, readers and product copy only in the selected
fresh generation after remaining gates. [Authorized target readback](../../../operations/deployment-configuration.md#paid-release-access-a05)
must still verify native settlement and active/changed/inactive/reactivated access
through the intended Web/physical Host. Local EVM/mocked API checks do not prove
Revive cost, real proof availability or deployed device acceptance.
