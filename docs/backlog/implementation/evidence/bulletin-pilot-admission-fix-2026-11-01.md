# Bulletin pilot: admission accounting and asset failures

Refs #288 (W33), #287. Source: tested dev `a74c5242` after #373 and Product 0.1.68.
This is a correction candidate, not a live deployment or an allowance increase.

## Two independent failure paths

The reported modal comes from `POST /api/uploads/cover`: custody request logs
show HTTP 502. This route still uses Pinata. The old handler maps every
`PinataError` to the same generic retry message and does not record the upstream
status, so the historical event cannot establish a specific provider refusal.
Read-only authentication succeeds. The account owner subsequently confirmed
the free plan and its reached file limit. This establishes a separate provider
admission blocker; the missing historical upstream status is still unknown.
No diagnostic file upload, subscription change or deletion was performed.

Separately, the admitted synthetic audio has a failed durable preparation:
three processing attempts, a 16-block publication inventory, zero attempted
stores, no pending submissions and no receipts. An earlier out-of-scope draft
was also rejected; its data/state are preserved. A ready asset step in the
modal was therefore not evidence of completed audio or cover storage.

## Reproduced accounting defect

The adapter required `attemptedStores + missingBlocks + graphBlocks` to fit
`budget.maxTransactions`. It mixed **actual attempted stores** with **reserved
future renewals**. A fresh 16-block graph and an explicitly authorized 16-store
cap therefore demanded 32 slots inside that cap, even when the account had
ample quota. The exact-bound regression fails on the original condition with
`Bulletin job allowance exhausted` before the first write.

The corrected job check is `attemptedStores + missingBlocks <= maxTransactions`.
The independent live-account quota check still requires missing stores plus a
renewal slot for every graph block, as well as the full renewable byte floor.
Existing prior-publication reserves, byte caps, durable failed-attempt charging,
nonce barriers, receipt verification, one-job scope and profile bindings remain
unchanged. No profile value, on-chain allowance or runtime policy is enlarged.

The new regression publishes exactly 16 blocks with a 16-store cap and 32 live
slots, leaving 16 slots reserved. Reopening the same job reads it without another
store. A cap of 15, or a live quota of 31, refuses admission before any submission.
Existing uncertain-write and cross-release reconciliation tests remain applicable.

## Clearer failure reporting

Cover/metadata routes retain `UPLOAD_STORAGE_FAILED` / HTTP 502 and add only
`failure.stage` (`cover` or `metadata`) and an optional integer upstream HTTP
status from 400 to 599. The same fields are logged, without the raw error,
provider body, credentials or file content. Account refusals (401/403) explain
that storage needs attention; 429 explains a temporary busy state. Unknown
statuses remain generic. The existing Web client displays the safe message.

The roadmap only calls the assets “Music ready” after the assets stage has
completed. A failed draft remains saved, without a blanket invitation to retry
an exhausted job or a blocked provider account. Submitted-transaction/catalog
messages retain their existing confirmation boundaries.

## Deployment and recovery boundary

The API correction is compatible with the deployed 0.1.68 client: the existing
error code/status remain stable and the safe error string already renders there.
It can roll out after review/green CI without a new Product publication. The
roadmap wording ships with the next Web/Product client release. This patch
changes no environment variable, secret, schema, account authority or Host permission.
It does not reset the failed job's three processing attempts, erase encrypted
output or create a replacement queue. The existing pilot inventory owns that
job even after discard; starting another upload is not a recovery strategy.

Before another live attempt, inspect the preserved prepared ciphertext,
immutable inventory, account cursor, pending submissions and authority. The
existing job needs a separately reviewed controlled recovery because its normal
three-attempt retry is exhausted. Reuse its prepared output and original scope,
keep all permanent nonce history and the original 16-store / 1 MiB ceiling, and
never treat this patch as permission to replenish its budget. Fix or confirm
Pinata cover admission separately. A successful storage recovery still requires
ordinary artist-wallet registration and protected Web/physical Host acceptance.

## Validation

- Original-condition regression: exact 16-store publication fails before a write.
- Corrected API suite: 292 tests pass, including store/reserve separation,
  uncertain submissions, protected access and cover/metadata redaction.
- API TypeScript check passes; targeted form/preparation tests: 20 pass.
- Web lint: no errors, two existing `App.tsx` hook warnings. The preparation test
  harness emits its existing server-render `useLayoutEffect` warning.
- Web build and diff checks are recorded with the candidate PR. No live fix,
  audio store, queue mutation or provider upload is implied by these tests.
