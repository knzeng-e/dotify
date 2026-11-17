# W30 API non-root preparation, 2026-10-21

## Source and boundary

- Issue: #285. Branch: `fix/api-nonroot-storage`.
- Tested base: `cdf92d8a224ebc4323debef53f4ddc26e07c01e1` (merged #312).
  Dev Quality Gates run `39525275473` passed at that base.
- Implementation SHA and PR are the commit/PR containing this record; retain
  their immutable links in the PR evidence after publication.
- Prepared locally only. No Fly deployment, volume access, secret change,
  master/epoch rotation, paid provider, real payment or participant contact.
- Existing Web/Product/DAV2 playback is unchanged. This closes the code/local
  rehearsal portion of the API process-hygiene remainder, not all #285 gates.

## Design

The default runner is UID/GID 1000 and starts Node directly. Existing files and
atomic writes are checked before service singleton imports. Permission failure
exits rather than appearing as an empty catalog or selecting a fresh epoch.
The bounded `api:storage-ready` event exposes process UID/GID only.

An explicitly selected offline root target inventories recognized custody files,
requires a reviewed content fingerprint, applies ownership/modes through held
file descriptors, and verifies unchanged hashes. Unknown files and unsafe links
are refused; the filesystem `lost+found` is left alone. There is no recursive
repair, state reset, key access or HTTP service in that target. Quiescence is an
operator guarantee, not a concurrent-writer lock supplied by the utility.

See the [cutover and rollback procedure](../../../operations/api-nonroot-storage.md).
It requires a stopped single writer, recoverable backup and immutable image/config
record. No new env settings, CORS origins, stores, mounts or scale changes.

Code readiness: locally verified. Release readiness: not deployed.

## Local verification

- API suite: **204 passed, 0 failed, 0 skipped**, including 10 storage/startup
  tests. Typecheck and production TypeScript build passed on Node 22.13.1.
- Storage tests cover byte preservation, safe local initialization without state
  fabrication, link/non-file refusal, inventory identity and bounded startup
  failure before trust-state initialization.
- Docker 28.0.1 rehearsal: runner user `node`, maintenance user `root`;
  root-owned data refused at API boot; wrong fingerprint changed nothing;
  migration preserved original bytes and was idempotent; backup restored on a
  separate synthetic volume; revoked/active sessions, catalog checkpoint and
  contribution receipt retained. Later revocation/checkpoint writes survived a
  root-mode rollback, and ownership could be reapplied after a root write.
- Fixture processes had no network, used synthetic tokens/receipts only, and
  had bounded resources. The script cleans up only its own named artifacts,
  including a container left running if its CLI times out.
- Rollback rehearsal used the current persistence implementations under UID 0,
  not a copy of the live API 28 image. No real Fly snapshot was restored.
- Separate CI job `W30 / Non-root storage rehearsal` repeats the Docker proof.
  Hosted CI results belong to the PR; local success is not hosted CI evidence.

Rehearsal emits only boolean outcomes and UID, never fixture tokens or stored
JSON contents. Inventory reports file names/sizes/digests/ownership, not values.

The restricted-shell repeat initially hit `listen EPERM` in the existing HTTP
media-disconnect test; rerunning with loopback permission passed. No code change
was made to suppress that test.

## Acceptance mapping

| Remaining W30 criterion | Evidence | Status |
| --- | --- | --- |
| Default API runs as node and receives direct signals | Image metadata, direct Node CMD, isolated UID 1000 process | Locally verified |
| Root-owned volume is migrated without trust-state loss | Docker backup/restore, revocation/catalog/receipt assertions | Locally verified |
| Rollback retains later accepted revocations | Root-mode rollback and reapply against latest synthetic volume | Locally verified |
| Live same-volume cutover and real session/catalog checks | Operator procedure prepared; Fly untouched | Not run |

## Remaining acceptance

#285 remains open until a separately authorized maintenance window verifies
Fly backup/recovery, same-volume cutover, actual UID 1000, health/readiness,
stable active/revoked sessions, retained catalog/receipts and existing W30 live
client-IP/TURN gates. Keep the latest volume during code rollback; never undo
later sign-outs by restoring an old snapshot. A future nonce/job ledger must be
included in a reviewed custody inventory before W32 deployment.

For #287, the owner chose **new publications first**. After this prerequisite,
connect durable bounded encode jobs and artist progress/retry, publish encrypted
manifests/segments under existing access checks, and integrate the reader/gain
with player and room audio. Existing releases stay on DAV2; re-encoding that
catalog is deferred. #312 alone does not activate new streaming, and this PR
neither installs FFmpeg in production nor changes the upload/playback route.
