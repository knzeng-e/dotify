# Streaming-only internal reset

## Current reconciliation, 2026-10-23

#321 is merged and the streaming-only path deployed in the 0.1.58 coordinated
reset. #320 closes as compatibility cleanup, not as an accepted native streaming
pilot. #287/#317/#158 retain real publication/audio/value-flow acceptance.

Issue: #320. Priority P1; Track Production spine; Phase Now; Type Work.
Depends on the empty-directory cutover in #317 / #319 and W32 / #287 / #318.

## Owner decision

On 2026-10-21 the owner explicitly chose to retire the internal test catalog and
its compatibility burden. Earlier plans to migrate or keep DAV1/DAV2 releases
playable are superseded. Artists will recreate their runtime and publish again.
This source change does not delete live contracts, pins, volumes or secrets.

## Scope

- One publication path: signed artist upload, durable job, isolated encoder,
  authenticated v3 directory and on-chain artist approval.
- One playback format: authenticated AAC renditions, standard MSE when supported,
  otherwise the same rendition in a bounded Blob. Never the archival master.
- Remove old container codecs, byte-range recovery, browser-derived demo keys,
  hash-only key scope, migration fixtures and obsolete worker packaging.
- Keep release-bound HKDF bytes, key-version rotation, permanent nonce custody,
  Classic/Free authorization and walletless room guests unchanged.
- Measure and exercise the actual current path; old QA exports are not evidence
  for this reset. First-sound schema 6 does not import schema 5 records.

## Acceptance

Typechecks/builds, API/key/custody tests, useful current-format transport and
browser regressions, and coordinated deployment documentation must pass review.
Native Product first-sound, real upload/pin load and prolonged multi-device room
listening remain W13/W32 deployment gates; this cleanup cannot establish them.
An absent encoder returns HTTP 503 for publication, without an older writer.

## Review map

1. `services/api/src/services/keyVault.ts` and `chainAccess.ts`: full release
   identity, unchanged v2 HKDF and no hash-only authority.
2. `routes/uploads.ts`, `routes/media.ts`, `services/encryptedMedia.ts`: only jobs
   and fixed registered ciphertext objects, bounded cancellation/cache.
3. `web/src/hooks/useCatalog.ts`, `features/catalog/streamingPlayback.ts`:
   one authenticated reader, no authentication fallback or hidden signing.
4. Current-format fixtures, first-sound schema and deployment procedure.
