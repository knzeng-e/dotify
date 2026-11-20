# SDK 0.45 integration — 20 November 2026

## Source and purpose

Merge source `b8cd7fd990fa2dee5b912800ef3d4401174d564d` integrates PR #483's
`aa8bef5f1a7686a0f8b549edd1d07d7d117a6e1d` with tested dev
`91da9589e7535d608a2cf4ea84cd8280324b704b` after #500. Checks below ran on that
merge worktree before the source commit. No application/test/package changes
followed those checks; the subsequent record commit only links this evidence.
Builds produced before the commit are local validation outputs, not delivered
artifacts carrying the new source SHA.

The resolved writer imports preserve both the Runtime 0.31 preflight and dev's
native royalty journal. Two added purchase/claim regressions verify refusal
before signer construction, connection, CDM contracts or browser-wallet fallback.
All audit changes, including the NFT-free ABI and active-release paid grants,
remain in the integrated source. ABI/CDM/metadata regeneration produces no
generated-code difference from dev `91da9589`.

The [owner's screenshots](product-host-ios-031-2026-11-20.md) supply the named
iPhone configuration for qualification. They do not supply protocol, signing,
payment or media acceptance. [The procedure](../../../how-to/qualify-product-host-031.md)
requires a concrete identified candidate before asking for a phone test.

## Local validation

Environment: macOS arm64, Node 22.13.1. The app's clean offline `npm ci` installed
817 packages and applied the verified TrUAPI info patch. Each command below
completed successfully; signaling/browser loopback checks used the permitted
local-network execution context.

| Check | Result and scope |
| --- | --- |
| `web: npm test` | 1,279 tests / 164 files; includes the integrated writer refusal and native receipt regressions |
| `web: npm run test:product-sdk-compat` | 36 published-codec/patch/V2 fixture checks |
| `web: npm run test:product-deploy-environment` | 64 checks, including those same 36 protocol checks; counts overlap |
| `web: npm run test:cash-tip-feasibility` | 14 offline checks; no real CASH call |
| `research/product-host-compatibility: npm test` | 14 checks against unmodified published codecs, following a clean offline install |
| `web: npm run test:signal` | 131 signaling tests |
| `contracts/evm: npm test` | 126 contract/tooling tests |
| `web: npm run build` | Standalone Web build |
| `web: VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm npm run build:product-devnet:frozen` | Frozen Product build |
| `web: npx playwright test --config playwright.product-identity.config.ts` | 16 identity/About scenarios across Chromium and WebKit with a simulated Host |
| `web: npm run fmt:check` and `npm run lint` | Pass; lint retains two existing App hook-dependency warnings |
| ABI/CDM/metadata generators | Pass; no generated drift from integrated dev |
| Backlog offline consistency, added local documentation links/anchors and whitespace | Pass |

Both builds retain the existing large-chunk warnings. These checks do not prove
physical iPhone behavior, cryptographic Host signing, payment finality or acoustic
continuity. The earlier [17 November record](product-sdk-045-migration-2026-11-17.md)
retains its own source/counts and signaling image review correction. No local
Docker build was rerun here; the updated-head CI must build and boot the actual
non-root production image.

## Remaining acceptance

PR #483 remains draft. Its updated-head quality/image gates and named iPhone
info/signing results remain required. Protected media, native receipts/repair
and paid-access rules must use a matching fresh contracts/API/client generation;
abandoned old contracts cannot validate this new ABI or policy. Desktop needs
separate evidence. Deployed clients keep their accepted versions; CASH remains
disabled and #85/#406/#408 remain open. This integration performs no deployment,
Host installation, live signature, musical upload, funded action or state reset.
