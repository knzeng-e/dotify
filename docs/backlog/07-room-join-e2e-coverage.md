# 07 — Room join end-to-end coverage

## Sprint
Sprint 1 — Stabilization and maintainability

## Priority
P1

## Objective
Add deterministic coverage for the listening-room join flow.

Dotify must prove that a host can create a room and that a listener can join through the public UX without relying on manual local-browser ritual.

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
9. Assert listener enters connected state.
10. Assert host disconnect cleanup is reflected in listener UI.
```

## Requirements

- Use Playwright multiple browser contexts.
- Mock media stream if needed for CI browser stability.
- Test Socket.IO state transitions even if actual audio capture is mocked.
- Add a separate manual smoke test doc for real audio verification across two devices.

## Acceptance criteria

- E2E test covers room create/join/disconnect flow.
- Test does not require public internet.
- Test fails on zombie-room behavior.
- Room state transitions are user-visible and testable.

## Non-goals

- Do not implement collaborative queue here.
- Do not implement multi-host handoff here.
- Do not attempt perfect WebRTC media quality testing in CI.

## Senior-engineer notes

The room is the soul of Dotify. The test can mock audio, but it must not mock the social promise: a room should be created, joined, understood, and cleaned up predictably.