# Native gifts, work tips and direct allocations

Owner-authorized scope, 2026-10-01. Branch: `feat/native-gifts-tips`.
Base: `d75b0385cde473962b112de92eb13aa01263bb5d` (dev CI passed).

GitHub issue: [#229](https://github.com/knzeng-e/dotify/issues/229).
Project metadata: P1 / Cultural propagation / Now / Work.

## Outcome

Make gifts a native artist-profile action and tips a native work/player action.
Voluntary contributions do not buy listening access. Free works retain their
registered beneficiaries. The artist can direct personal gifts and their own
tip portion to multiple recipients during a scheduled interval. Optional host
sharing comes only from the artist portion, before its remaining allocation.

## Acceptance

- Remove the donation build flag; capability failures stay explicit.
- Quote the exact recipient distribution before signature; reject stale quotes.
- Date every contribution using chain inclusion time; expose finalized receipts.
- Preserve collaborators, paid access, Diamond storage and content-key binding.
- Directly settle recipients, retaining rejected transfers as individually claimable.
- Persist uncertain intents across reloads; recovery never submits another payment.
- Bind room tips to the connected host, room instance, work and payer.
- Broadcast only receipt-verified tips, once per contribution, to current room chat.
- Show gift/tip totals, work totals, recipients, campaign references and claims.
- Provide scheduled policy editing in Rights and account history in You.
- Test financial boundaries, upgrades, failures, guest rooms and responsive UI.

## Boundaries

Campaign references group receipts; they are not organizer accreditation or proof
of charitable impact. Ambassador profiles, alternate host payout addresses,
campaign membership/governance, matching funds and reputation remain later work.
No PVM rewrite, CASH activation, production deployment or funded transaction is
authorized by this implementation ticket.

## References

- [Design and operational contract](../design/native-contributions.md)
- [Evidence](implementation/evidence/native-gifts-tips.md)
- [Deployment configuration](../operations/deployment-configuration.md)
