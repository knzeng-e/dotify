# W38 - Bound release data and royalty splits in the music pallets

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W38** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Use the `smart-runtime-architect` guidance for Diamond storage and selector safety.

- Branch: `feat/contract-bounds` created from the latest tested `origin/dev`.
- Dependencies: W37.
- Release stage: selected for the next fresh internal deployment (owner decision, 2026-10-28).
- Product purpose: no release can make its own purchases fail or make the catalog expensive to index.

## Problem at audit

- Royalty splits have no recipient cap (`contracts/evm/contracts/libraries/LibMusicRoyalties.sol:35`), and payment settles in a loop (`pallets/MusicRoyaltiesPallet.sol:167`), so a large split list can exceed the gas limit and block purchases.
- Release strings have no maximum length (`pallets/MusicRegistryPallet.sol:200-208`).
- Track enumeration is one call per index (`musicRegTrackHashAtIndex`), which dominates reindexing cost.
- Runtime creation is permissionless (`ArtistRuntimeFactory.sol:121`), so empty runtimes can inflate discovery.

## Outcome

1. A maximum number of split recipients (proposed 16) enforced at registration.
2. Maximum lengths for title, artist name, description, and references.
3. A paged view returning track hashes (and optionally records) in one call, mirroring `ArtistDirectory.artistsPage`.
4. A fresh-generation activation plan. The owner will reset internal runtimes; do not add legacy-runtime compatibility. Preserve artist-owned Diamond upgrade foundations for future real users, and enforce the same bounds in the indexer against arbitrary artist-modified contracts.

## Acceptance and meaningful verification

- Hardhat tests for each bound, including the boundary value, and a purchase gas measurement at the cap.
- Storage layout and selector collision checks; generated ABIs updated through the repository generator.
- Local module-replacement rehearsal on the new generation with purchases and splits, preparing future upgrades without an old-runtime fixture.

## Scope boundary

No live contract migration or deployment without explicit owner authorization. No change to access modes or payment semantics.

## Handoff

Write `docs/backlog/implementation/evidence/W38.md` using `evidence-template.md`.

## Implementation record

See [W38 evidence](evidence/W38.md) for limits, failure boundaries, measurements and the coordinated fresh-deployment gate. No live deployment is part of this implementation.
