# Socket.IO Events Reference

The signaling server relays WebRTC handshake messages and room state between clients. It never handles audio.

**Server address:** configured via `VITE_SIGNAL_URL` (default: `http://localhost:8788`).

---

## Notation

- **Client → Server** — emitted by the browser, received by the server.
- **Server → Client** — emitted by the server, received by one or more browsers.
- **Ack** — a callback function passed as the last argument; the server calls it with the response.

---

## Room lifecycle events

### `rooms:list`

**Direction:** Client → Server (with ack)

Lists all currently open rooms.

```typescript
// Emit
socket.emit('rooms:list', (rooms: OpenRoom[]) => { ... });

// Ack payload
OpenRoom[]
```

Each `OpenRoom` is a public, source-redacted snapshot:

```typescript
{
  roomId: string;
  title?: string;
  hostName: string;
  createdAt: number;
  expiresAt?: number;
  listenerCount: number;
  maxListeners?: number;
  isFull?: boolean;
  track: TrackInfo | null;        // no source-bearing refs
  playerState: PlayerState | null;
  playbackMode?: 'full' | 'preview';
  hostAccessRequired?: boolean;
  listenersNeedWalletAccess?: false;
}
```

---

### `rooms:updated`

**Direction:** Server → All clients

Broadcast whenever a room is created, updated, or closed.

```typescript
// Received
socket.on('rooms:updated', (rooms: OpenRoom[]) => { ... });
```

---

### `room:create`

**Direction:** Client → Server (with ack)

Creates a new room. The caller becomes the host.

```typescript
// Emit
socket.emit('room:create', {
  displayName: string,
  track: TrackInfo | null,
  playbackMode?: 'full' | 'preview',
}, (response: CreateRoomResponse) => { ... });

// Ack — success
{ ok: true; roomId: string; hostName: string; expiresAt?: number }

// Ack — failure
{ ok: false; error: string }
```

The server assigns a random six-character alphanumeric `roomId`.

---

### `room:join`

**Direction:** Client → Server (with ack)

Joins an existing room as a listener.

```typescript
// Emit
socket.emit('room:join', {
  roomId: string,
  displayName: string,
}, (response: JoinRoomResponse) => { ... });

// Ack — success
{
  ok: true;
  roomId: string;
  hostId: string;        // Socket ID of the host
  hostName: string;
  listenerCount: number;
  track: TrackInfo | null;
  playerState: PlayerState | null;
  playbackMode?: 'full' | 'preview';
  chatHistory?: RoomChatMessage[];   // Up to the last 50 in-room messages
  requests?: RoomRequest[];          // Current collaborative request queue
  expiresAt?: number;
}

// Ack — failure
{ ok: false; error: string; code?: string }
```

Known failure codes include `ROOM_NOT_FOUND`, `HOST_RECONNECTING`,
`ROOM_FULL`, and `JOIN_THROTTLED`. On success, the host receives a
`listener:joined` event for this listener.

---

### `room:leave`

**Direction:** Client → Server (no ack)

Leaves the current room. If the caller is the host, the room is closed and all listeners receive `room:closed`.

```typescript
socket.emit('room:leave');
```

---

### `room:closed`

**Direction:** Server → Listener(s)

Sent to all listeners when the host closes the room, the room expires, or host
heartbeat times out.

```typescript
socket.on('room:closed', (payload: { reason?: string }) => { ... });
```

---

### `room:track`

**Direction:** Client (host) → Server → Listeners

Updates the track being played in the room. Displayed in the Rooms list and the listener's now-playing panel.

The server emits a public room-track snapshot only. It strips `audioRef`,
`metadataRef`, and other source-bearing manifest references before storage or
broadcast; listeners obtain sound exclusively through WebRTC.

```typescript
// Host emits
socket.emit('room:track', track /* TrackInfo | null */);

// Listener receives
socket.on('room:track', (track: TrackInfo | null) => { ... });
```

---

### `room:playback-mode`

**Direction:** Client (host) → Server → Listeners

Updates the host-declared room playback mode. Current access-v2 rooms use
`full`; a host without access sends no protected audio. `preview` remains an
accepted legacy wire value only and must not be treated as a product promise.

```typescript
// Host emits
socket.emit('room:playback-mode', { playbackMode: 'full' | 'preview' });

// Listener receives
socket.on('room:playback-mode', (payload: { playbackMode?: 'full' | 'preview' }) => { ... });
```

## Peer relay authorization

`webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`, and
`peer:connected` are relayed only between the verified host and one verified
listener in the same room. Outsiders, cross-room targets, listener-to-listener
targets, and protocol-invalid directions are dropped.

---

### `host:heartbeat`

**Direction:** Client (host) → Server

Keeps the room alive while the host is connected. Rooms are swept if no host
event or heartbeat arrives before `SIGNAL_HOST_TIMEOUT_MS`.

```typescript
socket.emit('host:heartbeat');
```

---

### `room:listener-count`

**Direction:** Server → Host

Sent to the host whenever a listener joins or leaves.

```typescript
socket.on('room:listener-count', (payload: { listenerCount: number }) => { ... });
```

---

## Listener presence events

### `listener:joined`

**Direction:** Server → Host only

Sent to the host when a new listener joins their room.

```typescript
socket.on('listener:joined', (payload: {
  listenerId: string;      // Listener's Socket.IO socket ID
  displayName: string;
  listenerCount: number;
}) => { ... });
```

On receipt, the host initiates WebRTC negotiation by calling `createOfferForListener(listenerId)`.

---

### `listener:left`

**Direction:** Server → Host only

Sent to the host when a listener disconnects or leaves.

```typescript
socket.on('listener:left', (payload: {
  listenerId: string;
  listenerCount: number;
}) => { ... });
```

On receipt, the host closes and removes the peer connection for that listener.

---

## Solo listening presence

Solo presence is ephemeral and anonymous. The server stores at most one active
track hash per connected socket and broadcasts only aggregate counts. A pause,
track change, disconnect, or room create/join removes the previous declaration;
one socket can never count as both solo and in-room presence.

### `presence:solo`

**Direction:** Client → Server

Declares the bytes32 hash currently playing outside a room. `null` clears the
declaration. Invalid hashes fail closed to a clear.

```typescript
socket.emit('presence:solo', { trackHash: `0x${string}` | null });
```

### `presence:solo:updated`

**Direction:** Server → All clients

Broadcasts the complete aggregate after a real change and sends a snapshot to
each newly connected client.

```typescript
socket.on('presence:solo:updated', (counts: Record<string, number>) => {
  // keys are normalized lowercase bytes32 track hashes
});
```

`GET /status` exposes the same aggregate as
`soloListeningByTrackHash`; `GET /health` exposes only the total
`soloListeners` count. Neither endpoint exposes socket IDs or identity data.

---

## Room social events

Reactions, chat, and the collaborative request queue are open to every room
participant (host and listeners); queue veto is host-only. The server is the
source of truth: it validates, rate-limits per socket (defaults: 10 reactions /
5 messages / 5 requests per window), and broadcasts to the whole room, sender
included. Malformed, over-limit, non-participant, or non-host-veto events are
dropped silently (fail closed, no error channel to probe). Chat and the queue
live only in the room: the server keeps at most the last 50 messages and 20
requests in memory, replays them in the `room:join` ack, and wipes them when
the room closes. Nothing is persisted and nothing appears on the public
`/status` endpoint.

### `room:reaction`

**Direction:** Client (any participant) → Server → Whole room

Broadcasts one of the six curated reaction emoji. The allowlist lives in
`web/server/signaling-utils.mjs` (`ROOM_REACTION_EMOJI`) with a client mirror
in `web/src/shared/social.ts` (`ROOM_REACTIONS`).

```typescript
// Emit
socket.emit('room:reaction', { emoji: string });

// Whole room receives (sender included)
socket.on('room:reaction', (reaction: {
  id: string;          // Server-assigned UUID
  emoji: string;
  senderId: string;    // Sender's socket ID
  senderName: string;  // Sender's display name
  ts: number;          // Unix ms timestamp
}) => { ... });
```

---

### `room:chat`

**Direction:** Client (any participant) → Server → Whole room

Sends a chat message to the room. The server sanitizes the text to a single
line (max 280 characters) and appends it to the room's in-memory history.

```typescript
// Emit
socket.emit('room:chat', { text: string });

// Whole room receives (sender included)
socket.on('room:chat', (message: {
  id: string;          // Server-assigned UUID
  text: string;        // Sanitized, single line, <= 280 chars
  senderId: string;
  senderName: string;
  ts: number;
}) => { ... });
```

---

### `room:request`

**Direction:** Client (any participant) → Server → Whole room

Proposes a track to hear next in the collaborative request queue. The server
sanitizes the text to a single line (max 120 characters), appends it to the
room's in-memory queue (capped at 20; further adds are dropped silently),
rate-limits per socket, and rebroadcasts the full queue via `room:requests`.
The queue is intent, not playback: the server never claims a request plays
itself.

```typescript
// Emit
socket.emit('room:request', { text: string });

// Whole room receives the full queue after every change (single render path)
socket.on('room:requests', (queue: Array<{
  id: string;          // Server-assigned UUID
  text: string;        // Sanitized, single line, <= 120 chars
  senderId: string;
  senderName: string;
  ts: number;
}>) => { ... });
```

---

### `room:request:remove` / `room:request:clear`

**Direction:** Host → Server → Whole room

Host-only veto. `room:request:remove` drops one request by id;
`room:request:clear` empties the queue. Both are ignored for non-host sockets
(fail closed, no error channel). Each successful change rebroadcasts the full
queue via `room:requests`.

```typescript
// Emit (host only)
socket.emit('room:request:remove', { id: string });
socket.emit('room:request:clear');
```

---

## Player synchronisation events

### `player:state`

**Direction:** Host → Server → Listeners

The host emits this approximately every 900 ms while playing, and immediately on play, pause, and seek.

```typescript
// Host emits
socket.emit('player:state', {
  playing: boolean;
  currentTime: number;   // Seconds
  duration: number;      // Seconds
  updatedAt: number;     // Unix ms timestamp
});

// Listener receives
socket.on('player:state', (state: PlayerState | null) => { ... });
```

Listeners use `updatedAt` to compensate for network delay when displaying the progress indicator.

---

## WebRTC signalling events

These four events relay SDP and ICE negotiation messages between peers via the server. The server routes them by `targetId` (when emitting) and replaces it with `from` (when receiving).

### `webrtc:offer`

**Direction:** Host → Server → Listener

```typescript
// Host emits
socket.emit('webrtc:offer', {
  targetId: string;                      // Listener's socket ID
  offer: RTCSessionDescriptionInit;
});

// Listener receives
socket.on('webrtc:offer', (payload: {
  from: string;                          // Host's socket ID
  offer: RTCSessionDescriptionInit;
}) => { ... });
```

---

### `webrtc:answer`

**Direction:** Listener → Server → Host

```typescript
// Listener emits
socket.emit('webrtc:answer', {
  targetId: string;                      // Host's socket ID
  answer: RTCSessionDescriptionInit;
});

// Host receives
socket.on('webrtc:answer', (payload: {
  from: string;                          // Listener's socket ID
  answer: RTCSessionDescriptionInit;
}) => { ... });
```

---

### `webrtc:ice-candidate`

**Direction:** Either peer → Server → Other peer

```typescript
// Either peer emits
socket.emit('webrtc:ice-candidate', {
  targetId: string;
  candidate: RTCIceCandidateInit;
});

// Either peer receives
socket.on('webrtc:ice-candidate', (payload: {
  from: string;
  candidate: RTCIceCandidateInit;
}) => { ... });
```

---

### `peer:connected`

**Direction:** Listener → Server → Host

Sent by the listener when their `RTCPeerConnection` reports `connectionState === 'connected'`. The host uses this to update the listener's status indicator to `'connected'`.

```typescript
// Listener emits
socket.emit('peer:connected', { targetId: string /* host socket ID */ });

// Host receives
socket.on('peer:connected', (payload: { from: string }) => { ... });
```

## Shared queue preview

Requires `SIGNAL_HOST_LINEUP=on`; the frontend independently requires
`VITE_DOTIFY_HOST_LINEUP=on`. Off by default. Create/join/resume acknowledgements
include optional `lineup: { revision, tracks: [{ id, title, artist }] }`.
Absent state means unavailable, not an empty queue. Host resume also restores
`chatHistory` and `requests`, including activity received during its reconnect.

The host sends `room:lineup:update` with `{ operationId, revision, tracks,
acceptedRequestId? }`. Only its current hosted room is eligible; there is no
caller-specified room ID. Entries are unique by opaque catalog ID, at most 12,
with bounded ID/title/artist strings. Extra fields (including source references)
are rejected. Labels come from the host; signaling does not authenticate catalog
availability or bypass playback access.

The acknowledgement is `{ ok, message?, lineup? }`. A stale revision returns the
current snapshot and refuses the mutation. Successful edits increment the
revision and broadcast `room:lineup` with `{ roomId, lineup }` to participants
only. The last 64 operation IDs/fingerprints deduplicate identical retries;
reuse with a different body is rejected. An older retry outside that window
fails its original revision check. The frontend does not retry automatically:
it retains the last confirmed order and reports uncertainty. A host may
explicitly retry after reviewing the order.

`acceptedRequestId` atomically removes an extant text request only when the new
queue contains a newly added track. Free-text requests do not identify a release;
the host deliberately chooses the matching catalog item. The existing
`room:requests` broadcast communicates removal. Opening a queued track is local
playback selection, not a queue mutation, and does not dequeue or claim success.

State is room-memory only, survives the existing host resume flow, and is erased
on room close/expiry/restart. Queue data is never included in `/status` or global
room discovery. At most 30 edits per 10 seconds per room are accepted.

## Manual-area nearby feasibility preview

Requires `SIGNAL_NEARBY_PREVIEW=on` and `VITE_DOTIFY_NEARBY_PREVIEW=on` in the
frontend. This is a bounded manual-choice transport, **not the full W18 cell
protocol or completed W19**. No device location is collected. Supported IDs name
broad pilot regions, with no coordinate boundaries or verified distances.

| Event | Input | Acknowledgement / effect |
| --- | --- | --- |
| `nearby:areas` | none | `{ ok, areas: [{ id, label }] }`; metadata only |
| `nearby:publish` | `{ areaId, consent: true }` | Host-only: `{ ok, areaId?, expiresAt?, message? }`; replaces its room listing for 90s |
| `nearby:revoke` | none | Removes the caller's hosted-room listing; `{ ok: true }` when acknowledged |
| `nearby:search` | `{ areaId, consent: true }` | `{ ok, results?, expiresAt?, resultBucket?, message? }` |

Publish/search payloads reject every additional field and any unlisted area ID.
Search results contain only `{ discoveryId, roomId, title, artist,
listenerCountBucket, expiresAt }`, with at most 20 results and `0`, `1-3`, `4-9`,
`10+` buckets. Search expiry is at most 30s and no later than the earliest listing
expiry. Query intent is not stored; only a short-lived network-address rate
bucket remains. The existing room list still has its own public counts, so
bucketed nearby counts do not prevent cross-surface correlation.

Server clocks own expiry. Listings rotate IDs after 15 minutes of deliberate
renewals and on area change, expiry or revoke/republication. Disconnect removes
visibility and resume does not restore it. Queries after revoke exclude the
room immediately; previously received results can remain until their short
client expiry. Clients clear results on hiding/disconnect/stop and stop host
publication on hidden/pagehide/unmount. There is no background refresh, durable
location history, wallet field or public location beacon. Same-area membership
is self-declared. This preview does not solve malicious area choices, Sybil
queries, proxy/operator observation, or correlation through stable room IDs.
