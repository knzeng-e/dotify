# 18 - Production preview assets for protected tracks

## Sprint
Sprint 1 - Stabilization and maintainability

## Priority
P1, production-spine gap

## Objective
Publish a separate preview asset for protected tracks so unauthorized listeners and unauthorized room hosts can hear the intended 42% preview even when full audio is encrypted with the backend-held production key.

## Context
Tickets 02 and 03 moved production audio encryption and content-key custody server-side. That is the right security boundary, but it creates a preview gap: the browser cannot derive the production key for an unauthorized listener, so it cannot decrypt the full server-keyed audio just to slice a 42% preview.

Demo/local tracks can still use browser-side decryption and preview slicing because they use the bundle-derived demo key. Production tracks need an explicit preview asset.

## Required work

- Extend the publish/upload pipeline to generate a 42% preview from the raw uploaded audio before the full track is encrypted.
- Pin the preview as a separate playable asset, preferably unencrypted or encrypted with a public preview key that does not expose the full-track source.
- Add a canonical preview reference to the Dotify metadata manifest and frontend track model.
- Update individual playback to use the preview reference when access is denied, no wallet is connected, the backend key service denies access, or the key service is unavailable.
- Update room-host playback to use the same preview reference when the host lacks access, while preserving the host CTA and auto-advance behavior.
- Keep full-track content keys server-side and wallet-gated.
- Document that preview assets are intentionally playable and are not a full-track protection boundary.

## Acceptance criteria

- Unauthorized individual listener can hear the 42% preview of a server-keyed protected track without receiving the full-track content key.
- Unauthorized room host can stream the 42% preview of a server-keyed protected track without receiving the full-track content key.
- Room guests still never receive keys or encrypted source files.
- Preview playback does not depend on `VITE_CONTENT_SECRET` in production mode.
- Metadata, README, and security docs describe the preview asset boundary honestly.
- Tests cover denied individual playback, denied room-host playback, and key-service-unavailable preview behavior.

## Non-goals

- Do not implement absolute DRM.
- Do not reveal the full production content key to create previews in the browser.
- Do not require room guests to connect a wallet or sign.

## Senior-engineer notes
The product promise is preview-first, not silence-first. Preserve the server-side key boundary while giving unauthorized users the honest preview the interface already promises.

## Delivery notes

Delivered on branch `feat/production-preview-assets`.

Approach: client-side preview generation at publish (chosen over server-side
ffmpeg to avoid a heavy binary dependency and to reuse the existing browser WAV
slicer). The full-track key boundary is unchanged and stays server-authoritative.

- Publish (backend mode only): the artist's browser decodes the raw audio, keeps
  the first 42%, and encodes a mono 16-bit WAV (`generateWavPreview` /
  `encodeAudioBufferPreviewAsMonoWav` in `web/src/shared/utils/audio.ts`). It
  uploads unencrypted via `POST /api/uploads/preview` (`services/api`), and the
  manifest records `assets.previewCID`. Demo/local publishing is unchanged.
- Playback: `useCatalog.resolvePreviewAssetUrl` lazily reads `previewCID` from
  the track manifest (only when a preview is actually needed) and plays that
  asset directly for denied individual listens and unauthorized room hosts. The
  cutoff logic treats a standalone preview asset as already-42% (plays it in
  full; the gate/auto-advance fire at its natural end). Falls back to the demo
  decrypt-and-slice path when a track has no published preview asset.
- Where the preview ref lives: the manifest (`assets.previewCID`) is the single
  source. The runtime catalog is built from on-chain records without fetching
  each manifest, so the preview ref is resolved lazily at playback rather than
  carried on the in-memory track model. A `previewRef` field on the track model
  was intentionally not added: nothing reads it (room listeners get the WebRTC
  stream, never a file), and populating it would force a manifest fetch for
  every track at catalog load, including tracks never played.
- The preview path uses no content key, no decryption, and no
  `VITE_CONTENT_SECRET`. Room listeners still receive only the WebRTC stream.

Boundary: preview generation is client-side and therefore not authoritative (a
malicious artist could publish a misleading preview; it only affects their own
teaser and never exposes the full-track key). Server-side transcoding is a
possible future hardening, and would also yield smaller compressed previews.

Tests: backend `uploads.test.ts` (preview route validation + manifest
`previewCID` schema); frontend mono WAV encoder (`audio.test.ts`). The
end-to-end denied-playback flows (individual,
room-host, key-service-unavailable) are covered by the design but a dedicated
Playwright spec is deferred (the e2e harness needs the full stack).
