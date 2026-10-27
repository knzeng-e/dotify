# Listening Rooms

> **Reading level:** Plain-language explanation first, then technical mechanics.

---

## What a listening room is

A listening room is a shared audio session. An authorized host plays a track;
guests join by invitation without a wallet or source-file access. WebRTC carries
audio directly or through TURN when necessary. Socket.IO signaling carries
membership, negotiation and ephemeral social events, not the audio.

For step-by-step hosting, joining and visibility controls, use
[Listen together](../how-to/listen-together.md). Rooms start Link only; opening
one does not automatically publish it to the galaxy. Nearby and Worldwide are
explicit host visibility choices, and location permission is separate.

If autoplay is blocked, use the displayed play action. A connected room or
progress indicator alone is not proof of audible playback.

---

## Listening while browsing

Returning to Music, Rooms, or an artist page keeps the room audio running.
The compact player follows the host’s current track, including changes made
while you browse. Its “Room live” indicator and people count distinguish a room
stream from individual playback; hosts see “Hosting live”. Tap the indicator,
artwork, or title to return to the room.

The green pulse appears only during connected playback. Host pause, local pause,
missing audio, and reconnecting have separate labels; disconnected counts are
hidden until signaling reconnects. Counts include you and the host, and reflect
room connections, not verified identities or guaranteed audible playback.

Listeners can pause their own listening or mute without controlling the host.
Their progress bar follows the host and cannot seek; skip, shuffle, and repeat
are reserved for local playback and hosting.

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
     │◄══════════════ WebRTC audio track (direct or TURN-relayed) ══════════════►│
```

The signaling server is never in the audio path. TURN can relay WebRTC media
when a direct route is unavailable.

### Signaling

The signaling server (`web/server/signaling.mjs`) owns ephemeral room membership,
chat, reactions, requests and presence. It routes SDP/ICE to admitted peers and
expires abandoned rooms. Host-selected Nearby/Worldwide listings use scoped,
bounded discovery; there is no global broadcast of private room identities.

`GET /health` provides aggregate health/counts. `GET /status` deliberately
returns an empty `rooms` array, even while rooms exist. Neither endpoint is a
room directory or an admission/capacity decision; use join/resume acknowledgements
and room events for those facts.

See [socket-events.md](../reference/socket-events.md) for the full event schema.

### Audio capture

The host's media element plays authorized audio. A shared Web Audio output
supports both the local speaker and a `MediaStreamDestination` for guests, with
native `captureStream()` / `mozCaptureStream()` as an alternate path when
available. Pause and source retirement gate playback so residual mobile frames
do not remain audible after it stops. Host mute affects the local monitor,
not the guests' stream.

Actual browser/Host capabilities are checked before negotiation. An unsupported
media surface must produce an explicit recovery or browser continuation; a
recorded Host permission is not proof that the JavaScript media API exists.

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

ICE candidates are gathered using a public STUN server
(`stun.l.google.com:19302`). This resolves many consumer NAT configurations,
but symmetric NAT, carrier NAT, VPNs, and some corporate firewalls can block
peer-to-peer media even when signaling works. Configure a TURN relay for
production room reliability. The preferred path is the backend
`GET /api/turn/grant` endpoint (`TURN_URLS` plus `TURN_REST_SECRET` on the
API). Before calling it, the browser asks signaling for a two-minute
room-membership capability. Signaling issues proof only to the current host or
a joined listener; the API verifies it with the shared capability secret before
returning relay credentials. This keeps link entry walletless without turning
the relay into a public credential service. Browser-visible `VITE_TURN_URL`
credentials are only a DevNet/static fallback.

### One peer connection per listener

The host creates a separate `RTCPeerConnection` for each listener. Connections are tracked in `hostPeersRef` (a `Map<listenerId, RTCPeerConnection>`). When a listener leaves, their peer connection is closed and removed. When a new listener joins an active room, the host immediately creates a new offer and sends the current audio stream.

Scoped discovery includes `maxListeners` and `isFull` so clients can show
room capacity before a guest tries to join. The server still enforces the cap
on `room:join`, and the frontend disables full room cards as a convenience, not
as the security boundary.

### Nearby and Worldwide discovery

Discovery is implemented in the current Web and Product application paths;
native execution still depends on the installed Host's location/media support.
Host visibility and listener location consent are separate. Approximate areas
and radii up to 42 km constrain Nearby matching on both sides. Exact coordinates
stay off discovery payloads, chain, Statement Store, logs and durable app stores.
Worldwide rooms can appear while a local fix is pending or unavailable.

Search begins automatically, results are progressively inspectable, and scoped
live updates supplement bounded refreshes. Distance bands are approximate; the
radar is not a map. Temporary renewal failures do not rewrite the host's saved
visibility choice or turn stale coordinates into a fresh fix. See the
[privacy contract](../design/dotify-nearby-discovery-privacy.md) and
[room-life model](room-life-and-artist-visits.md).

When a host's signaling transport drops, the host closes existing
`RTCPeerConnection` objects before resuming the room. Existing listeners keep
their room identity, rejoin with a fresh socket when their own transport
recovers, and wait for the host to send a fresh offer. If the host cannot
resume before the server timeout, the room closes instead of silently keeping a
stale listing.

### Quality telemetry

The frontend exposes a browser-local QA snapshot at
`window.__DOTIFY_ROOM_QUALITY__.snapshot()`. It records bounded room phases such
as `room-joined`, `offer-sent`, `answer-sent`, `remote-audio-cued`,
`peer-connected`, reconnect, retry, and timeout events.

For connected peers it also summarizes browser WebRTC stats when available:
relay/direct candidate type, round-trip time, jitter, packet counters, byte
counters, and available outgoing bitrate. It deliberately does not store SDP,
ICE candidate strings, IP addresses, audio source references, content keys, or
wallet identifiers. The snapshot is page-local memory and clears on reload or
`window.__DOTIFY_ROOM_QUALITY__.clear()`.

Product Host behavior varies by installed version and OS. The application
checks actual media capabilities and can offer a canonical HTTPS browser
continuation when room media is unavailable inside the container. Do not infer
native support from a browser fixture, a permission label or a successful build;
record exact Host/device versions in release evidence.

### Limitations

- Audio only — no video.
- Listeners cannot control playback.
- Symmetric NAT can block connection without a TURN server.
- `captureStream()` is not available in all browsers or Product host containers.
- Room capacity is enforced by the signaling server and currently defaults to
  24 listeners per host. Larger sessions need SFU evaluation instead of simply
  raising the peer-to-peer fan-out.
- Product Host location and media availability require validation on each
  supported installed Host/OS. Browser continuation may be necessary.
- Socket reconnect can silently rejoin the room, but the host still needs to
  create a fresh WebRTC offer for the new socket. If the host leaves, expires,
  or times out, the room is closed and listeners must join another room.

## Leaving, browsing and the player

The playback provider owns the persistent media elements across listener and
artist shells. Navigation alone keeps an established session and its media
identity. Full player and mini-player share transport; dismissing the mini-player
stops playback intent, pauses the local/remote elements, and cancels unfinished
source preparation so a late fetch cannot restart audio. Ready sources remain
available for an explicit replay. Draft uploads are preview-only and do not
autoplay; preparing a release requires leaving a live room to avoid replacing
its shared source.

Explicit room exit clears the peers and current invitation URL, replaces the
player history entry with home, and stops local playback. Mini-player exit
always confirms for active rooms. Guests leave only their own session; hosts
close the room for everyone. A passive closure returns an orphaned player home
and announces the reason; a person already browsing keeps that view. Canceling
an incoming invitation clears the link. Leaving a pending join/create aborts
its acknowledgement path, so an obsolete response cannot reopen the session.
Browser navigation and reopening a release remain explicit user intents.
