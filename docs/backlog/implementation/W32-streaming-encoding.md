# W32 - Encode releases for streaming at upload

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W32** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record.

- Branch: `feat/streaming-encoding` created from the latest tested `origin/dev`.
- Dependencies: W30. Refs #88.
- Release stage: Next (streaming experience track). Applied during the trusted pilot when ready.
- Product purpose: every protected or free release starts within a second on every supported browser, without downloading the whole file first.

## Problem at audit

- Uploads are encrypted in their original format; there is no transcoding (`services/api/src/services/mediaValidation.ts:109-130`). WAV and FLAC masters are served as is.
- Progressive playback uses MSE only when the browser supports the original MIME type (`web/src/shared/utils/audioV2.ts:182`); otherwise the client downloads and decrypts the whole file before the first sound.
- DAV2 uses 512 KiB chunks with a 256 KiB first chunk (`services/api/src/services/audioV2.ts:6-7`), which is unrelated to media frame boundaries.

## Outcome

1. **Streaming renditions.** The backend transcodes each upload to AAC-LC in fragmented MP4 at 96, 160, and 320 kb/s (Opus/WebM optional where supported), with segments of about 4 seconds and one init segment per rendition.
2. **Same protection model.** Each segment is encrypted with AES-256-GCM under the existing release key scope (`keyVault.ts`), with AAD binding the content hash, encryption generation, rendition, object kind (init/media), and segment index so a substituted or reordered segment fails authentication. Every encryption invocation must also use a nonce unique under that key across all renditions and objects; AAD separation does not make nonce reuse safe. Follow the nonce contract below before implementing. No new key, and no key leaves the existing access-checked routes.
3. **Loudness.** Measure integrated loudness (EBU R128) at upload and store a playback gain targeting about -14 LUFS in the release manifest. The player applies it; the audio itself is not altered.
4. **Master preserved.** The original upload stays as an encrypted archival object that playback never fetches.
5. **Manifest and compatibility.** New releases point their audio reference to a manifest describing renditions and segments. Existing DAV2 releases keep working; a migration path produces renditions for them without changing on-chain records, authenticated by the same release key. Record the chosen addressing design (on-chain manifest reference for new releases, off-chain rendition index for existing ones, or an alternative) as a decision before implementing.
6. **Upload experience.** Transcoding runs as a bounded background job with explicit progress, failure, and retry states in the artist studio.

## AES-GCM nonce contract

Nonce uniqueness is per **actual AES key**, not per rendition or worker. It
covers the original encrypted master/DAV2 chunks, every init/media segment at
all three bitrates, and every later migration, retry or re-encoding generation
using that key. A segment index alone, or a rendition label placed only in AAD,
is insufficient. See [RFC 5116, sections 3.1, 3.2 and 5.1.1](https://www.rfc-editor.org/rfc/rfc5116.html#section-3.1)
for the uniqueness requirement and consequences of reuse.

Before coding, record the 96-bit nonce layout and allocation/retention decision.
One possible construction is an independently allocated, unique prefix for each
encryption generation and rendition/object, followed by a bounded segment
counter. Include init objects in that allocation. Counter overflow must fail
before encryption. Prefix reservation must prevent collisions under the same
key across concurrent jobs and restarts, including prefixes already used by
legacy DAV2 ciphertext; a random prefix without a collision/uniqueness argument
is not enough. Reservations must survive failed jobs and cannot be recycled
while the key remains usable. Store only allocation metadata, never key material.

A retry may reuse already-produced, unchanged ciphertext. If it encrypts again,
it must allocate a fresh nonce namespace, including when the plaintext or AAD
changes. Crash recovery must not reset a counter or lose a reservation. Bind the
nonce scheme/version and encryption-generation identifiers into the authenticated
manifest/AAD. If uniqueness against existing ciphertext cannot be established,
block that migration until a reviewed compatible design resolves it; do not
silently overwrite legacy ciphertext or weaken key/access boundaries.

## Read first

- `services/api/src/routes/uploads.ts`, `services/api/src/services/audioV2.ts`, `keyVault.ts`, `mediaValidation.ts`
- `web/src/shared/utils/audioV2.ts`, `web/src/features/catalog/audioV2Gateway.ts`, `web/src/hooks/useCatalog.ts`
- `docs/backlog/24-access-streaming-v2.md`, `docs/backlog/implementation/W07-key-custody-recovery.md`

## Acceptance and meaningful verification

- Before adding ffmpeg (or an alternative), record license, build, image size, CPU/memory per minute of audio, and known risks, as `AGENTS.md` requires.
- Round-trip tests: transcode, segment, encrypt, decrypt, and play in Chromium, WebKit, and Firefox (Playwright audio continuity suite extended).
- Negative tests: tampered, reordered, cross-rendition, wrong-generation or cross-release segments fail authentication; denied listeners still receive no key; room guests still receive no key.
- Nonce uniqueness tests instrument all encryption calls under one key across init/media objects, all renditions, retry/re-encoding generations and legacy DAV2 migration. Force a prefix collision, counter overflow, concurrent job allocation and crash/resume; assert no duplicate `(key, nonce)` reaches encryption and allocation failures fail closed. Reusing unchanged ciphertext must not invoke encryption again.
- Migration rehearsal on a copy of an existing DAV2 release, with rollback, proving new ciphertext does not reuse the original nonce namespace.
- Measure first sound (warm session) before and after on the same network profile.

## Scope boundary

No CDN (W33), no key-path change (W34), no player rewrite beyond reading the new format (W35). Do not delete or rewrite existing ciphertext.

## Handoff

Write `docs/backlog/implementation/evidence/W32.md` using `evidence-template.md`.
