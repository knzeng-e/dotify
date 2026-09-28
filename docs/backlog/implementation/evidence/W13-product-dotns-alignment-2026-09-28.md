# W13 - Product DotNS deployment alignment

## Identity

- Sequence and scope: W13 Product Desktop candidate resolution prerequisite.
- Date: 2026-09-28.
- Starting dev SHA: `c22e08e7dc4ad88fcea537e1c70ee5ce9b3abcce`.
- Implementation SHA actually tested: pending review commit.
- Branch / PR / issue: `fix/product-dotns-deployer-alignment`; PR pending;
  issue #158 remains open.
- Related dependency evidence: `W13.md` and the candidate 0.1.27 preflight.
- Code readiness: locally verified.
- Release readiness: not deployed; W13 remains blocked.

## Result and decisions

The `VITE_DOTIFY_DEBUG_PANEL=true` build was correct: its local Product build
rendered `Production readiness`. The installed Product Desktop 0.1.3 instead
loaded `assets/index-C-hoIjHt.js`, which has no readiness panel. Clearing the
application cache cannot change that result because the host resolved the old
CID again.

Read-only chain and host inspection found that Dotify's pinned
`polkadot-app-deploy@0.16.2` wrote the candidate through registry
`0x38cf3dE5877a18157f4C1a4e067F84956F582b31` and content resolver
`0x444578659848ba38D1825238f10B8D75522d278f`. Product Desktop did not observe
that generation. The current `0.16.7` DevNet profile is aligned with the Product
host path: registry `0xb052E5EfC5ADEff1f21d48DEfb5169Cb394A1a73`, content
resolver `0x7e75491ecfb04900EB05ee63CABA2B33900aABB5`, and Publisher
`0xaab42efbe8ea4d4228c3a11e973f94c17b9a0f2c`.

Dotify now verifies those values from the actual npm package before building or
publishing. The check fails closed on a package/version/profile/address mismatch.
The Product journey static gates also require that preflight. No mnemonic,
transaction, publication, permission grant, or participant data was used.

## Verification

| Command or real scenario | Environment and build | Observed result | Artifact |
| --- | --- | --- | --- |
| Product Desktop 0.1.3 inspection | Installed macOS host, `dotify-test01.dot` | Loaded `index-C-hoIjHt.js`; readiness absent | DevTools read-only probe |
| Current Product Desktop source build | Official commit `5ecf46f5`, isolated temporary profile | Remote Config activated; direct DotNS resolution still loaded `index-C-hoIjHt.js`, confirming publication alignment was still missing | Local temporary build |
| Product Desktop DotNS unit suites | Official source, Node 26.5.0 | 6 files and 131 tests passed | Terminal output |
| `npm run verify:product-deploy-environment` | Dotify branch, npm package 0.16.7 | Passed with the expected DevNet registry, resolver, Publisher, IPFS, and web gateway | Terminal output |
| `npm run test:product-deploy-environment` | Dotify branch, Node 22.13.1 | 3 tests passed, including explicit rejection of the 0.16.2 generation | Terminal output |
| `node --test scripts/product-devnet-journey-harness.test.mjs` | Dotify branch, Node 22.13.1 | 21 tests passed; static journey fails when the environment preflight is omitted | Terminal output |

## Compatibility and operations

- Supported devices, browsers, and Product host versions: resolution was
  reproduced on Product Desktop 0.1.3 and an isolated build of current official
  Product Desktop source. Payment, room, and physical-device capture were not
  run because the expected candidate was not loaded.
- New config/permissions and documented defaults: the deploy CLI moves from
  0.16.2 to 0.16.7. No Product permission or hosted setting changes.
- Storage/key/contract migration and compatibility evidence: none; this changes
  only the frontend publication path.
- Deployment identifiers: none. The existing mismatched upload is not promoted
  as Product-host evidence.
- Rollback procedure and rehearsal evidence: no live state changed. Revert the
  pin/preflight commit if the Product platform supplies a different verified
  profile, then update the expected addresses and tests together.
- Data collected, retention, and user controls: no participant data collected.

## Acceptance mapping

| Sequence criterion | Passed / failed / not run | Supporting evidence or exact blocker |
| --- | --- | --- |
| Candidate identity resolves in Product Desktop | Failed before fix; not rerun after publication | Host loaded the old bundle. A replacement publish through 0.16.7 is required. |
| Deployment tooling matches the Product host DotNS generation | Passed locally | The new preflight reads and validates the actual npm package environment. |
| Product payment/access, room, and physical-device smoke | Not run | Running these against the old bundle would produce invalid candidate evidence. |

## Remaining gates

- Merge the reviewed deploy alignment change.
- From the accepted clean candidate, run the authorized debug Product publish
  through `npm run deploy:product-devnet` and record the new finalized CID.
- Confirm Product Desktop loads the candidate bundle and shows `Production
  readiness` before granting permissions, connecting an account, or attempting
  payment.
- Continue the existing W13 payment/access, room, device, rollback, release
  profile, and aggregate pilot gates.

## Next agent

- Next eligible sequence: continue W13 only after the replacement publication.
- Files/interfaces changed: `web/package.json`, the Product deploy environment
  preflight, Product journey static gates, and the Product deployment runbook.
- Decision that must not be silently reversed: a successful Bulletin upload is
  not Product evidence unless the host-facing DotNS profile resolves it.
- Exact next command: from a clean accepted commit with authorized local signer,
  run the debug flags followed by `npm run deploy:product-devnet`, then verify
  the loaded bundle before collecting evidence.
- Project metadata: issue #158 remains In Progress in Project 5.
