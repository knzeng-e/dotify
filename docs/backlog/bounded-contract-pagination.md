# Bounded directory pagination (A08)

Issue: [#497](https://github.com/knzeng-e/dotify/issues/497).

Priority: P3. Track: Production spine. Phase: Now. Type: Work.
Base: merged/tested dev `61007d851f1ea1e3aefcaa5eb2ac85eb965a7139` after #496.

## Problem and outcome

`ArtistDirectory.artistsPage` adds offset and limit before clamping. A request
with offset 1 and uint256 maximum limit overflows. Responses also have no
explicit page cap. This caller-induced view failure is a robustness finding,
not a demonstrated payment or access vulnerability.

See the [directory page reference](../reference/contracts-api.md#directory-page-bounds-a08).

Return at most 100 artist/runtime pairs in registration order using
subtraction-based bounds, consistent with the existing track-page policy.
Zero limits and offsets at/beyond the count return two empty arrays; arbitrarily
large limits clamp. Preserve the ABI, storage layout and artist/runtime pairing.

## Acceptance

- Test empty directory, zero/exact/oversized limits, mid/end/maximum offsets,
  the reproduced overflow and a complete traversal across more than 100 artists.
- Verify API/Web/Product readers and audit tooling use compatible page sizes,
  preserve block pinning/order and do not silently skip capped entries.
  Reject invalid Product reader page-size configuration before reading.
- Preserve independent indexer concurrency/replay/per-runtime budgets; a
  contract page cap is not a global catalogue, memory or provider budget.
- Regenerate API/Web/Product bindings/metadata and verify drift, run relevant
  contract and consumer checks, and document commit-bound local evidence.

## Boundaries

No deployment, reset, migration, funded operation or signature. The non-upgradeable
directory correction belongs to the owner-selected fresh generation after the
remaining audit work. A05's paid-policy decision, native acceptance, SDK/Host,
real personhood, CASH and recovery/pilot gates remain separate. Do not add a new
catalogue-wide admission limit or redesign indexing in this bounded correction.
