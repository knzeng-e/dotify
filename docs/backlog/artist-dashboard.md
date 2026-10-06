# Artist dashboard and shared native support history

Owner-requested continuation of [#229](https://github.com/knzeng-e/dotify/issues/229), 2026-10-07.

The owner confirmed that Product 0.1.39 recovers the pending mobile tip, then
reported that the artist dashboard did not include it. The requested outcome
also includes a clear, modern and useful artist workspace.

## Scope

- Persist native receipts only after the existing canonical finalized-chain verification.
- Make verified support visible across devices and API restarts.
- Combine EVM and saved native receipts without double counting; reconcile outstanding claims against finalized contract state.
- Share one contribution snapshot across Overview, Earnings and release totals.
- Put the artist's received share first, distinguish generated and claimable amounts, and separate listening, gifts and tips.
- Add real dated activity, a fourteen-day receipt chart and responsive catalog actions; show recent support before the catalog on phones.
- Keep unavailable/stale sources explicit and preserve known values on refresh failure.
- Preserve publication, consent, wallet signing, access and recipient distribution.

## Boundaries

The saved native receipt collection is not an exhaustive native block indexer.
New confirmed Product contributions pass through it automatically; older
receipts need verification through the receipt endpoint. Native historical
listening royalties and receipt-verified room-chat broadcasting remain outside
this increment. Never present recorded totals as a wallet balance or invented
listener analytics. #229 remains open for those wider acceptance gates.

Base: tested `origin/dev` `76d07e7350e83d8c5e29d1b2f1b3650288dd16ca`, with the
already-published receipt fixes through `51f403a` retained as prerequisites.
Branch: `feat/artist-dashboard`.
