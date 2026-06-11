# 07 — Room join and host-access playback end-to-end coverage

## Sprint
Sprint 1 — Stabilization and maintainability

## Priority
P1

## Objective
Add deterministic coverage for the listening-room join flow, including the latest host-based access decisions for protected tracks.

Dotify must prove that a host can create a room and that a listener can join through the public UX without relying on manual local-browser ritual or wallet interruption.

## Product decision to test

Room listeners should be able to join and listen without wallet interruption. Protected track access is checked against the host only.

## Flow under test

```txt
1. Start frontend and signaling server.
2. Open host browser context.
3. Select playable track.
4. Create room.
5. Assert room metadata is visible.
6. Copy/generate join link.
7. Open listener browser context with join link.
8. Establish signaling connection.
9. Assert listener enters connected state without wallet/signature.
10. Assert playback metadata matches host state.
11. Assert host disconnect cleanup is reflected in listener UI.
```

## Required scenarios

### Public track

- Host creates room.
- Listener joins via link without wallet/signature.
- Public track streams fully to listeners.
- Room metadata reports `playbackMode: full`.

### Protected track with authorized host

- Host has access to protected track.
- Host receives temporary content key.
- Host streams full track to listeners.
- Listener never receives content key.
- Listener is not asked to connect a wallet.

### Protected track with unauthorized host

- Host lacks access to protected track.
- Dotify does not block the room.
- Host sees discreet unlock/personhood CTA.
- Host streams 42% preview.
- Room metadata reports `playbackMode: preview`.
- Playlist auto-advances after preview ends.
- Listener is not asked to connect a wallet.
- Listener never receives content key.

### Disconnect and cleanup

- Host disconnect cleanup is visible and deterministic.
- Zombie rooms are removed or expired.
- Listener sees clear `host left` / `room expired` state.

## Requirements

- Use Playwright multiple browser contexts.
- Mock media stream if needed for CI browser stability.
- Test Socket.IO state transitions even if actual audio capture is mocked.
- Add a separate manual smoke test doc for real audio verification across two devices.
- Assert key delivery boundaries through test doubles or network interception where practical.

## Acceptance criteria

- E2E test covers room create/join/disconnect flow.
- Listener can join via link without wallet/signature.
- Public full stream scenario is covered.
- Protected track + authorized host full stream scenario is covered.
- Protected track + unauthorized host preview fallback scenario is covered.
- Preview fallback auto-advance is covered.
- Listeners never receive content keys.
- Test does not require public internet.
- Test fails on zombie-room behavior.
- Room state transitions are user-visible and testable.

## Non-goals

- Do not implement collaborative queue here.
- Do not implement multi-host handoff here.
- Do not attempt perfect WebRTC media quality testing in CI.
- Do not test absolute DRM guarantees; test product-policy enforcement and key-delivery boundaries.
- Do not require listener wallet connection for room playback.

## Senior-engineer notes

The room is the soul of Dotify. The test can mock audio, but it must not mock the social promise: join first, listen smoothly, no wallet friction for guests.