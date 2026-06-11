# 04 — Hosted signaling, room join links, and host-based room access

## Sprint
Sprint 0 — Production spine

## Priority
P0

## Objective
Move rooms from local demo behavior to a public testnet-ready listening experience while preserving Dotify's core UX principle: listeners should be able to join a room without wallet friction.

A host must be able to create a room, share a link, and have a listener join with minimal friction.

## Context
Dotify currently uses Socket.IO for signaling and WebRTC for host-to-listener audio streaming. The signaling server coordinates SDP/ICE and room discovery; it does not stream media.

Current limitations:

- rooms are single-host;
- host leaving ends the room;
- no host handoff;
- public builds need hosted signaling infrastructure;
- room access policy must be explicit so agents do not accidentally turn room joining into a wallet checkpoint.

## Product decision

Room playback uses **host-based access**.

- If a room track is public, the host can stream the full track.
- If a room track is protected and the host has access, the host receives the temporary key and streams the full track to listeners through WebRTC.
- If a room track is protected and the host does **not** have access, Dotify plays the 42% preview, shows a discreet host-facing notice/CTA, then automatically advances to the next playlist track.
- Listeners do not need to connect a wallet, sign, pay, or prove access merely to listen inside a room.
- Listeners do not receive the protected source file or decryption key; they only receive the ephemeral WebRTC stream.

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
  - roomId;
  - title;
  - hostAddress or hostDisplayName;
  - currentTrack title/artist/contentHash;
  - playbackMode: `full | preview`;
  - hostAccessRequired: `true | false`;
  - listenersNeedWalletAccess: `false` for room playback;
  - createdAt;
  - listenerCount.
- Health endpoint or Socket.IO admin-compatible status endpoint.

### Frontend

- Create room from playable track.
- Generate join link:

```txt
https://<app>/rooms/<roomId>
```

- Join by link without wallet/signature for room guests.
- Manual room code still works.
- Explicit room states:
  - creating;
  - waiting for host;
  - connecting;
  - connected;
  - reconnecting;
  - host left;
  - room expired;
  - unsupported browser;
  - host preview mode.
- Host-facing protected-track states:
  - checking host access;
  - full stream available;
  - preview fallback;
  - unlock full stream CTA;
  - personhood required CTA.

## Access-control rule

For room playback, access is checked against the host only.

Room listeners must not be required to connect a wallet or sign a message merely to hear a host stream.

Room listeners never receive content keys or encrypted source files.

## Engineering requirements

- Do not stream audio through the signaling server.
- Avoid long-lived zombie rooms.
- Add structured server logs for room lifecycle events.
- Add basic integration tests for create/join/disconnect cleanup if practical.
- Keep WebRTC peer creation isolated from UI components.
- Do not imply stronger rights enforcement than exists: WebRTC listeners can hear/record the stream, but cannot directly fetch/decrypt the source file through Dotify.

## Acceptance criteria

- Hosted signaling is configurable.
- Host can create a room and share a join link.
- Listener can join via copied link without wallet/signature.
- Room metadata exposes current track, playback mode (`full` or `preview`), and whether listeners need wallet access (`false` for room playback).
- Protected room tracks check host access only.
- Authorized host streams full protected track.
- Unauthorized host fallback plays 42% preview, shows a discreet host CTA to unlock/personhood, then auto-advances.
- Room disappears after host disconnect or expiry.
- UI displays clear error when signaling URL is unavailable.
- README documents hosted signaling deployment and host-based room access.

## Non-goals

- Do not implement multi-host handoff here.
- Do not implement collaborative queue here.
- Do not implement statement-store signaling here.
- Do not require listener access checks for room playback.
- Do not expose content keys to listeners.
- Do not block the room when the host lacks access to a protected track.

## Senior-engineer notes

Benchmark Jukebox Duo / Spotify Jam simplicity: room creation must feel like sharing a link, not operating infrastructure. Protect the artist without killing the room's social flow.