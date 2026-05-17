# 04 — Hosted signaling and room join links

## Sprint
Sprint 0 — Production spine

## Priority
P0

## Objective
Move rooms from local demo behavior to a public testnet-ready listening experience.

A host must be able to create a room, share a link, and have a listener join with minimal friction.

## Context
Dotify currently uses Socket.IO for signaling and WebRTC for host-to-listener audio streaming. The signaling server coordinates SDP/ICE and room discovery; it does not stream media.

Current limitations:

- rooms are single-host;
- host leaving ends the room;
- no host handoff;
- listener access is not independently enforced at room boundary;
- public builds need hosted signaling infrastructure.

## Scope
Harden the current signaling server and frontend room UX for public testnet usage.

## Required features

### Signaling server

- Configurable allowed origins.
- Room expiration.
- Host heartbeat.
- Disconnect cleanup.
- Maximum listeners per room config.
- Room metadata:
  - roomId
  - title
  - hostAddress or hostDisplayName
  - currentTrack title/artist/contentHash
  - createdAt
  - listenerCount
- Health endpoint or Socket.IO admin-compatible status endpoint.

### Frontend

- Create room from authorized track.
- Generate join link:

```txt
https://<app>/rooms/<roomId>
```

- Join by link.
- Manual room code still works.
- Explicit room states:
  - creating
  - waiting for host
  - connecting
  - connected
  - reconnecting
  - host left
  - room expired
  - unsupported browser

## Access-control rule

For the first production spine, the host must be authorized to play the full track before hosting it.

Listener-side full access enforcement for room streams can be documented as a known limitation if not implemented immediately, but the UI must not imply stronger rights enforcement than exists.

## Engineering requirements

- Do not stream audio through the signaling server.
- Avoid long-lived zombie rooms.
- Add structured server logs for room lifecycle events.
- Add basic integration tests for create/join/disconnect cleanup if practical.
- Keep WebRTC peer creation isolated from UI components.

## Acceptance criteria

- Host can create a room on hosted signaling URL.
- Listener can join via copied link in a second browser/device.
- Room disappears after host disconnect or expiry.
- UI displays clear error when signaling URL is unavailable.
- README documents hosted signaling deployment.

## Non-goals

- Do not implement multi-host handoff here.
- Do not implement collaborative queue here.
- Do not implement statement-store signaling here.

## Senior-engineer notes

The strategic benchmark is Jukebox Duo / Spotify Jam simplicity: room creation must feel like sharing a link, not operating a node. Keep the cryptographic and runtime complexity behind the curtain.