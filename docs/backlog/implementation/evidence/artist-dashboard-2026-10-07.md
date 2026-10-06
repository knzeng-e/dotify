# Artist dashboard — 2026-10-07

Scope: [artist dashboard](../../artist-dashboard.md), continuation of [#229](https://github.com/knzeng-e/dotify/issues/229). Review: [PR #243](https://github.com/knzeng-e/dotify/pull/243), stacked on the receipt-recovery prerequisite [PR #242](https://github.com/knzeng-e/dotify/pull/242).

## Delivered behavior

The owner confirmed that the original mobile payment finally completed in Product 0.1.39, but the artist view omitted it. Verified native tips now enter a persistent shared history; the dashboard combines this with its Ethereum source and uses the same contribution snapshot across Overview, Earnings and release totals.

The overview leads with the artist's received share, distinguishes all-recipient generated value and claimable amounts, separates listening/gifts/tips, and shows dated recent activity and a fourteen-day receipt chart. Mobile puts recent activity before the catalog. Unavailable data is not a zero; a failed refresh retains the last successful figures. The chart dates later claims to the original payment, as disclosed in the interface.

## Automated and visual evidence

- Frontend unit tests: 791 passed across 102 files.
- API type checking and tests: 165 passed. Coverage includes complete distributions, wrong-network rejection, atomic save, restart persistence, duplicate receipts and consistent pagination.
- Chromium artist earnings, publishing and gift scenarios: 48 passed. A native receipt appears on a fresh browser without the payer's local journal, with a native proof link; stale/unavailable sources, claims, existing publication behavior and payment recovery remain covered.
- Frontend type checking, scoped lint, API build and frozen Product build passed. Lint retains two pre-existing App hook warnings; bundle-size warnings remain.
- Responsive layouts were checked at 320, 390, 430 and 1440 px, including enlarged text. The captures below use deterministic test data; their amounts are not a statement of this artist's live revenue. They precede the final clarification that native listening history may be missing.

[Mobile dashboard](../../../images/artist-dashboard/native-history-390.png) · [Desktop dashboard](../../../images/artist-dashboard/native-history-1440.png)

## Public rollout

- Product executable: `app.dotify-test01.dot`, version **0.1.40**.
- Frontend source: `0aef57670c71a60d46f67f7d5f62d008561afcb8`. The follow-up evidence commit changes documentation only.
- Atomic executable publication transaction: `0xfa851d5df2a4787067e4e29337abd7fb2892c1a08f199cac85adee3f92b46ee2`.
- Executable CID: `bafybeia4lm3ybgkqod3majkgu52xvbpnmlrtpnogjjutkxtxhfqbroyjzu`.
- Public verification: `2026-10-06T22:49:38.697Z`. Finalized DotNS manifest/version/contenthash agree; the gateway CAR's index and JavaScript entry exactly match the local build, including its source revision.
- API source: `48e3bda9af3ba26ec65b2f794ee96dd169956857`. The later frontend commit only clarifies the history coverage text.
- Exactly one API machine in AMS writes `/data/contributions/receipts.json` on the encrypted 1 GiB `contribution_data` volume. Other volumes were preserved.
- The previously finalized tip was verified against its canonical native receipt and saved. An independent instance of the new frontend history reader retrieved it from the public API. A real API machine restart preserved exactly one matching record, checked at `2026-10-06T22:40:24.977Z` (October 7 in Paris). No new payment was submitted.
- A managed volume snapshot reached `created` at `2026-10-06T22:44:05Z`, with 14-day retention and automatic snapshots enabled. Restoration from that snapshot was not rehearsed. Automatic approval rejected a separate full-ledger local export because of other users' payment/address metadata; no such export was made. The managed snapshot keeps the backup inside the hosting boundary.

## Remaining boundaries

This is a verified-receipt collection, not an exhaustive native chain indexer. Earlier unverified support and native listening payments can be missing; the interface says so. New Product contributions are recorded when their successful receipt is verified through the API. Existing older receipts can be recovered through that same verifier without another payment.

The current user's mobile finalization is confirmed; physical-device confirmation of the newly published dashboard remains pending. Browser tests and a public history read do not substitute for that check. Native room-chat receipt broadcasts, exhaustive historical coverage and the wider funded/device acceptance scope remain under #229. No contract or payment distribution policy changed.

Operational limits and rollback instructions: [deployment configuration](../../../operations/deployment-configuration.md#shared-native-contribution-ledger-product-0140).

## PR #243 review follow-up

- Catalogs beyond 100 runtime addresses are read as deduplicated batches. Offset resets for each batch, but snapshot revision and the 25-second deadline cover the entire refresh. A failure or revision drift in a later batch rejects the reading rather than publishing partial income.
- The history route permits 600 requests/minute/IP: four complete 100-page scheduled refreshes plus two manual refreshes. A regression using the real Fastify rate-limit plugin and a 10,000-receipt ledger proves all six reads complete and request 601 receives HTTP 429.
- Targeted frontend history/dashboard tests: 8 passed. API type checking and frontend type checking/scoped lint passed. The full API suite passed all 166 tests; both fresh-device browser scenarios passed at 390 and 1440 px.
- These source fixes are not included in the published 0.1.40 executable/API described above; a subsequent rollout must deploy both components.
