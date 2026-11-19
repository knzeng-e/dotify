# A03 local validation — 19 November 2026

Source candidate: `62d0fe0c45458a699676ab957c6c545778025174`, based on
merged `dev` `2af6d093ed8362fa6b8788e958340eb895b5154d`.
Scope: [#490](https://github.com/knzeng-e/dotify/issues/490),
[runtime artist and administration](../../../reference/runtime-artist-authority.md).
These are local source checks, not deployment or device acceptance.

## Environment and results

The isolated macOS arm64 worktree used Node 22.23.5 and dependencies matching
the tracked lockfiles. Contracts used Hardhat 2.27, Solidity 0.8.28, via IR,
with the Paris EVM target. The full API suite used test concurrency 2.

| Check | Result | What it establishes |
| --- | --- | --- |
| Contracts `npm test` | 102 passed | Administration offer/accept/cancel, artist authority after delegation, real local gift payouts, pending royalty claims, staged bootstrap and delegated-owner audit behavior |
| API full package test list, `--test-concurrency=2` | 693 passed, 45 suites, no skipped tests | Finalized/current identity proofs, paid key continuity, upload isolation and fail-closed missing/mismatched artist getter, alongside existing service regressions |
| API `npm run typecheck`, `npm run build` | Passed | Production and test types compile with the generated identity ABI |
| Web `npm test` | 1,248 passed, 162 files | Existing frontend behavior remains covered after interface generation |
| Web `npm run build` | Passed | Production bundle builds; existing chunk-size warning remains |
| Web `npm run lint` | No errors | Two existing `App.tsx` effect-dependency warnings remain |
| Contracts `npm run generate:abis`, followed by generated-directory diff | No drift | All eight Web ABI modules and the API artist getter match compiler artifacts |
| Backlog offline validation and introduced documentation links/anchors | Passed | Scope/index entries and local navigation resolve |
| `git diff --check` | Passed | No whitespace errors in the change |

The contract tests distinguish B administering A's runtime from B publishing
through its own separate runtime. A remains able to register works and manage
artist policies; B can execute upgrades only after acceptance. Administration
does not rewrite existing track artists, NFTs, paid access, splits or claims.
A quote captured before handover still pays the original profile beneficiary.
The API tests separately exercise absent identity interfaces and disagreeing
finalized/current identities; neither can fall back to technical ownership.

## Remaining gates

The upgrade administrator can install arbitrary delegatecall code. These checks
prove the reviewed facets' role separation, not protection against a malicious
administrator replacing those facets.

No public transaction, contract deployment, catalog reset, wallet signature or
physical Host test was performed. Target Revive compilation/resource behavior,
matched fresh-generation readback and live publishing/payment/listening remain
required by the [delivery gate](../../../operations/deployment-configuration.md#artist-authority-candidate-490).
The API must not be deployed ahead of contracts exposing the new artist getter.
Older runtimes and releases are not migration targets. A04/A06 and other audit
corrections remain separate work before fresh-generation activation.
