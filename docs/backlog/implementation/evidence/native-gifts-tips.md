# Native gifts and tips: implementation evidence

Date: 2026-10-01. Branch: `feat/native-gifts-tips`.
Base: tested `origin/dev`, `d75b0385cde473962b112de92eb13aa01263bb5d`.
Scope: [native gifts and work tips](../../native-gifts-tips.md).

## Delivered locally

- Native profile gifts without a donation build flag; work tips for free and
  paid releases, independent of listening entitlement.
- Exact on-chain quotes, sender intent replay protection, dated contribution
  and recipient receipts, isolated recoverable balances for rejected transfers.
- Optional host allocation is deducted from the full room tip before the
  remainder follows the registered work split. Scheduled destinations apply
  only to the artist's resulting share.
- Artist Rights editing for allocations, purpose, dates, room authority and
  campaign reference; Earnings and You history, claims and JSON export.
- Server-attested connected host/room/work attribution and finalized,
  canonical receipt validation before a deduplicated room chat announcement.
- Persistent, account/network/runtime/work-scoped recovery. A pending modal
  can close without canceling; uncertain recovery never sends another payment.
- Existing-runtime upgrade selectors and generated ABI/CDM types. No old
  access, royalty or protected-content storage layout was replaced.

## Automated checks

All commands below run locally, not against funded public signers.

| Command / location | Result and scope |
| --- | --- |
| `npm test`, `contracts/evm` | 72 passed: native contribution math, schedules, stale quote rejection, payer-bound room proof, repeated intent rejection, failed-recipient recovery, existing royalty/access behavior and owner-confirmed upgrade preservation. |
| `npm run test:unit -- --reporter=dot`, `web` | 743 passed in 94 files: includes persistent recovery, account changes, uncertain submissions, ledger dates/claims and duplicate log handling. |
| `npm run test:signal`, `web` | 72 passed: includes host identity and quote binding, changed hosting sessions, canonical/finalized receipt checks, deduplication and existing room boundaries. |
| `npm test -- --test-name-pattern=auth`, `services/api` | 150 passed (the package command ran the full suite), including accepted/rejected session identity reads. |
| `npm run typecheck`, `services/api` | Passed. |
| `npx playwright test e2e/artist-gift.spec.ts e2e/artist-publish.spec.ts e2e/artist-earnings.spec.ts e2e/room-join.spec.ts --reporter=line`, `web` | Final grouped run: 43 passed, including saved policy and personal receipt/export paths. |
| `npm run build`, `web` | Passed, including TypeScript checks. |
| `npm run build:product-devnet:frozen`, `web` | Passed for the tracked viem profile. |
| `VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm npm run build:product-devnet:frozen`, `web` | Passed for Product CDM. A build is not device signing evidence. |
| `npm run smoke:production-env`, `web` | Passed: missing public endpoints and exposed production secrets fail closed. |
| `npx eslint src server e2e playwright.config.ts`, `web` | Passed; two existing dependency warnings in unchanged `src/App.tsx`. |
| `npm run lint -- --ignore-pattern '.data/**'`, `web` | Passed, with the same two existing warnings. Plain `npm run lint` scans old local W13 rollback bundles under `.data/` and reports 5,476 generated-code errors; those unrelated artifacts were not changed or deleted. |
| `npm run fmt:check`, `web` and `contracts/evm` | Passed. |
| `npm run generate:abis` / `npm run generate:cdm` | Repeated generation is stable: compared content hashes before/after. |
| Product bundle fixture-marker scan | No `__DOTIFY_E2E_DONATION__` test adapter marker in production JavaScript. |
| `node scripts/backlog-sync.mjs --check --offline`, repository root | Passed for the existing manifest. Remote metadata for this new local ticket remains pending publication permission. |
| `git diff --check` | Passed. |

## Visual checks

Playwright captures cover 320, 390, 430 and 1440 px, plus enlarged text for the
artist navigation. Inspected the 320 px gift confirmation, 320 px Rights form,
390 px Earnings, personal contribution ledger and 1440 px Rights screenshot. No horizontal page overflow or
overlapping controls was observed in these views. Keyboard tab navigation and
modal focus restoration remain covered. These are Chromium captures, not a
claim of physical iPhone validation.

Preview: `http://127.0.0.1:5279/` (HTTP 200). This ordinary development server
does not activate test signers or upgrade real runtimes. Port 5275 was already
occupied and was left untouched.

Build warnings remain for large existing chunks, outdated Browserslist data,
the scure annotation and the existing protected-audio mixed import. Unit-test
stderr includes the expected simulated Celerity interruption and an existing
server-render useLayoutEffect warning; none failed validation.

Reproducible screenshots are in the ignored `web/test-results/` directory,
including `gift-review-320.png`, `320-studio-Rights.png`,
`studio-Earnings-390.png`, and `personal-contribution-history.png` under their
Playwright test output folders. Test fixtures are explicit development-only
adapters; exact distribution and settlement are separately tested in Hardhat.

## Release boundaries

No deployment, runtime upgrade, CDM metadata publication, paid transaction or
physical Product test was performed. The old factory cannot install new
selectors automatically; existing and newly created old-factory runtimes need
the documented owner-approved upgrade. Preserve runtime addresses and claims.

Room attribution trusts the artist-approved server attestor and verified API
session. It is not proof of a unique human or audible listening. Policies and
financial receipts expose payer, work, host and destination addresses on-chain;
chat remains ephemeral and does not broadcast amounts. A cause description is
an artist declaration, not a verified charity badge.

History polls finalized events every 15 seconds while visible, for known
catalogue runtimes only. It is not a complete cross-chain indexer, does not
include old direct transfers and cannot promise instant finality. Ambiguous
submissions remain blocked for recovery, not automatically retried.

Ambassador profiles, campaign membership/governance, reputation and matching
funds remain explicitly deferred. CASH and PVM behavior is unchanged.

Publication was authorized on 2026-10-01. Implementation is tracked in
[#229](https://github.com/knzeng-e/dotify/issues/229), with a draft PR targeting
`dev`. GitHub checks are separate from the local evidence above; deployment
and funded Product acceptance remain operational follow-ups.

Operational instructions: [deployment configuration](../../../operations/deployment-configuration.md#native-contributions-activation-2026-10-01).
Design and limitations: [native contributions](../../../design/native-contributions.md).

## Earnings layout follow-up (2026-10-01)

The artist requested an overall revenue view before Gifts & tips. The Earnings
screen now leads with combined generated/received/claimable figures, followed
by a three-source table (listening payments, gifts, tips). Detail tabs default
to listening payments; the contribution receipts remain a separate view below
the shared overview. Existing personal history in You remains available.

`useContributionHistory` owns one polling lifecycle shared by the summary and
ledger. The new pure aggregation distinguishes artist-runtime gross revenue
from account receipts, includes legitimate cross-runtime host/collaborator
shares, ignores duplicate contributions and does not turn an unknown source
into zero. Stale snapshots remain labeled; a claim changes received/pending
amounts without increasing generated revenue.

The source table and payment list are unframed. On small screens the artist
identity retains sufficient width, with New release on a separate row. This
follow-up does not change contracts, settlement policy or wallet signing.

- `npm run test:unit -- --reporter=dot`: 746 passed in 95 files.
- Playwright artist earnings, publishing and gifts suites: 33 passed, including
  mixed-source totals, claim transitions, unavailable/stale sources and keyboard
  navigation between detail tabs.
- `npm run build`: passed. Targeted ESLint on the changed modules/tests: passed.
- Responsive captures cover 320, 390, 430 and 1440 px, plus enlarged artist UI
  text. Desktop and 320 px screenshots inspected, including both detail views.
- Updated preview: `http://127.0.0.1:5279/`, HTTP 200. No deployment or publication.

Screenshots: `studio-Earnings-<width>.png` and
`studio-contributions-<width>.png` in the corresponding artist-earnings folders
under ignored `web/test-results/`.

## PR #230 review follow-up (2026-10-01)

- The room host percentage now applies to the full tip. The remainder follows
  every registered rights-holder share; artist destinations can redirect only
  the artist's result. A 10 PAS tip with host 20% and work 70/30 pays host 2,
  artist portion 5.6, collaborator 2.4. No runtime was upgraded in this pass.
- Room notices deduplicate by the canonical receipt transaction hash, including
  mixed-case submissions. A zero-share artist is omitted from free-release
  registration when another rights holder has a positive share.
- The host account action moved to People controls to preserve the compact room
  player and keyboard composer geometry. Gift amount naming and Earnings
  definition-list markup satisfy accessibility checks.
- Local checks: all 72 Hardhat tests, 4 room contribution tests, 20
  release-form/split tests, 8 targeted Chromium accessibility/room cases and
  all 27 room-workspace scenarios passed. Build, formatting and scoped lint
  passed. The first sandboxed Playwright attempt could not bind its local
  server; the permitted rerun passed.

## DevNet runtime upgrade (2026-10-01)

At the artist's explicit request, only SmartRuntime
`0xB60e91CcAcD08B6cb0Ddb2E678F90791901e9338` was upgraded on chain
`420420417`. The configured local signer matched the runtime owner. No
frontend, factory, other artist runtime or CDM package was published.

- Pre-upgrade finalized catalogue snapshot: block `13930212`, 9 tracks,
  state hash `0x2a2bdc98386292c73d891a994280466bb58d624466eb1b7f09e2da018b7964b7`.
- New `MusicRoyaltiesPallet` facet:
  `0x5a437fDfC4758D7438Ad7F9fE5b1c8FA00857B32`, deployed and bytecode
  verified at finalized block `13930283`. Source/deployed code hash:
  `0x3b8401f7fcaa9a7a3d933b35aaef5e1574dc20f020b277c8d767d78bb753d10d`.
  [Deployment transaction](https://blockscout-testnet.polkadot.io/tx/0x7037e06cfd1a6f16f187cb2f6f0b0a838ebb68144d861066c002ebc16c015c44).
- The owner-confirmed plan simulated successfully, then replaced 13
  royalties/contribution selectors on this runtime. The upgrade was verified
  finalized at block `13930319`; all 13 routes point to the new facet and the
  catalogue snapshot was unchanged.
  [Upgrade transaction](https://blockscout-testnet.polkadot.io/tx/0xe7138518f4b21775f05897faea7174121bd5a2186c749c01cdffb20834827059).
- Independent post-upgrade export at finalized block `13930328`: 9 tracks and
  the same state hash as before. The tool's final status is
  `verified-finalized` with `catalogueStatePreserved: true`.
- The first facet-deploy attempt stopped at `prepared-before-broadcast`,
  with no signed transaction hash, because Hardhat accepted an unprefixed
  32-byte hex key but the raw-signing path did not. The script now validates
  and normalizes either supported hex form. The retry used a fresh evidence
  path and a single successful deployment nonce. All 72 contract tests passed
  after the fix.

The local evidence files are under `/tmp/dotify-b60e-*-20261001.json`; they
contain public chain/catalogue data only. This proves the selector change and
state preservation, not a funded end-to-end gift/tip or Product-device flow.
The PR's separate web Playwright failures are not cleared by this runtime
upgrade. Frontend/CDM publication and user-facing acceptance remain separate.

## PR #242 review follow-up (2026-10-07)

A successful Product SDK result with a valid transaction hash now returns that
hash even when optional block metadata is absent or malformed. The contribution
journal saves the hash before receipt confirmation; the pending payment can
then use the manual receipt-block locator. Invalid metadata is not persisted
as proof, and uncertainty never triggers another send. User-facing recovery
text covers any payment lacking usable SDK metadata, including new payments.

- Four integration regressions exercise the Product adapter and journal with
  missing blocks, invalid numbers, invalid indexes and invalid block hashes.
  Each preserves the hash across another check, accepts a manual locator and
  confirms the original payment with exactly one SDK transaction call.
- Targeted contribution flow, Product adapter and writer-provider tests: 41
  passed. Frontend type checking and scoped lint passed. All 22 gift/tip browser
  scenarios passed, including mobile archive recovery and no resubmission.
- The web README identifies 0.1.39 as the API-backed receipt build and labels
  0.1.38's host-RPC reader as superseded. Operational notes distinguish these
  review fixes from the existing published executable.

No new deployment or funded payment is part of this review follow-up.
