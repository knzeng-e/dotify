# Product DevNet platform refresh - evidence and handoff

## Identity

- Scope: align Dotify with the September 2026 Product DevNet reset before resuming W06.
- Date: 2026-09-12.
- Starting dev SHA: `920dcce` (`fix: isolate failed royalty recipients (#146)`).
- Branch / PR: `chore/product-devnet-platform-refresh` / draft PR pending.
- External sources checked:
  - Product forum update: https://forum.polkadot.network/t/polkadot-product-devnet-update/18602
  - Product address reference: https://docs.polkadotcommunity.foundation/reference/addresses/
- Code readiness: locally verified.
- Release readiness: not deployed from this branch.

## Result and decisions

Dotify's Product DevNet baseline now targets the post-reset platform:

- Product SDK packages are pinned to `@parity/product-sdk` `0.27.0`,
  `@parity/product-sdk-host` `0.19.1`,
  `@parity/product-sdk-statement-store` `0.6.9`, and
  `@parity/product-sdk-descriptors` `0.11.0`.
- Product app deployment uses
  `@polkadot-community-foundation/polkadot-app-deploy@0.16.2` and bumps the
  executable manifest version to `[0, 1, 15]`.
- Product CDM `devnet` points at the new ContractRegistry
  `0x05662b3dbd5dd9f2ff92d67630477e84b0b37c1f`.
- Bulletin is re-pinned through `papi update bulletin` against
  `wss://bulletin-paseo.tservices.es:8443`.
- The Product DevNet fixture and generated bootstrap catalog were refreshed
  from the live API and still contain 8 items.

Root `polkadot-api` remains on `1.23.3`. Product SDK `0.27.0` brings its own
PAPI `2.2.x` tree, while the `@polkadot-apps` signer stack still uses PAPI
`1.23.x`; the PAPI 3 migration remains a separate compatibility track.

No live DotNS publication and no CDM write transaction were performed in this
branch.

## Verification

| Command or scenario                                                                                              | Environment and build                                 | Observed result                                                                                      | Artifact |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------- |
| `npm --prefix web run fmt:check`                                                                                 | Node 22.13.1, local worktree                          | Passed                                                                                               | terminal |
| `npm --prefix web run lint`                                                                                      | Node 22.13.1, local worktree                          | Passed with 3 existing React hook dependency warnings                                                | terminal |
| `npm --prefix web run test:unit`                                                                                 | Node 22.13.1, local worktree                          | Passed: 52 files, 400 tests                                                                          | terminal |
| `npm --prefix web run build`                                                                                     | Node 22.13.1, production Vite build                   | Passed; known chunk-size and transitive annotation warnings remain                                   | terminal |
| `npm --prefix web run build:product-devnet`                                                                      | Node 22.13.1, Product Vite build with network allowed | Passed; bootstrap refresh wrote 8 catalog items first                                                | terminal |
| `npm --prefix web run generate:product-catalog-bootstrap:strict -- --input fixtures/product-devnet-catalog.json` | Node 22.13.1, Product fixture snapshot                | Passed; wrote 8 catalog items from the deterministic fixture                                         | terminal |
| `CATALOG_API_URL=http://127.0.0.1:9 npm --prefix web run build:product-devnet`                                   | Node 22.13.1, Product CI-style offline build          | Passed; kept existing fixture-generated bootstrap and left no bootstrap drift                        | terminal |
| `npm --prefix web run smoke:devnet`                                                                              | Network allowed                                       | Passed: chain `420420417`, Asset Hub blocks, both Dotify contracts, Bulletin RPC, and IPFS gateway   | terminal |
| `npm --prefix web run generate:cdm`                                                                              | After Hardhat compile                                 | Passed; no tracked manifest diff                                                                     | terminal |
| `npm --prefix web run generate:cdm-metadata`                                                                     | After Hardhat compile                                 | Passed; deterministic metadata CIDs unchanged                                                        | terminal |
| `npm --prefix contracts/evm run fmt:check`                                                                       | Node 22.13.1, local worktree                          | Passed                                                                                               | terminal |
| `npm --prefix contracts/evm run compile`                                                                         | Node 22.13.1, local worktree                          | Passed                                                                                               | terminal |
| `npm --prefix contracts/evm run cdm:publish:testnet`                                                             | Network allowed, default read-only mode               | Passed dry-run; 2 names would publish update-version entries to the new registry                     | terminal |
| `node scripts/backlog-sync.mjs --check --offline`                                                                | Node 22.13.1, local worktree                          | Passed with existing offline warnings: 24 active items without issue mapping and duplicate `08` docs | terminal |
| `git diff --check`                                                                                               | local worktree                                        | Passed                                                                                               | terminal |
| `npm --prefix web audit --audit-level=moderate`                                                                  | Network allowed                                       | Failed with expected residual risk: 32 findings, no forced fix applied                               | terminal |
| `npm --prefix web audit --omit=dev --audit-level=moderate`                                                       | Network allowed                                       | Failed with expected residual runtime risk: 28 findings, no forced fix applied                       | terminal |
| `npm --prefix contracts/evm audit --audit-level=moderate`                                                        | Network allowed                                       | Failed with expected Hardhat 2 dev-tooling risk: 25 findings, no forced fix applied                  | terminal |
| `npm --prefix contracts/evm audit --omit=dev --audit-level=moderate`                                             | Network allowed                                       | Passed: 0 vulnerabilities                                                                            | terminal |

## Remaining gates

- After this PR merges, redeploy the Product DevNet app bundle so
  `dotify-test01.dot` advertises executable version `[0, 1, 15]` through pad
  `0.16.2`.
- Publish the two Product CDM names to the new registry only when ready to
  update the public CDM pointers:
  `@dotify/artist-directory` and `@dotify/artist-runtime-factory`.
- Run the real Product host smoke after publication: app open, Product account
  connection, room create/join, guest audible playback, and `product-cdm`
  payment/read-back if the Product adapter is enabled.
- Continue to defer root PAPI 3, React 19, Vite 8, and Hardhat 3 migrations to
  dedicated compatibility PRs.

## Next agent

- Next eligible implementation contract after merge: W06 returning identity.
- Inspect before W06: `web/package.json`, `web/.papi/polkadot-api.json`,
  `contracts/evm/tasks/cdmPublish.ts`, and
  `docs/operations/product-devnet-deployment.md`.
- Do not silently revert the new CDM registry, Product SDK pins, pad version, or
  Bulletin descriptor hash; those changes are tied to the September 2026 Product
  DevNet reset.
