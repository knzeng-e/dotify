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
2. **Same protection model.** Each segment is encrypted with AES-256-GCM under the existing release key scope (`keyVault.ts`), with AAD binding the content hash, rendition, and segment index so a substituted or reordered segment fails authentication. No new key, and no key leaves the existing access-checked routes.
3. **Loudness.** Measure integrated loudness (EBU R128) at upload and store a playback gain targeting about -14 LUFS in the release manifest. The player applies it; the audio itself is not altered.
4. **Master preserved.** The original upload stays as an encrypted archival object that playback never fetches.
5. **Manifest and compatibility.** New releases point their audio reference to a manifest describing renditions and segments. Existing DAV2 releases keep working; a migration path produces renditions for them without changing on-chain records, authenticated by the same release key. Record the chosen addressing design (on-chain manifest reference for new releases, off-chain rendition index for existing ones, or an alternative) as a decision before implementing.
6. **Upload experience.** Transcoding runs as a bounded background job with explicit progress, failure, and retry states in the artist studio.

## Read first

- `services/api/src/routes/uploads.ts`, `services/api/src/services/audioV2.ts`, `keyVault.ts`, `mediaValidation.ts`
- `web/src/shared/utils/audioV2.ts`, `web/src/features/catalog/audioV2Gateway.ts`, `web/src/hooks/useCatalog.ts`
- `docs/backlog/24-access-streaming-v2.md`, `docs/backlog/implementation/W07-key-custody-recovery.md`

## Acceptance and meaningful verification

- Before adding ffmpeg (or an alternative), record license, build, image size, CPU/memory per minute of audio, and known risks, as `AGENTS.md` requires.
- Round-trip tests: transcode, segment, encrypt, decrypt, and play in Chromium, WebKit, and Firefox (Playwright audio continuity suite extended).
- Negative tests: tampered, reordered, or cross-release segments fail authentication; denied listeners still receive no key; room guests still receive no key.
- Migration rehearsal on a copy of an existing DAV2 release, with rollback.
- Measure first sound (warm session) before and after on the same network profile.

## Scope boundary

No CDN (W33), no key-path change (W34), no player rewrite beyond reading the new format (W35). Do not delete or rewrite existing ciphertext.

## Handoff

Write `docs/backlog/implementation/evidence/W32.md` using `evidence-template.md`.
