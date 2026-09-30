# Artist earnings and workspace correction

## Scope and baseline

- User-requested follow-up to W12 (#156), W25 (#180), and artist gifts. No new
  backlog sequence, contract migration, payment policy, deployment or spending.
- Base: `8602f75e85d31ef3891eaaaea6e1f9a69655211a`, fetched from `origin/dev`.
- Branch: `fix/artist-earnings-studio`, continuing the uncommitted Product
  donation-recipient fix on that same base, without unrelated worktree changes.
- Local toolchain: Node 22.13.1, installed npm lockfile dependencies; no upgrade.
- Important baseline limitation: dev CI run
  [36762960878](https://github.com/knzeng-e/dotify/actions/runs/36762960878)
  failed `celerityCapture.test.ts:53`: asynchronous frame order yielded
  `[1, null, null]` instead of `[null, 1, null]`. This unrelated test passes
  locally. Do not describe the base as CI-green or silently weaken its test.
- Tested implementation: `39601d0b4356d0c83bad60fb394124d8a49a7fcb`.
- Draft PR: [#228](https://github.com/knzeng-e/dotify/pull/228), targeting `dev`.
  The final browser rerun passed all 26 scenarios in 53 seconds; changed-source
  lint passed without errors or warnings. This handoff commit is documentation-only.

## Diagnosis

The overview rendered default empty royalty state until the Earnings tab was
opened. Product CDM has no event-history implementation, so errors could also
look like zero income. The gift preview separately misread named SDK outputs
as tuple/bare-record results, preventing verification of the original artist.

A read-only RPC check of runtime
`0xB60e91CcAcD08B6cb0Ddb2E678F90791901e9338` on chain `420420417` found two
access payments in blocks `13388284` and `13589258`: **8.41 PAS gross**, of
which **4.711 PAS** was paid to artist
`0xC3571714248588C6E19cDECe2778B75341b2c288`. The remaining shares went to a
collaborator. These are observed public records, not test fixtures, a current
wallet balance, or a guarantee about future totals. No transaction was sent.

## Delivered behavior

- Overview immediately checks history, then refreshes every 15 seconds after
  the previous request completes while the workspace is visible, and on focus.
- Generated-by-work totals, verified recipient receipts, and claimable balances
  are separate. Split recipients and later claims do not create extra sales.
  Runtime plus content hash scopes each work; duplicate event IDs are ignored.
- Complete history snapshots are retained on refresh failure, visibly stale.
  Initial failure displays Unavailable rather than zero. Network/account/runtime
  changes invalidate both the snapshot and late results. Balances have their
  own availability checks. Nothing is persisted in browser storage.
- Product history explicitly uses public EVM reads with a network-ID check,
  not Product signing or entitlement fallback. Gift verification understands
  current named SDK results and the previously accepted response shapes.
- Compact artist header with artwork, one publish action, readable unframed
  earnings, searchable works, per-work totals and contextual receipt details.
  Release records, addresses and recovery internals remain folded by default.
- Package version prepared as `[0, 1, 33]`; activation defaults are unchanged.

## Verification

| Command from `web/` | Result and coverage |
| --- | --- |
| `npm run test:unit` | 734 tests / 91 files passed, including SDK decoding, donation safety, split/claim aggregation, access and publication guards |
| `npx playwright test e2e/artist-earnings.spec.ts e2e/artist-publish.spec.ts e2e/artist-gift.spec.ts --workers=2` | 26 passed: refresh, stale/unavailable readings, publishing and recovery, no duplicate gift submission, 320/390/430/1440 px, enlarged text |
| `npx tsc -b` | Passed |
| `npm run build` | Passed |
| `npm run fmt:check` | Passed |
| `VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm VITE_DOTIFY_ARTIST_DONATIONS=on VITE_DOTIFY_ROOM_REALTIME=dual npm run build:product-devnet:frozen` | Passed without modifying catalog bootstrap or deploying |
| `npx eslint . --ignore-pattern '.data/**'` | No errors; two existing App.tsx effect-dependency warnings |
| `git diff --check` | Passed |
| `node scripts/backlog-sync.mjs --check --offline` from root | Passed |

The unfiltered local lint command encounters pre-existing generated W13 bundles
under `.data/`; those artifacts were neither removed nor edited. Unit tests emit
a React server-render warning for the client-only layout effect in the existing
publication-guard harness. Product build warnings cover pre-existing large
chunks, a mixed static/dynamic import, and a dependency pure annotation.

## Visual evidence

Playwright uses deterministic RPC events and the existing artist-cover fixture,
not a live payment or real Product host. Screenshots were visually inspected;
the artwork is explicitly awaited rather than capturing empty loading images.
All four studio tabs are captured at each width; search and 200% root text are
also checked for horizontal page overflow. Representative captures:

- [Desktop overview](../../../images/artist-earnings/overview-1440.png)
- [Mobile release management](../../../images/artist-earnings/releases-390.png)
- [320 px enlarged text](../../../images/artist-earnings/enlarged-320.png)

## Boundaries and next gate

This is near-real-time polling, not push or a finality guarantee. It scans full
event history in known runtimes; large catalogs will need bounded indexing.
Unindexed historical collaborations may be absent. Direct gifts and network
fees are deliberately excluded from work revenue. Legacy access-only events
prove gross income, not who received it. The latest-chain read can change after
a reorg. Existing writer, claims, wallet/key checks and access policies remain.

No physical-device or real Product signing check was performed for this patch.
Next: review and CI, then a separately authorized candidate. In Product Web and
Desktop, compare Overview/Earnings against existing receipts, open the gift
recipient preview without signing, and test refresh failure/recovery. No new
payment is necessary to validate the earnings correction. See the updated
[operations runbook](../../../operations/deployment-configuration.md) and
[accounting explanation](../../../explanation/royalty-settlement.md).
