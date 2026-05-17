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