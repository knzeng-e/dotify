# Separate runtime administration from artist authority

Issue: [#490](https://github.com/knzeng-e/dotify/issues/490).

Priority: P1. Track: Production spine. Phase: Now. Type: Work.

Base: merged `dev` `2af6d093ed8362fa6b8788e958340eb895b5154d` (#489),
with the reviewed A09 tree. The owner confirmed on 19 November 2026 that
ownership transfer changes administration only; artist-identity succession is
outside this change. A complete fresh testnet generation is already selected;
no previous runtime/state migration or deployment is performed here.

## Problem and outcome

A03 found that ownership transfer left the directory at A while registration
started recording B as the artist, and profile gifts could follow the new
administrator. Separate these roles explicitly. The original artist retains
publishing/uploads, metadata/access controls and profile gift authority. The
technical administrator controls upgrades and can offer administration to a new
account, which must explicitly accept. Existing authors, NFTs, paid access,
splits, claims and gift beneficiaries do not move with administration.

## Implementation plan

1. Bind a nonzero artist independently from the initial bootstrap administrator.
   Publish a runtime artist view and block normal publication until bootstrap
   completion. Preserve atomic factory completion and its artist signature.
2. Make later administration transfers pending/accept/cancel, clearing stale
   offers on owner changes. Keep upgrade authority with the accepted owner.
3. Authorize registration and profile-gift policy/remainder by the bound artist,
   retaining per-track original-artist controls and immutable splits.
4. Verify the runtime artist as well as the directory/release identity at the
   API boundary. Uploads remain artist-only; a technical administrator cannot
   acquire another artist's upload quota merely through ownership. Keep A09's
   finalized/current key checks and fail closed on missing/mismatched identity.
5. Generate ABI/selector bindings from artifacts; update factory/bootstrap,
   deployment/readback and relevant audit tooling. Add deterministic contract,
   API and Web regressions and document the coordinated fresh-generation gate.

## Acceptance and boundaries

Cover A transferring administration to B with no runtime or with its own
runtime, pending replacement/cancellation, wrong acceptance and post-acceptance
upgrade rights. A can continue publishing/uploading and listeners can still
access historical paid releases; B cannot publish as A or claim A's profile
remainder. Verify old author/NFT/split/claim identities and bootstrap publication
exclusion. A missing new identity interface never falls back to the owner.

The administrator still has arbitrary Diamond upgrade power: role separation
in the reviewed facets does not protect an artist against malicious delegated
upgrade code. There is no ownership-transfer UI expansion, artist succession,
old-facet migration or live signature/transaction. A04/A06 and other remaining
audit findings remain separate before fresh-generation delivery.

Canonical model: [artist and administration roles](../reference/runtime-artist-authority.md).
