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

## Delivery notes (implemented design and boundaries)

Delivered on `test/room-join-e2e`.

### What runs for real vs. what is mocked

- **Real**: the Socket.IO signaling server (`web/server/signaling.mjs`, started as a second Playwright `webServer`), the full room lifecycle (create, join, listener count, track/playback-mode/player-state relay, host disconnect cleanup), and real WebRTC SDP/ICE negotiation between two browser contexts (host + listener).
- **Mocked** (`web/src/e2e/roomJoinMock.ts`, behind `VITE_E2E_ROOM_JOIN`): the host audio capture is a synthetic near-silent Web Audio `MediaStream`, ICE is loopback-only (no public STUN), and the protected track is a deterministic fixture. This follows the same `VITE_E2E_*` mock pattern as `classicUnlockMock.ts` / `artistPublishMock.ts`.

### Coverage (`web/e2e/room-join.spec.ts`)

- **Public track** - host opens a room; a listener joins via the bare `#/rooms/<id>` link in a fresh context with no wallet (the connect affordance is still present); the listener reaches `In sync` over real WebRTC; room `playbackMode: full`; the listener never requests a content key.
- **Protected track, authorized host** - the host satisfies the policy and a content key is delivered to the host (key-request counter >= 1); the listener streams `full` with zero key requests.
- **Protected track, unauthorized host** - the room declares `playbackMode: preview`, the host sees the discreet unlock CTA (access gate), no key is delivered, and the playlist auto-advances to the next (public) track, flipping the room to `full`. The listener is never keyed.
- **Host disconnect** - closing the host context removes the room server-side (no zombie) and the listener sees a clear closed state; the room code disappears from the listener UI.

### Key-delivery boundary

The inviolable boundary - listeners never request or receive a content key - is asserted directly via a per-context counter (`window.__DOTIFY_E2E_ROOM_JOIN__.keyRequests`), which stays at `0` in every listener context. The host-side counter proves the authorized host did receive a key. Absolute DRM is explicitly not tested (per the ticket non-goals); this is product-policy and key-delivery-boundary enforcement.

### Zombie rooms

Time-based TTL / host-heartbeat expiry is covered deterministically by the signaling server unit tests (`web/server/signaling.test.mjs`: "expires rooms past their TTL", heartbeat). The e2e covers the deterministic host-disconnect removal path and asserts the room is gone from the listener UI.

### Production-code changes made for testability (all guarded or non-behavioral)

- `useWallet.ts`: room-join e2e contexts (host `?e2eRoom=` scenario or a `#/rooms/<id>` listener link) start wallet-free, so the always-on classic-unlock flag cannot auto-connect a wallet and contradict the "guests need no wallet" guarantee.
- `usePlayback.ts`: under `VITE_E2E_ROOM_JOIN` the host does not autoplay on load, so the sub-second preview -> auto-advance transition is driven explicitly by the test rather than racing a short autoplay window. Manual play is unaffected.
- `App.tsx`: the one-link auto-join no longer latches a one-shot ref; it re-attempts while not yet in a room. This is a genuine robustness fix - under React StrictMode (dev) the mount/unmount/remount cycle tore down the first socket before it connected, and a latched ref left the guest permanently unconnected. Production (no double-invoke) behavior is unchanged.
- `PlayerView.tsx`: added non-visual `data-testid` hooks (`room-code`, `room-playback-mode`, `room-listener-sync`, `session-error`). The playback-mode hook is visually hidden; the visible preview cue still lives in the rooms list and session status.

### Manual real-audio verification

CI mocks the audio stream. Cross-device real-audio verification is a manual smoke test: `docs/manual/room-audio-smoke-test.md`.