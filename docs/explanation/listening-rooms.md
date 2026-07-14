# Listening Rooms

> **Reading level:** Plain-language explanation first, then technical mechanics.

---

## What a listening room is

A listening room is a shared audio session. A host plays music from their browser. Listeners anywhere in the world join with a room code and hear the same audio in real time — synchronized, live, peer-to-peer.

No account is required to join a room. No audio passes through a server. The host's browser streams directly to each listener's browser using WebRTC.

---

## How it works for a host

1. Select a track in the Discover view.
2. Open the player and switch to **Host** mode.
3. Click **Start a room**. A six-character room code appears.
4. Share the generated `#/rooms/<roomId>` link or the room code with listeners.
5. Press Play. The audio streams to everyone who has joined.

Listeners can join before you press Play. They will hear audio as soon as you start playing.

---

## How it works for a listener

1. Open a shared room link, go to the **Rooms** view to see all open rooms, or enter a room code directly.
2. Click **Join**. The room connects.
3. Audio begins playing automatically when the host starts streaming.

If autoplay is blocked by the browser, a manual play prompt appears.

---

## What listeners can and cannot do

| Capability                         | Host | Listener          |
| ---------------------------------- | ---- | ----------------- |
| Control playback (play/pause/seek) | Yes  | No                |
| See what is playing                | Yes  | Yes               |
| See the current position           | Yes  | Yes (approximate) |
| Choose the track                   | Yes  | No                |
| Leave the room                     | Yes  | Yes               |

Listeners hear the audio the host is playing. They cannot change the track or skip ahead.

---

## Technical mechanics

### Transport architecture

```
Host browser                    Signaling server (Socket.IO)                Listener browser
     │                                    │                                       │
     │── room:create ──────────────────►  │                                       │
     │◄─ { roomId, hostName } ──────────  │                                       │
     │                                    │  ◄──────── room:join { roomId } ──────│
     │  ◄─ listener:joined ──────────────  │                                       │
     │                                    │                                       │
     │─── webrtc:offer ──────────────────►│──────────────────────────────────────►│
     │◄── webrtc:answer ─────────────────  │◄───────────────────────────────────── │
     │─── webrtc:ice-candidate ──────────►│──────────────────────────────────────►│
     │◄── webrtc:ice-candidate ──────────  │◄───────────────────────────────────── │
     │                                    │                                       │
     │◄══════════════ WebRTC audio track (peer-to-peer, no server) ══════════════►│
```

Once the WebRTC connection is established, the signaling server is no longer in the audio path.

### Signaling

The signaling server (`server/signaling.mjs`) is a Socket.IO process that relays messages between peers by room membership. It does not inspect or store any content. Its only functions are:

- Maintaining a registry of open rooms.
- Maintaining an ephemeral, anonymous count of active solo listeners per track, with at most one active track per socket.
- Routing SDP offers, answers, and ICE candidates between the correct peers.
- Broadcasting `rooms:updated` when the room list changes and `presence:solo:updated` when solo presence changes.
- Expiring rooms after their TTL and closing rooms whose host stops heartbeating.
- Exposing `GET /health` and `GET /status` for uptime, public room metadata, and anonymous solo-listening aggregates.

See [socket-events.md](../reference/socket-events.md) for the full event schema.

### Audio capture

The host's `<audio>` element plays the selected track locally. The browser's `captureStream()` API attaches a `MediaStream` to that element. Each audio track from that stream is added to a `RTCPeerConnection` for every connected listener.

```typescript
// Simplified from useSession.ts
const stream = (audioElement as CapturableMediaElement).captureStream();
for (const track of stream.getAudioTracks()) {
  peerConnection.addTrack(track, stream);
}
```

`captureStream()` is not universally supported. Firefox uses `mozCaptureStream()`. If neither is available, an error is shown and the room continues operating without streaming.

### Player state synchronisation

The host emits a `player:state` event approximately every second while playing, and immediately on play/pause/seek. This allows listeners to display a synchronized progress indicator even though they receive the audio directly via WebRTC.

```typescript
type PlayerState = {
  playing: boolean;
  currentTime: number;
  duration: number;
  updatedAt: number; // ms timestamp, used to compensate for network delay
};
```

The listener's progress bar is derived from `playerState`, not from the local `<audio>` element (which plays the remote WebRTC stream and may not expose timing accurately).

### NAT traversal

ICE candidates are gathered using a public STUN server (`stun.l.google.com:19302`). This resolves most consumer NAT configurations. Symmetric NAT and some corporate firewalls will block peer-to-peer connections. Configure `VITE_TURN_URL` and optional TURN credentials for production room reliability.

### One peer connection per listener

The host creates a separate `RTCPeerConnection` for each listener. Connections are tracked in `hostPeersRef` (a `Map<listenerId, RTCPeerConnection>`). When a listener leaves, their peer connection is closed and removed. When a new listener joins an active room, the host immediately creates a new offer and sends the current audio stream.

### Limitations

- Audio only — no video.
- Listeners cannot control playback.
- Symmetric NAT can block connection without a TURN server.
- `captureStream()` is not available in all browsers or in the Bulletin-distributed build.
- Socket reconnect can silently rejoin the room, but the host still needs to
  create a fresh WebRTC offer for the new socket. If the host leaves, expires,
  or times out, the room is closed and listeners must join another room.
