# SDK 0.45 qualification tooling and review candidate — 20 November 2026

## Source and discovered gap

The [full quality run](https://github.com/knzeng-e/dotify/actions/runs/44715638973),
backlog and Bulletin prototype checks pass at integration head
`e5beafebfc7290260ee532aef634a086277cb25c`. This includes the actual signaling
image build/non-root startup and the browser/three-engine streaming suites.
It remains automated evidence, separate from physical Host acceptance.

A subsequent [signer-free candidate validation](https://github.com/knzeng-e/dotify/actions/runs/44740064445)
on that same source fails five static dependency checks: the journey harness
still expects SDK 0.39 / Host SDK 0.28 / TrUAPI 0.25. Its preceding 1,279 unit
tests, environment guard and read-only endpoint smoke pass. The latter makes
public network reads, not signatures or writes, and does not prove new-contract
compatibility. No candidate was published and no payment occurred.

Source `8d00e6c56b8aa054d6d20661f10674759a3de4ab` corrects the expected SDK 0.45
family. It retains exact dependency checks rather than accepting arbitrary
versions or copying expected values from the lockfile. The displayed TrUAPI
check now describes a dependency pin; it does not certify the Host from that pin.
The historical `host-wire-compatibility` report ID remains stable for consumers.

New regressions exercise the actual committed snapshot and reject the abandoned
dependency family. CASH settlement fixtures are aligned without changing their
non-executable boundary. Journey, pilot and CASH settlement tests now run in the
existing deployment-guard command so ordinary quality CI covers these consumers.

## Verified candidate

On macOS arm64 / Node 22.13.1:

- `npm run test:product-deploy-environment`: **121 pass**, including the journey,
  pilot and CASH settlement regressions. This count includes the earlier codec
  checks; it is not additive to the earlier 64-check run.
- Formatting and lint pass; lint retains the same two App hook warnings.
- The exact clean `8d00e6c5` worktree builds with the `validation` flags below.
  The frozen Product build passes with the existing large-chunk warnings.
- The journey report has **31 static passes, zero failures, one blocked Host
  journey and one Room journey not run**. It exits successfully without marking
  missing live evidence as accepted.
- Local archive extraction verifies every file against its SHA-256 inventory
  and confirms that compiled JavaScript contains the full source SHA.

| Artifact property | Recorded value |
| --- | --- |
| Source | `8d00e6c56b8aa054d6d20661f10674759a3de4ab` |
| Profile | `validation`; `VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm`, `VITE_DOTIFY_ARTIST_DONATIONS=on`, `VITE_DOTIFY_DEBUG_PANEL=true` |
| Build command | `npm run build:product-devnet:frozen` |
| Archive | `dotify-product-sdk045-validation.tar.gz`; local review artifact, not published |
| Archive size / SHA-256 | 3,564,546 bytes / `96b2e987dab4e94f2bb51864c0fb5b3f79f9220e5a27fd14173077cf5613b812` |
| Bundle inventory | 71 files / 11,002,389 uncompressed bytes, plus the archive's `candidate.json` manifest |
| Tracked identity | `dotify-test01.dot`, appVersion `[0, 1, 78]`; unchanged configuration, not a new delivered release identity |
| Delivery / signing authority | None |

The archive and manifest are prepared locally outside the repository. They are
review material, not an iPhone URL or a live replacement of the stable app. Any
qualification publication still needs a distinct reviewed identity/delivery
context. Functional contract/media/payment acceptance requires the matching
fresh contracts/API/client generation, not the abandoned old catalogue.

The corrected [candidate workflow](https://github.com/knzeng-e/dotify/actions/runs/44741172000)
passes at `8d00e6c5`, including the exact-source check, unit/environment/journey
checks, validation build and generated-source drift refusal. It holds no signing
authority and publishes no artifact. The [updated-head quality run](https://github.com/knzeng-e/dotify/actions/runs/44741178375)
is a separate remote record; consult its recorded conclusion rather than carrying
the earlier green run forward to an untested head.

## Review versus promotion

The [qualification procedure](../../../how-to/qualify-product-host-031.md)
separates code-review readiness from stable promotion. A complete, checked source
proposal can be ready for review while device acceptance is pending. Changing
that PR status does not merge, deploy, publish a Product, install a Host, reset
state or authorize a funded action. Actual iPhone info/signing and matched-generation
listening/native-payment acceptance remain open under #85. CASH #406/#408 remain
separate research/settlement scopes and stay disabled.
