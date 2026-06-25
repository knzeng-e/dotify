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
