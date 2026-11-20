# Preserve paid release access while active (A05)

Issue: [#499](https://github.com/knzeng-e/dotify/issues/499).

Priority: P2. Track: Production spine. Phase: Now. Type: Work.
Initial base: tested dev `61007d851f1ea1e3aefcaa5eb2ac85eb965a7139` after #496.
Integration, 20 November 2026: `dev` `1304dbb0` after merged A08/#498.
#500 now includes that accepted base; A05 remains a separate change for review.

## Owner decision, 20 November 2026

A prior Classic buyer keeps access to the same active runtime/release despite a
later access-mode change, including HumanFree without personhood. The artist can
still deactivate the release; payment history remains. Reactivation restores the
existing paid entitlement without a second payment.

See the [authoritative paid-access rule](../reference/paid-release-access.md).

## Required implementation and acceptance

- Evaluate an existing paid entitlement after the active/artist checks and
  before the mode-specific newcomer gate. Keep Free and unpaid HumanFree policy,
  disabled manual grants, signature requirements and runtime/release/account
  isolation intact. Preserve storage and the public ABI.
- Test actual local purchases through Classic/Free/HumanFree, price changes,
  deactivation/reactivation, account/release/runtime isolation and unavailable or
  unsupported proof. Paid access is not a personhood assertion; keep verified
  HumanFree analytics proof-gated.
- Keep API key authority on on-chain access with finalized and current reads,
  including individual/Room hosts; no client payment-history fallback or public
  key grant for a private paid entitlement. Test the relevant boundaries.
- Align pre-payment/receipt and artist policy-edit copy, contract reference and
  product explanation. No guarantee of perpetual media availability or code
  immutability across administrator upgrades, no new refund promise.
- Regenerate bindings/metadata and run affected contract/API/Web/Product checks;
  retain commit-bound evidence and deployment acceptance requirements.

## Boundaries

This source correction targets the selected clean testnet generation. No live
upgrade, payment, deployment, old-state import, migration, storage reset or merge
of #500 into dev. Existing keys cannot be recalled; anonymous Room guests still
receive media rather than content keys. Native Revive/physical Host, real
personhood, SDK/CASH and recovery/pilot gates remain separate.
