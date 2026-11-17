# Host software support candidate — 2026-11-13

The optional About-only software observation is implemented and locally tested.
It is not deployed or accepted on a physical Host. Existing 0.1.83 listening
observations, including the owner's later successful artwork/audio report, do
not establish this candidate's native behavior or explain the earlier missing
artwork.

## Artifact and environment

- Implementation: `0464aaf1` on `feat/host-runtime-support`, based on tested dev
  `aa9dc455`. The following evidence-only commit does not change application bytes.
- Local macOS arm64, verified Node 22.23.5; pinned SDK 0.39.0 / Host SDK 0.28.0 /
  TrUAPI 0.25.0. Package versions and runtime profiles are unchanged.
- Browser runs use generated/fake Host responses and local servers. They do not
  query a real Host, account, permission, balance, payment or signer.

## Checks and what they establish

| Check | Result | Boundary verified |
| --- | --- | --- |
| Full frontend unit suite | 1,192 pass, 153 files | Existing frontend invariants plus bounded software reader/export |
| Focused reader/diagnostic tests | 26 pass | Cancellation/deadline, one outstanding request, late responses and allowlisted export |
| Pinned raw-wire suite | 6 pass | Encoded system-info request and generated response decoding, with fake provider only |
| Product identity browser suite | 16 pass across Chromium/WebKit | Existing identity flows, About observation without account requests, clipboard denial and late-close isolation |
| Ordinary Web About suite | 6 Chromium cases pass | Host-off behavior, existing five-line app export and manual support fallback |
| Web and frozen Product builds | Pass | Typecheck and both supported build targets |
| Frontend lint | Pass, zero errors | Two existing App hook warnings remain |
| Backlog/link/diff checks | Pass locally | Manifest alignment, 78 local Markdown links and whitespace |

The 390-pixel WebKit clipboard-denied capture was inspected: public software
labels wrap inside the existing technical disclosure, and selectable report text
remains available. This is browser layout evidence, not mobile Host acceptance.
Builds retain existing bundle-size/third-party annotation warnings.

A controlled regression with a throwing unrelated Host property first failed
when arbitrary response fields were spread. Selectively reading the three
software fields makes that regression pass without evaluating the extra property.
The serializer independently reconstructs its allowlisted object.

Commands: `npm run test:unit`, `node --test scripts/product-host-wire.test.mjs`,
`playwright test --config playwright.product-identity.config.ts --workers=2`,
`playwright test e2e/about-dotify.spec.ts --project=chromium --workers=2`,
`npm run build`, `npm run build:product-devnet:frozen`, `npm run lint`, and
`node scripts/backlog-sync.mjs --check` (run from the corresponding workspace).

## Remaining gates

Review and CI precede matching delivery. Actual Desktop/mobile labels and
unsupported-Host behavior need named-distribution observation after delivery;
Host-native software labels are not necessarily the app wrapper or TrUAPI
runtime version. The existing pause/lock/artwork physical checks stay separate.
The listening-repair proposal #465 does not depend on this software-report slice.
#85 remains open for compatibility, wire and value-flow acceptance; CASH is not
enabled by software labels. Real independent recovery remains owner-deferred.

Canonical behavior: [Host software in support reports](../../../reference/host-software-support.md).
