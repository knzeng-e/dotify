# A08 bounded directory pages — 19 November 2026

## Artifact and environment

- Issue: [#497](https://github.com/knzeng-e/dotify/issues/497).
- Source: `cdca6cab8576e9d9ae3eba4717701af7b0a6a7e8`.
- Base: merged/tested `dev` `61007d851f1ea1e3aefcaa5eb2ac85eb965a7139` (#496).
- Local macOS arm64, Node 22.13.1, Solidity 0.8.28, optimizer 200 runs,
  via IR, Paris EVM target. No dependency or SDK/Host version change.

The [page reference](../../../reference/contracts-api.md#directory-page-bounds-a08)
is authoritative for limits and caller behavior. This is local source evidence;
no directory deployment, old-state migration, reset or target-chain operation
was performed.

## Reproduction and result

Before the correction, the regression request `offset = 1, limit = uint256.max`
against a populated local directory fails with **panic 0x11**, arithmetic
overflow at `ArtistDirectory.artistsPage`. The page-cap/traversal tests also fail:
the old implementation returns 101 or 207 entries instead of at most 100.
These failures were observed against base source before editing the contract.

After the correction, five directory tests pass in the full suite. They cover
empty directories, zero limits, exact/end/past-end/maximum offsets, limits around
100, uint256 maximum, preserved order/pairing and a complete 207-entry traversal
with returned lengths **100, 100, 7**. The fixture authorizes a local factory
account to register deterministic pairs; the existing full factory/bootstrap
suite separately verifies real runtime creation and registration authority.

API and direct Web reads enumerate all 207 entries in pages of 50, ending with
7. Product does the same at default 50 and at configured 100. Its invalid sizes
0, -1, 101 and uint256 maximum are refused before querying, avoiding skipped
entries from a requested cursor increment larger than the response cap.
The API test also checks every read stays at the selected confirmed block;
direct Web/Product retain their existing unpinned behavior.

## Validation

| Check | Result |
| --- | --- |
| `npm --prefix contracts/evm test` | **122 passing**, including five A08 regressions |
| Contract formatting and compile | Pass; test run compiles source with Paris target |
| API catalogue gateway tests | **8 passing**, including one new complete directory traversal |
| API `typecheck` | Pass |
| Targeted Web/Product adapter tests | **43 passing** |
| Full Web unit suite | **1,264 passing** across 163 files |
| Web formatting/lint | Pass; two existing App hook-dependency warnings, zero errors |
| Web build | Pass; existing large-chunk warning |
| Frozen Product build with `product-cdm` adapter | Pass; existing large-chunk warning |
| API/Web ABI and Product/CDM metadata regeneration | Pass, zero generated drift |
| Offline backlog and whitespace checks | Pass |
| Added/new local documentation links/anchors | 13 checked at source; evidence links checked separately |

#496's 117-contract/1,257-Web observations remain historical. A08 adds five
contract tests, seven Web tests and one API gateway test. API production source
is unchanged; the full API suite and browser journeys were not rerun locally.
Their CI outcomes belong to the PR head, separately from this local record.

## Remaining gates

The page cap bounds one response, not catalogue-wide memory, total artist
count, aggregate scan work or provider capacity. Existing independent indexer
concurrency/replay and per-runtime budgets are unchanged. Test data is synthetic;
it does not measure native Revive call cost or physical Host acceptance.

The directory code is non-upgradeable. Include the correction in the selected
matched fresh directory/factory/API/client generation only after remaining audit
work and separately authorized [delivery/readback](../../../operations/deployment-configuration.md#directory-pagination-a08).
A05's paid-policy decision, real personhood, SDK/Host, CASH and recovery/pilot
acceptance remain independent.
