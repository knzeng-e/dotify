# Finalized authority for irreversible audio-key delivery

Issue: [#488](https://github.com/knzeng-e/dotify/issues/488).

Priority: P1. Track: Production spine. Phase: Now. Type: Work.

Base: merged `dev` `6ca1f50c2dd6de1c4fc2643951a5f8258ea6e485` (#487),
whose tree matches the reviewed A01 PR head.

## Problem

Audit A09 reproduced key access at latest block 102 despite denied access at
finalized block 100. Pinning `requireCanonical` reads to a latest hash gives a
coherent observation, not final settlement. Reorganizing that purchase cannot
retract an already disclosed audio key. Product's finalized UI submission path
does not replace authorization at the API boundary.

## Scope and plan

1. Require a valid finalized block and latest head from the configured EVM RPC.
   Never substitute latest or confirmation counts when finalized is unsupported.
2. Require matching directory/release identity, active state and access at both
   block hashes. A newer head may deny an earlier finalized entitlement; it may
   not create a grant without finalized evidence. Deduplicate checks when both
   observations identify the same block.
3. Bind cached/coalesced verdicts to both block identities and preserve their
   original bounded expiry. Invalid/missing/inconsistent evidence fails closed.
4. Give unfinalized-only access an explicit retry response without an unlock
   action, including signed/session, prepared queue, anonymous Free and Room-host
   paths. Keep wallet-free Room guests unchanged.
5. Test payment/transfer finality, reorgs, latest revocation, cache changes,
   RPC failure, expiry and zero key derivations on denial. Document the provider
   compatibility and delivery gates alongside the owner-selected fresh generation.

## Acceptance and limits

A purchase/transfer that exists only at latest never produces a key. Once access
is valid in finalized and current state, the same request succeeds without a
new payment. A reorganized-away purchase stays denied. A newly observed latest
revocation wins over a warm finalized allow. Unsupported finalized state and
canonical-hash read failures return an outage with no fallback. Cached grants
cannot cross either changed block identity or extend their original expiry.

This is a source/API correction, not a deployment, RPC switch, transaction,
contract/storage migration or fresh-generation reset. No on-chain ABI or access
policy change. RPC finality semantics must be accepted on the exact supported
Revive endpoint before matching delivery. Already disclosed keys cannot be
recalled. Remaining A03/A04/A06 and other audit findings retain separate scope.

Canonical policy: [finalized key authority](../reference/finalized-key-authority.md).
