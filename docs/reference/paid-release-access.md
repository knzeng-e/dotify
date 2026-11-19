# Paid release access while active

This reference records the owner's A05 decision of 20 November 2026 and the
source candidate implementing it. A Classic payment grants this wallet access
to this release while it is active, including after an access-mode change.
It does not guarantee perpetual media availability or an immutable runtime.

## Access rule and scope

`MusicAccessPallet.musicAccCanAccess(contentHash, listener)` first checks that
the release is active. For an active release, original authorship or the stored
`paidAccess[contentHash][listener]` grants access independently of its current
mode. Otherwise Free admits everyone, HumanFree requires supported personhood,
and Classic requires a purchase. The paid mapping belongs to one runtime;
it cannot authorize another wallet, content hash, runtime or chain.

| State after a Classic purchase | Paid wallet | Unpaid wallet without personhood |
| --- | --- | --- |
| Active Classic, including a price increase | allowed | denied |
| Active Free | allowed | allowed |
| Active HumanFree, including missing/unusable proof | allowed | denied |
| Inactive, any mode | denied | denied |
| Reactivated HumanFree | existing paid access restored | personhood requirement applies |

`musicAccHasPaid` remains a payment/grant record, even during deactivation.
`musicAccCanAccess` is the current access decision. Returning to Classic does
not require or allow a second payment from an already paid wallet. Deactivation
preserves receipts, royalty accounting and paid state; it introduces no new
refund rule. Ordinary mode edits cannot erase or transfer a paid grant.

A paid grant does not assert personhood. `musicAccHasPersonhood` and the
proof-gated `musicRoyRecordListen` analytics method keep their verification
requirements. Listen events remain declarations, not measured listening time
or evidence that an unverified buyer is a verified human.

## Key delivery and product surfaces

Private playback and Room-host requests still need the signed account and
canonical release identity. The API requires active release data and a positive
on-chain access decision at both finalized and current hashes, following the
[finality policy](finalized-key-authority.md). It does not infer access from a
frontend receipt or query payment history as a fallback. A private paid grant
does not make the release eligible for anonymous public-key delivery.
Room guests still receive WebRTC media rather than content keys.

Before payment, the access receipt describes persistence through access-setting
changes and the artist's ability to withdraw the release. Artist Rights explains
that changing settings retains earlier buyers, while deactivation stops new
access and reactivation restores paid access. A denied payment readback keeps
audio closed and offers rechecking without another payment.

## Trust and rollout boundaries

This is the behavior of the reviewed implementation, not a guarantee against
arbitrary administrator upgrades. The runtime administrator can replace facets
and run initializers; A03 separates that authority from the original artist's
ordinary publication/policy operations. This work does not lock upgrades, add
an irrevocable copyright license or modify the royalty settlement mechanism.

A previously disclosed key or a recording cannot be recalled by deactivation.
Availability still depends on retained media and working readers; keep
[the access explanation](../explanation/access-control-model.md) and operational
availability commitments distinct from the on-chain grant.

The change preserves ABI, selectors and storage, but changes Access bytecode
and the product promise. Deliver matching contracts, API readers and clients in
the selected clean testnet generation. Do not ship the new promise against an
older facet that denies paid HumanFree access. There is no import or migration
of the abandoned previous generation. [Readback](../operations/deployment-configuration.md#paid-release-access-a05)
and native/physical acceptance remain separate from local tests.

Implementation: `contracts/evm/contracts/pallets/MusicAccessPallet.sol`,
`contracts/evm/test/PaidAccessPolicy.test.ts`, `web/src/features/access/accessPromise.ts`,
and `services/api/src/services/chainAccess.ts` (unchanged authority).
[Scope and acceptance](../backlog/preserve-paid-release-access.md) track the
bounded source correction; no deployment or live transaction occurs here.
