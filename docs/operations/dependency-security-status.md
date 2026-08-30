# Dependency and Security Status

Last checked: 2026-08-30.

This record captures the dependency/security evidence for the maintenance pass
that follows the Product payment-label work. It is not a blanket policy change:
future feature PRs should still avoid dependency churn unless the dependency is
inside their reviewed scope.

## Applied In This Pass

| Surface | Change | Reason |
| --- | --- | --- |
| `web` | `brace-expansion` override `5.0.8` -> `5.0.9` | Removes the high-severity `brace-expansion` advisory from the frontend toolchain. |
| `web` | Lockfile updates inside declared ranges: `viem` `2.55.19`, `@polkadot-apps/chain-client` `2.0.6`, `@polkadot-apps/descriptors` `1.0.2` | Keeps the Product/PAPI-facing browser stack current without changing public ranges or SDK major assumptions. |
| `web` | Product SDK set: `@parity/product-sdk` `0.20.1` -> `0.23.0`, host `0.15.1` -> `0.16.0`, statement-store `0.6.2` -> `0.6.5`, descriptors `0.8.0` -> `0.10.0` | Aligns Dotify's Product adapter with the latest published Product SDK packages while preserving the standalone path and Product CDM opt-in boundary. |
| `web` | Lockfile regeneration also moves minor transitives inside already-declared ranges, including Rollup `4.63.0`, `@scure/base` `2.3.0`, and `ufo` `1.6.4` | npm resolution collateral from the Product SDK install; no direct dependency range or public runtime contract changes. |
| `services/api` | Lockfile updates inside declared ranges: `fastify` `5.12.1`, `@fastify/cors` `11.3.0`, `@fastify/multipart` `10.1.1`, `viem` `2.55.19`, `ws` `8.21.0`, `find-my-way` `9.9.0`, `fast-uri` `3.1.6`, `esbuild` `0.28.2` | Brings the backend API audit to zero vulnerabilities without changing the env contract. |
| `contracts/evm` | Lockfile updates inside declared ranges: Hardhat `2.29.1`, Hardhat plugins within the Hardhat 2 line, Mocha `11.8.0`, `viem` `2.55.19` | Reduces dev-tooling audit exposure without migrating to Hardhat 3. |

## Official Version Drift

Checked against npm published versions on 2026-08-30.

| Package | Current pinned/locked value | Latest published value | Decision |
| --- | --- | --- | --- |
| `@parity/product-sdk` | `0.23.0` | `0.25.0` | Defer to a dedicated Product compatibility PR; this PR changes signer/account mapping, not the SDK graph. |
| `@parity/product-sdk-host` | `0.16.0` | `0.18.0` | Defer with the Product SDK compatibility PR. |
| `@parity/product-sdk-statement-store` | `0.6.5` | `0.6.7` | Defer with the Product SDK compatibility PR. |
| `@parity/product-sdk-descriptors` | `0.10.0` | `0.11.0` | Defer with the Product SDK compatibility PR. |
| `@parity/product-sdk-signer` | `0.14.0` transitively via `@parity/product-sdk/wallet` | `0.14.2` | No direct dependency; import through the Product SDK export and upgrade with the SDK set. |
| `@parity/product-sdk-address` | `0.2.0` transitively via `@parity/product-sdk/address` | `0.2.0` | Current through the Product SDK export. |
| `polkadot-api` | `1.23.3` | `3.0.0` | Blocked as a root migration: Product SDK `0.23.0` currently depends on PAPI `2.2.x`, while `@polkadot-apps/chain-client` / keys / signer depend on PAPI `1.23.x`; a direct root PAPI 3 trial removes `PolkadotSigner` and breaks `ChainDefinition` / `TypedApi` compatibility. |
| `@polkadot-community-foundation/polkadot-app-deploy` | `0.13.1` | `0.13.1` | Current. |
| `react` / `react-dom` | `18.3.1` | `19.2.8` | Defer as a UI/runtime migration. |
| `vite` | `6.x` | `8.2.2` | Defer as a build-system migration. |
| `typescript` | `5.6.x` in web/api, `6.0.x` in contracts | `7.0.2` | Defer until PAPI/Product/Hardhat type compatibility is tested together. |
| `fastify` | `5.12.1` | `5.12.1` | Current in `services/api`. |
| `hardhat` | `2.29.1` | `3.14.0` | Defer as a breaking contracts toolchain migration. |

## Residual Audit Risk

`services/api`:

- `npm audit --audit-level=moderate` passes.
- `npm audit --omit=dev --audit-level=moderate` passes.

`web`:

- `brace-expansion` is fixed.
- `npm audit --audit-level=moderate` still reports 26 high-severity transitive
  findings through `deepmerge-ts` / `write-package` / `@polkadot-api/cli` and
  `nanoid` / `@novasamatech/host-api`.
- `npm audit --omit=dev --audit-level=moderate` reports the same 26 Product /
  PAPI chain findings because those packages are runtime dependencies. npm does
  not offer a non-breaking fix for the `deepmerge-ts` path.
- Product SDK `0.25.0` has not yet been tested against Dotify's Product
  manifest, host permissions, CDM resolver, and mobile fallback. A root
  `polkadot-api@3.0.0` trial also did not produce a deployable graph because
  the official Product SDK and `@polkadot-apps` packages still use different
  PAPI major lines.
- Next safe action: Product host-signed transaction/resource-allocation smoke
  tests on this SDK set, then a dedicated Product SDK `0.25.x` compatibility
  PR, plus upstream monitoring for a Product SDK / `@polkadot-apps` PAPI 3
  convergence release. Do not run
  `npm audit fix --force` on the Product stack.

`contracts/evm`:

- `npm audit --omit=dev --audit-level=moderate` passes.
- Full `npm audit --audit-level=moderate` still reports dev-tooling findings
  through Hardhat 2, Mocha/Solc transitives, and legacy Ethers 5 transitives.
- npm's forced path moves to Hardhat 3 and newer verification plugins; this is
  a breaking migration and should be tested in a dedicated contracts PR.

## Improvement Flags

- Run real Product host smoke tests for Product sr25519 key/session requests
  and the opt-in `product-cdm` runtime adapter with the SDK `0.23.0` set.
- Test the Product SDK `0.25.x` line in a dedicated compatibility PR before
  changing the published Product profile.
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
