# A06 supported personhood evidence — 19 November 2026

## Artifact and environment

- Issue: [#495](https://github.com/knzeng-e/dotify/issues/495).
- Tested source: `52e2f14ec13007a522b43191b54a710329da4144`.
- Base: `dev` `9767cbb657e2ce0ff51bd7f4c216fbd1b360f087` (merged #494).
- Local macOS arm64, Node 22.23.5, Solidity
  `0.8.28+commit.7893614a`, optimizer 200 runs, via IR, Paris EVM target.
- Hardhat local chain; test-only precompile bytecode injected at Dotify's fixed
  address. No target-chain transaction, proof collection, deployment or reset.

The [reader policy](../../../reference/personhood-status-policy.md) is the
canonical behavioral reference. This record describes local source acceptance,
not deployed or physical Host acceptance.

## Checks and observations

| Check | Observation |
| --- | --- |
| Contract formatting | `npm --prefix contracts/evm run fmt:check` passes |
| Compile and full contract suite | `npm --prefix contracts/evm test` compiles changed source and passes **117 tests** |
| API/Web ABI drift | `npm --prefix contracts/evm run generate:abis` passes; generated modules are identical |
| Product bindings and metadata | `npm --prefix web run generate:cdm` and `generate:cdm-metadata` pass with no generated drift |
| Backlog manifest | `node scripts/backlog-sync.mjs --check --offline` passes |
| Documentation and whitespace | 16 added/new local links and anchors resolve at the source commit; `git diff --check` passes |

The earlier #494 observation of 105 contract tests remains historical. A06 adds
12 tests in `contracts/evm/test/PersonhoodPolicy.test.ts`, including:

- An exhaustive loop over all 256 uint8 response statuses, comparing raw
  diagnostics, typed level, DIM1/DIM2 predicates and track access. Supported
  statuses remain usable; unsupported tiers expose no usable alias or access.
- Four dirty full words: 256, 257, bit 255 set, and uint256 maximum. None is
  truncated into a supported tier or causes a decoder/enum panic.
- Six invalid response lengths: 0, 1, 32, 63, 65 and 96 bytes. Both incomplete
  and extended layouts deny access.
- A reverted call and an unsupported tier deny HumanFree listen recording with
  the expected personhood error. A supported listen succeeds first, so an
  unrelated setup failure cannot satisfy the negative assertion. Free, an
  actually paid local Classic entitlement and original-artist access still work;
  an explicit None requirement retains its no-requirement behavior.

The full suite also preserves application-context separation and known tier
behavior in `ArtistRuntime.test.ts`. Generated API/Web/merged Product interfaces
remain identical, and no raw/typed getter consumer was found outside generated
bindings in API/Web source. Application and API source did not change; their
full suites were not rerun locally for this contract-only correction. GitHub
workflow results belong to the PR head and remain distinct from these checks.

## Remaining boundaries

The tests inject declared ABI responses; they do not establish the target
runtime's interface, available proof tiers, real humanity/address binding or
Host behavior. Those remain the [deployment acceptance gates](../../../operations/deployment-configuration.md#personhood-reader-a06).
This work does not activate W17, change SDK/Host pins, add an oracle or migrate
old contract state. Access/Royalties bytecode changes and must be included in
the separately authorized matched fresh generation after the remaining audit
work. A08 pagination and A05's policy decision remain separate.
