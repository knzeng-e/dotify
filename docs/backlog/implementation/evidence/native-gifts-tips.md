# Native gifts and tips: implementation evidence

Date: 2026-10-01. Branch: `feat/native-gifts-tips`.
Base: tested `origin/dev`, `d75b0385cde473962b112de92eb13aa01263bb5d`.
Scope: [native gifts and work tips](../../native-gifts-tips.md).

## Delivered locally

- Native profile gifts without a donation build flag; work tips for free and
  paid releases, independent of listening entitlement.
- Exact on-chain quotes, sender intent replay protection, dated contribution
  and recipient receipts, isolated recoverable balances for rejected transfers.
- Original collaborators preserved; optional host allocation comes only from
  the artist portion. Scheduled destinations apply to the artist remainder.
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
