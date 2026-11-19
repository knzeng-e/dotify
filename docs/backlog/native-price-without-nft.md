# Exact native-compatible prices and NFT removal

Issue: [#493](https://github.com/knzeng-e/dotify/issues/493).

Priority: P1. Track: Production spine. Phase: Now. Type: Work.

Base: `dev` `ba2b8f92c487daa052ef0b383f5560fab9227d4d` after #492.
On 19 November 2026 the owner requested A07 and removal of all NFT features
for now. This targets the selected clean testnet redeployment, not migration
of previous contracts, releases or references.

## Outcome

Classic prices must be exactly representable by both EVM value and the
configured native payment precision. Reject unsupported prices before signing
and on-chain at publication and policy edits, without rounding. Keep exact
integers through catalog, display, editing and payment paths.

Remove NFT minting, ownership/approval/transfer APIs, holder-based access,
token identifiers and their active ABI, deployment, catalog and UI plumbing.
Remove the unused legacy NFT registry rather than ship a second implementation.
The original artist, immutable split recipients and verified paid entitlements
remain independent authorities. Free/personhood policies remain unchanged;
removing NFTs does not turn Classic into public access.

## Acceptance

- Declare native decimals in each fresh factory/runtime generation, reject
  invalid configuration and expose the precision for writer/readback checks.
- Test smallest native unit, nonrepresentable prices, uint128 limits, policy
  edits and both Web/EVM and Product writers. Unsupported existing quotes must
  fail clearly before payment; never truncate or silently round.
- Test a fresh runtime has no NFT selectors/interface or mint/transfer behavior,
  while artist publication, royalty settlement, listener access and A03
  administration separation still work.
- Regenerate interfaces/CDM artifacts and test affected contracts, API, Web and
  protected Bulletin publication. Update authoritative setup and public narrative.

## Boundaries

No live deployment, reset, signature, payment or old-state recovery is performed.
Fresh factory/runtime/initializer, API, catalog and clients must be delivered
together after remaining audit and Revive/physical Host acceptance. A05's future
paid-access policy, A06 personhood and A08 pagination remain separate. Historical
evidence remains historical; NFT functionality is removed from active source,
not rewritten out of earlier observations.
