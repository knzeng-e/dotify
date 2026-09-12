# Dependency and Security Status

Last checked: 2026-09-12.

This record captures the dependency/security evidence for the maintenance pass
that follows the Product payment-label work. It is not a blanket policy change:
future feature PRs should still avoid dependency churn unless the dependency is
inside their reviewed scope.

## Applied In This Pass

| Surface         | Change                                                                                                                                                                                                               | Reason                                                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `web`           | `brace-expansion` override `5.0.8` -> `5.0.9`                                                                                                                                                                        | Removes the high-severity `brace-expansion` advisory from the frontend toolchain.                                                                                  |
| `web`           | Lockfile updates inside declared ranges: `viem` `2.55.19`, `@polkadot-apps/chain-client` `2.0.6`, `@polkadot-apps/descriptors` `1.0.2`                                                                               | Keeps the Product/PAPI-facing browser stack current without changing public ranges or SDK major assumptions.                                                       |
| `web`           | Product SDK set: `@parity/product-sdk` `0.23.0` -> `0.27.0`, host `0.16.0` -> `0.19.1`, statement-store `0.6.5` -> `0.6.9`, descriptors `0.10.0` -> `0.11.0`                                                         | Aligns Dotify's Product adapter with the September 2026 Product DevNet host/runtime baseline while preserving the standalone path and Product CDM opt-in boundary. |
| `web`           | Product DevNet deploy tooling `@polkadot-community-foundation/polkadot-app-deploy` `0.13.1` -> `0.16.2`                                                                                                              | Uses the post-migration DotNS/Bulletin publication path required for new Product DevNet app records.                                                               |
| `web`           | Bulletin descriptor re-pinned against `wss://bulletin-paseo.tservices.es:8443` after the Product DevNet reset                                                                                                        | Keeps Product Statement Store descriptor metadata aligned with the new Bulletin runtime.                                                                           |
| `contracts/evm` | Product CDM `devnet` registry `0x59b0245778917af55224e5f8fb55f7f8d452619f` -> `0x05662b3dbd5dd9f2ff92d67630477e84b0b37c1f`                                                                                           | Publishes generated CDM manifests to the new Product DevNet registry; the old registry remains readable but is no longer the target for new registrations.         |
| `web`           | Lockfile regeneration also moves minor transitives inside already-declared ranges, including Rollup `4.63.0`, `@scure/base` `2.3.0`, and `ufo` `1.6.4`                                                               | npm resolution collateral from the Product SDK install; no direct dependency range or public runtime contract changes.                                             |
| `services/api`  | Lockfile updates inside declared ranges: `fastify` `5.12.1`, `@fastify/cors` `11.3.0`, `@fastify/multipart` `10.1.1`, `viem` `2.55.19`, `ws` `8.21.0`, `find-my-way` `9.9.0`, `fast-uri` `3.1.6`, `esbuild` `0.28.2` | Brings the backend API audit to zero vulnerabilities without changing the env contract.                                                                            |
| `contracts/evm` | Lockfile updates inside declared ranges: Hardhat `2.29.1`, Hardhat plugins within the Hardhat 2 line, Mocha `11.8.0`, `viem` `2.55.19`                                                                               | Reduces dev-tooling audit exposure without migrating to Hardhat 3.                                                                                                 |

## Official Version Drift

Checked against npm published versions on 2026-09-12.

| Package                                              | Current pinned/locked value                            | Latest published value   | Decision                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@parity/product-sdk`                                | `0.27.0`                                               | `0.27.0`                 | Current.                                                                                                                                                                                                                                                                       |
| `@parity/product-sdk-host`                           | `0.19.1`                                               | `0.19.1`                 | Current.                                                                                                                                                                                                                                                                       |
| `@parity/product-sdk-statement-store`                | `0.6.9`                                                | `0.6.9`                  | Current.                                                                                                                                                                                                                                                                       |
| `@parity/product-sdk-descriptors`                    | `0.11.0`                                               | `0.11.0`                 | Current.                                                                                                                                                                                                                                                                       |
| `@parity/product-sdk-signer`                         | transitively via `@parity/product-sdk/wallet`          | bundled with Product SDK | No direct dependency; import through the Product SDK export and upgrade with the SDK set.                                                                                                                                                                                      |
| `@parity/product-sdk-address`                        | `0.2.0` transitively via `@parity/product-sdk/address` | `0.2.0`                  | Current through the Product SDK export.                                                                                                                                                                                                                                        |
| `polkadot-api`                                       | `1.23.3`                                               | `3.0.0`                  | Blocked as a root migration: Product SDK `0.27.0` currently depends on PAPI `2.2.x`, while `@polkadot-apps/chain-client` / keys / signer depend on PAPI `1.23.x`; a direct root PAPI 3 trial removes `PolkadotSigner` and breaks `ChainDefinition` / `TypedApi` compatibility. |
| `@polkadot-community-foundation/polkadot-app-deploy` | `0.16.2`                                               | `0.16.2`                 | Current.                                                                                                                                                                                                                                                                       |
| `react` / `react-dom`                                | `18.3.1`                                               | `19.2.8`                 | Defer as a UI/runtime migration.                                                                                                                                                                                                                                               |
| `vite`                                               | `6.x`                                                  | `8.2.2`                  | Defer as a build-system migration.                                                                                                                                                                                                                                             |
| `typescript`                                         | `5.6.x` in web/api, `6.0.x` in contracts               | `7.0.2`                  | Defer until PAPI/Product/Hardhat type compatibility is tested together.                                                                                                                                                                                                        |
| `fastify`                                            | `5.12.1`                                               | `5.12.1`                 | Current in `services/api`.                                                                                                                                                                                                                                                     |
| `hardhat`                                            | `2.29.1`                                               | `3.14.0`                 | Defer as a breaking contracts toolchain migration.                                                                                                                                                                                                                             |

## Residual Audit Risk

`services/api`:

- `npm audit --audit-level=moderate` passes.
- `npm audit --omit=dev --audit-level=moderate` passes.

`web`:

- `brace-expansion` is fixed.
- `npm audit --audit-level=moderate` reports 32 findings: 1 low, 3 moderate,
  and 28 high. The report includes Product / PAPI transitive findings, host API
  `nanoid`, and build/test tooling advisories.
- `npm audit --omit=dev --audit-level=moderate` reports 28 runtime findings: 1
  moderate and 27 high. These run through `baseline-browser-mapping` /
  `browserslist`, the Product / PAPI `deepmerge-ts` path, and host API
  `nanoid`. npm does not offer a non-breaking fix for the `deepmerge-ts` path,
  and the forced `nanoid` path changes the `@polkadot-apps/signer` line.
- The Product SDK `0.27.0` app bundle still needs a real Product host smoke
  after publication on the refreshed Product DevNet. A root
  `polkadot-api@3.0.0` trial also did not produce a deployable graph because
  the official Product SDK and `@polkadot-apps` packages still use different
  PAPI major lines.
- Next safe action: Product host-signed transaction/resource-allocation smoke
  tests on this SDK set, using the post-payment `hasPaid` / `canAccess`
  read-back as the pass/fail signal. Continue upstream monitoring for a Product
  SDK / `@polkadot-apps` PAPI 3 convergence release. Do not run
  `npm audit fix --force` on the Product stack.

`contracts/evm`:

- `npm audit --omit=dev --audit-level=moderate` passes.
- Full `npm audit --audit-level=moderate` reports 25 dev-tooling findings
  through Hardhat 2, Mocha/Solc transitives, and legacy Ethers 5 transitives.
- npm's forced path moves to Hardhat 3 and newer verification plugins; this is
  a breaking migration and should be tested in a dedicated contracts PR.

## Improvement Flags

- Run real Product host smoke tests for Product sr25519 key/session requests
  and the opt-in `product-cdm` runtime adapter with the SDK `0.27.0` set,
  capturing the `dotify:product-cdm-payment-smoke` read-back event for Classic
  unlocks.
- Track root `polkadot-api` `3.0.0` separately until Product SDK and
  `@polkadot-apps` publish compatible packages on the same PAPI major line.
- Plan a Hardhat 3 migration separately from app/runtime changes.
- Keep the standalone web/API path first-class; Product SDK mode remains a
  progressive enhancement until host signing, WebRTC capability, and runtime
  transaction smoke tests are proven.

## Philosophical Alignment

This maintenance work does not add user-visible features. It supports Dotify's
north star by reducing hidden operational fragility while preserving the current
low-friction room/listening behavior and explicit Product-host failure states.
The deferred SDK migrations protect the same principle: do not make the app
depend on a moving host stack until that stack can preserve shared listening,
artist-controlled access, and honest security boundaries.
