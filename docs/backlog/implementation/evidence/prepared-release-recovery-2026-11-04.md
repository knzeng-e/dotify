# Prepared release recovery — 2026-11-04

## Failure and evidence

After Product/Web 0.1.70, the artist reported `Storage could not confirm this asset`
at the release-details step. The audio hash still matched the ready synthetic
pilot, but the React editor had reconstructed a filename title, a new description,
a generated cover and a 1.2 PAS price. The admitted name-only manifest instead
contains `Bulletin pilot - 8s`, the original description and cover, 1.21 PAS, and
the owner-selected `Thot Nzeng`. Recovering audio alone does not restore the form.

The custody log records a metadata-stage refusal. Read-only inspection at
2026-11-04 00:53:27 UTC found the original audio job ready (three attempts), three
original inventories (16 audio, 8 cover and 2 old metadata stores), zero pending
intents, no active job/writer barrier, and the admitted permit still present.
There is no replacement metadata inventory. This refusal did not issue another
store and is not evidence of Bulletin retrieval or quota failure.

## Recovery model

The immutable permit remains the authority. After the normal purpose-bound upload
grant, canonical artist/runtime and unregistered-release checks, and inventory
verification, custody compares the submitted manifest with that permit. A changed
audio identity remains an ordinary refusal. For the same audio with different
editable details, a typed HTTP 409 identifies field groups and returns only the
public prepared manifest and its owner/runtime/chain scope, with `no-store`.
Provider errors stay sanitized; no key, private path, allowance or receipt is sent.

The client validates the snapshot against the just-submitted audio, price units,
access rules, supported editorial fields and royalty addresses/shares. Unsupported
or malformed snapshots receive no restore control. The error action opens a
preview of saved title, artist, note, cover, access price and revenue recipients.
`Keep current draft` leaves the form unchanged. `Use prepared release` explicitly
restores the complete supported form and existing cover reference, then returns
to Review. Neither action uploads, registers, signs or automatically retries.
The ordinary Publish action still owns storage and wallet approval.

The preview and old feedback actions recheck current account, network, runtime,
connection and content hash. Context changes invalidate an open preview. A late
eager cover result cannot overwrite the reference selected by restoration.

This is deliberately a recovery offer from the admitted public snapshot, not a
second editable server draft database or an expansion of the repair permit.
The original timestamp is still reused only by the existing exact-byte writer.
Current unsaved edits are not silently substituted or persisted. General draft
persistence remains a separate design problem.

## Operational boundaries and review order

1. `bulletinMetadataRepair.ts` / `streamingPublicationStore.ts`: scope and canonical
   checks precede the offer; mismatches neither open another graph nor reset caps.
2. `app.ts` / `routes/uploads.ts`: preserve only the typed public conflict through
   error sanitization; normal upload authorization and lease release still apply.
3. `preparedReleaseRecovery.ts` / `usePreparedReleaseRecovery.ts`: validate a
   reproducible snapshot and reject stale callbacks before any form mutation.
4. `PreparedReleaseReview.tsx` / `ArtistStudioProvider.tsx`: explicit preview,
   cancel/confirm, complete form/cover restoration, then manual publication.

API/custody and Web/Product need the reviewed code before this recovery is usable.
No new setting, service, secret, grant scope, policy, admission, renewal, domain
change or live store is part of this PR. Deploy the API before matching clients;
an old client can show the explicit 409 message but cannot offer restoration.
A new client with the old API keeps the existing generic refusal. Rollback never
removes the admitted marker, inventories, receipts, budgets or nonce state.

## Validation and remaining gates

Publisher tests reproduce the lost form, verify the exact recovery snapshot,
prove zero mutation/stores on conflict and deny another owner/runtime/chain/audio.
Applying the exact snapshot through the ordinary publisher uses only the two
already bounded metadata stores and retries without duplication. HTTP tests
verify authentication, no-store responses, redacted logs and released leases.
Client tests check exact pilot round-trip, malformed responses and no auto-retry.
Browser controls cover explicit apply/cancel, desktop/mobile layout, stale feedback
and an open preview invalidated by an account switch. These are local controls,
not a live or physical-device publication claim.

Live rollout, the artist's wallet registration and protected Web/physical Host
allowed/denied listening remain acceptance gates. W33/#288 stays open for those
gates and conservation/renewal/off-volume recovery. A successful restoration does
not extend Bulletin retention or establish long-term availability.

Local verification: API typecheck/build passed; 323 of 325 API cases passed inside
the restricted sandbox, with the two socket-binding cases blocked by EPERM.
Both affected files then passed with local port permission (11/11 cases), covering
the two blocked assertions. The focused publisher/metadata HTTP set passed 33/33.
Five affected frontend unit files passed 53/53; Chromium and WebKit each passed
8/8 recovery controls at 390/1280px. Web and frozen Product DevNet builds passed.
Frontend lint has zero errors and the two pre-existing App.tsx dependency warnings.
