# 09 — Generated ABI bindings

## Sprint
Sprint 1 — Stabilization and maintainability

## Priority
P1

## Objective
Generate frontend contract bindings from Hardhat artifacts so the app does not rely on stale copied ABIs or hand-maintained contract interfaces.

## Context
Dotify uses EVM smart runtimes on Paseo Asset Hub. The frontend calls factory, directory, and runtime pallets. Contract interface drift would create subtle production bugs.

## Required work

- Add a script under `contracts/evm/scripts` or repo-level tooling to export selected ABIs.
- Generate typed frontend bindings or typed ABI modules for viem.
- Place generated files in a predictable directory, for example:

```txt
web/src/generated/contracts/
```

- Add a command:

```txt
npm run generate:abis
```

or equivalent repo-level script.

## Contracts to cover

- ArtistRuntimeFactory
- ArtistDirectory
- SmartRuntime relevant interfaces
- MusicRegistryPallet
- MusicAccessPallet
- MusicRoyaltiesPallet
- MusicNFTPallet

## Requirements

- Generated files must include a clear header:

```txt
// Auto-generated. Do not edit manually.
```

- Frontend imports should use generated ABI modules.
- CI should detect if contracts changed without regenerated bindings.
- Remove obsolete copied ABI definitions where safe.

## Acceptance criteria

- Fresh clone can compile contracts and generate frontend bindings.
- Frontend builds using generated bindings.
- Contract signature changes produce visible TypeScript or CI failures.
- Documentation explains the workflow.

## Non-goals

- Do not rewrite the contract architecture.
- Do not introduce a heavyweight codegen stack if simple ABI generation is sufficient.

## Senior-engineer notes

ABI drift is a silent killer. Make the interface boundary boring, generated, and reviewable.

## Delivery notes

Delivered on branch `feat/generated-abi-bindings`.

- `contracts/evm/scripts/generate-abis.mjs` reads the Hardhat artifacts and writes
  viem-typed `as const` ABI modules into `web/src/generated/contracts/` (six
  modules + an `index.ts` barrel), each with the `Auto-generated. Do not edit`
  header. Plain Node ESM: no ts-node or Hardhat runtime needed, since it only
  reads artifact JSON. Command: `npm run generate:abis` in `contracts/evm`
  (`hardhat compile && node scripts/generate-abis.mjs`).
- Covered contracts (the ones the frontend calls): `ArtistDirectory`,
  `ArtistRuntimeFactory`, and the `MusicRegistry/Royalties/Access/NFT` pallet
  facets. `SmartRuntime` is a diamond and is called through those facet ABIs at
  the runtime address, so it needs no separate binding; extend `CONTRACTS` in the
  script to add more.
- `web/src/shared/config/contracts.ts` dropped its six hand-maintained ABI blocks
  and now re-exports the generated modules under the same names, so `useCatalog`
  and `useArtistConsole` are unchanged. The generated (full) ABIs are supersets of
  the previously curated subsets; the frontend builds and the 10 e2e specs pass
  unchanged.
- Generated files are committed, excluded from ESLint/Prettier (machine output)
  but still typechecked by `tsc`, so an un-regenerated signature change fails the
  web build. `ci-evm` regenerates and runs `git diff --exit-code -- web/src/generated`
  to fail on drift; its path filter now also watches `web/src/generated/**`.
- Verified: `generate:abis` clean, then in `web/` tsc + lint (0 errors) + build +
  fmt:check + 72 unit tests + 10/10 Playwright e2e all green.