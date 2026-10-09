# Product DevNet SDK compatibility — evidence and handoff

## Identity

- Scope: align Dotify with the October 2026 Product Host protocol under compatibility epic #85.
- Date: 2026-10-09.
- Starting `dev` SHA: `9533ceddaacfa0ccc69a6ef0c3629b31a6278383`.
- Implementation SHA actually tested: `241431b3a87dbf89b5ee92bfdeb728c6ac750a82`.
- Branch / issue: `fix/product-devnet-sdk-compat` / #85.
- External sources checked:
  - Product SDK changelog: https://github.com/paritytech/product-sdk/blob/main/product-sdk/packages/sdk/CHANGELOG.md
  - Product Host changelog: https://github.com/paritytech/product-sdk/blob/main/product-sdk/packages/host/CHANGELOG.md
  - npm stable package metadata on 2026-10-09.
- Code readiness: locally verified.
- Published candidate: `97bf831679a5cfb1177d62475907625e40a8ebaf`, Product
  version `[0, 1, 44]`, executable CID
  `bafybeihcn3ffl5aveabuaukuloaje5ckyhgklhrfxtmkf3w77yupfkekg4`.
- Release readiness: publication and independent artifact verification passed;
  real Host smoke remains required.

## Result and decisions

Dotify now pins one coherent stable Product family: SDK `0.35.0`, Host
`0.25.0`, descriptors `0.13.0`, Statement Store `0.6.16`, and transaction
helpers `0.4.13`. The deploy CLI stays on stable `0.20.0`; the available
`0.22.0` build is a release candidate and is outside this compatibility fix.

The initial clean install exposed a packaging incompatibility. Product Host
uses `@novasamatech/host-api-wrapper@0.9.2`, whose `polkadot-api` declaration is
`>=2`. npm selected PAPI `3.2.1`, but that line no longer exports
`getPolkadotSignerFromPjs`, so the Product build failed before runtime. A
package-scoped override locks that wrapper to PAPI `2.2.2`, matching the Host
SDK's supported PAPI line without changing Dotify's root PAPI `1.23.3` or the
legacy `@polkadot-apps` graph.

The Product journey gate now verifies the full direct Product family and the
wrapper override plus nested lockfile resolution. The executable version is
`[0, 1, 44]` so a later publication can prompt Hosts to refresh the changed
integration. No contract address, environment variable, permission, API,
signaling service, DotNS record, or content pointer changed in this branch.

## Verification

| Command or scenario | Environment and build | Observed result | Artifact |
| --- | --- | --- | --- |
| `node --test scripts/product-devnet-journey-harness.test.mjs scripts/product-cash-settlement-readiness.test.mjs` | Node 22.13.1 | Passed: 40 tests, including failure on a missing override/PAPI 3 resolution | terminal |
| `npm run test:unit` | Node 22.13.1 | Passed: 107 files, 847 tests | terminal |
| `npm run build` | Vite production build | Passed; inherited annotation and chunk-size warnings remain | `web/dist/` ignored output |
| `npm run build:product-devnet:frozen` | Product DevNet profile, committed catalogue snapshot | Passed with PAPI 2.2.2 under the Host wrapper | `web/dist-product/` ignored output |
| `npx playwright test --config playwright.product-identity.config.ts --project=chromium` | Local simulated Product Host | Passed: 5/5 Product identity/connection scenarios | terminal |
| `npm run smoke:product-journey -- --md-out /tmp/dotify-product-sdk-compat.md --json-out /tmp/dotify-product-sdk-compat.json` | Local static profile | Static gates passed: 31; live Product payment/room evidence correctly remained blocked/not run | `/tmp/dotify-product-sdk-compat.{md,json}` |
| `npm run lint` | Local source tree | Passed with two pre-existing `App.tsx` hook warnings and no errors | terminal |
| `npm run fmt:check` | Local source tree | Passed | terminal |
| `npm audit --audit-level=moderate` | npm registry, 2026-10-09 | Expected residual failure: 49 findings; no forced migration applied | terminal |
| `npm audit --omit=dev --audit-level=moderate` | npm registry, 2026-10-09 | Expected residual failure: 31 runtime findings, mainly Product/PAPI transitives | terminal |

The combined Product identity configuration also includes WebKit. Chromium
passed all five scenarios; the local WebKit run was not available because its
Playwright browser binary is not installed. This is an environment limitation,
not a failed browser assertion.

## Compatibility and operations

- Ordinary web behavior and the standalone wallet path remain unchanged.
- Product Desktop/Web requires a Host compatible with the October 2026 wire
  protocol; the app continues to fail closed when the Host handshake is absent.
- No storage, key, contract, or server migration is required.
- `[0, 1, 43]` remains the immediate rollback version.
- No user data or new telemetry is collected.

## Product DevNet publication

Version `[0, 1, 44]` was published on 2026-10-09 from the clean, tested `dev`
merge `97bf831679a5cfb1177d62475907625e40a8ebaf`. This was a frontend-only
release; the API and signaling services were not redeployed.

- Bulletin finalized the stable upload at block `1149269` in transaction
  `0x450a6ea545445d055e5d655d9ec1f8e78d16359ac0a232e33c89ebe6be051cfc`.
- Bulletin finalized the full-CAR root at block `1149272` in transaction
  `0xe3cc643d9123121fb618b4475f447f2e3c2cae9baaf20701098d8b67981340f7`.
- DotNS linked the executable CID at Asset Hub block `14233097` in transaction
  `0xd98a58dc9bea93a84acebd80a6902996cbf3065d751392a415a19948c7131c68`.
- The atomic executable manifest update finalized in transaction
  `0xb281118d7f2578927c0f709038eaf661c63a7f21dbf35889b33ffb00105c0cd5`.

All 14 content chunks reached finality and the deployer's P2P retrieval passed.
An independent read through the public DevNet IPFS gateway returned a
5,821,636-byte CAR. All 26 files in that CAR match the frozen local build
byte-for-byte; its entry bundle contains the full deployed source SHA and
Product version. The pre- and post-publication Remote Config checks both matched
the pinned DevNet registry and content resolver. These checks prove publication
and public artifact integrity, not that an installed Product Host refreshed its
cache or exercised the new protocol.

## Acceptance mapping

| Criterion | Result | Evidence or blocker |
| --- | --- | --- |
| Build against the current stable Product SDK/Host family | Passed | Ordinary and frozen Product builds passed |
| Prevent the Host wrapper from silently selecting incompatible PAPI 3 | Passed | Scoped override, lockfile resolution, and negative journey-gate test |
| Preserve standalone web and fail-closed Product boundaries | Passed locally | 847 unit tests and both builds passed |
| Publish the reviewed Product candidate and verify its public artifact | Passed | Finalized Bulletin/DotNS transactions and 26/26 CAR files matched locally |
| Prove the new wire protocol in a real Product Host | Not run | Requires Product Desktop/Web access on the published CID |

## Remaining gates

- Run a real Product Desktop/Web smoke for account connection, signing,
  protected playback, and room creation/joining. Bind exports to the same commit,
  app version, and deployed CID.
- Keep issue #85 open until candidate-bound Host compatibility evidence is
  accepted. Do not treat the simulated Host test as live certification.

## Next agent

- Inspect `web/package.json`, `web/package-lock.json`, the Product journey
  harness, and this record before changing any Product or PAPI version.
- Do not remove the wrapper override unless upstream narrows its PAPI range or
  restores equivalent signer support and both Product builds pass without it.
- Reproduce the static check with `npm --prefix web run smoke:product-journey`;
  reproduce live acceptance inside Product Desktop/Web after publication.
