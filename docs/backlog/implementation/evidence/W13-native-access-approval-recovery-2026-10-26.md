# Product Classic approval expiry recovery, 2026-10-26

Refs #158 / [W13](../W13-pilot-release.md). Tested base:
`c71947a294907bdaf0a92ea0c544876fa39309d4`, merged #333; full dev CI
[40147843391](https://github.com/knzeng-e/dotify/actions/runs/40147843391) passes.
Implementation: `0683df4e070228e2e361ccd29d582b731961956d`. This is a narrow
payment-recovery fix, not W35 or another deployment.

## Report and diagnosis

An owner missed the Product phone approval window. The saved Classic attempt
then offered only a status check, whose technical message incorrectly said a
payment transaction had been included. The coordinator reserves before asking
for approval and correctly retains ambiguous attempts, but lacked proof that
an expired approval could never submit later. Rechecking a no-hash reservation
also reused wording written for a known included payment.

One read-only finalized runtime check found no paid grant or playable access
for the reported scope. This does not prove there was no pending transaction.
No user payment, signature, local journal deletion or live state change ran.
The old screenshot alone cannot establish its original Host error class.

## Design and safety boundary

The production Product writer passes the exact selected Host signer into each
Classic contract call through the SDK's supported signer override. A small
attempt-local proxy records a real signer request and whether signed transaction
bytes have returned. Mock/dry-run signing does not count. The scope closes on
completion or failure; a late Host result or later invocation rejects before
it can hand transaction bytes to submission.

Only after closing that scope can a typed `TxTimeoutError`, or
`HostTimeoutError` for `createTransaction`, become `approval-expired`, and only
when a real request was made, no signed transaction returned and no SDK
signed/submission evidence was observed. The pinned tx SDK 0.5.3 emits its
`signing` callback on `created` (already signed), so that event is conservatively
retained as uncertainty too. Generic errors and unsigned-looking legacy journals
are not enough to establish this new guarantee.

The coordinator releases only the proven-unsubmitted reservation. The receipt
offers **Try payment again**; it never submits automatically. The existing flow
checks identity, fresh paid/access state, balance and reservation before the
new explicit approval. A returned signature, broadcast/inclusion/finality event,
transaction hash, unclassified error or old unresolved journal retains read-only
recovery. Removing the unsupported inclusion assertion changes no entitlement.
Content keys and playable audio remain gated by authoritative access checks.

No SDK/dependency, secret, contract, value conversion, payment rail, persistence
format, permission, API/signaling/encoder or session changes are included. There
is no migration that guesses what happened to the owner's old attempt. An old
unresolved receipt still needs reconciliation; installing this patch cannot
prove that a historical request was never signed. The Host may still show an
old prompt; its late response cannot submit through a closed new-code attempt.
This lifetime guarantee applies only to the pinned Host transaction-creation
path, which returns bytes for the application to submit, not a custodial wallet
API that independently submits a payment.

## Verification

On Node 22.13.1:

- **1,013 unit tests / 127 files pass** on the implementation SHA. The new
  lifetime tests use the actual pinned SDK `submitAndWatch` and timer, a fake
  transport and deferred synthetic signing. They prove timeout cleanup and
  that even an intentionally late continuation ignoring unsubscribe cannot
  obtain the old signed bytes, broadcast or resurrect the journal. Tests retain
  post-signature/submission uncertainty and distinguish mock signing/errors.
- The 69 focused payment/adapter tests pass, covering guarded expiry, explicit
  retry after reload, old unknown reservation retention, cancellation, funds,
  account changes and repeated checks without a second payment.
- **14 Classic Chromium journeys pass**, including mobile/desktop receipts,
  persistence, rejection, account loss, paid-but-unavailable audio and the new
  direct retry. The new scenario was rerun on the final implementation SHA:
  no key before approval, one failed request, no automatic resend, then one
  explicit retry and verified full playback.
- TypeScript, lint and formatting pass. Lint retains the two existing App E2E
  hook warnings. Ordinary Web and frozen Product builds pass with existing
  large-chunk warnings. Backlog offline and whitespace checks pass.
- Hosted CI belongs to the linked PR; local browser fixtures are not physical
  native signing, fee, finality or settlement evidence.

## Rollout and remaining acceptance

Publish matching clients only after review. No server restart is required.
Preserve old unresolved journals and use the original deployment origin/account;
never clear app storage merely to expose a payment button. Rollback is the
previous client with existing records intact; already closed old scopes cannot
be reopened by installing another bundle.

On actual Desktop/mobile Product, leave a new approval unopened until expiry,
then open Polkadot App and choose Try payment again explicitly. Also exercise
an approval returned before a confirmation timeout: it must remain read-only.
Verify same-account access before any real additional payment. Pending reference
reconciliation and full W13/#158 acceptance remain open. No deployment, funded
transaction or accepted-pilot claim is made here.
