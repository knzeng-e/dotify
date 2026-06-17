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
  hostAddress?: string | null,
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
  expiresAt?: number;
}

// Ack — failure
{ ok: false; error: string; code?: string }
```

On success, the host receives a `listener:joined` event for this listener.

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

```typescript
// Host emits
socket.emit('room:track', track /* TrackInfo | null */);

// Listener receives
socket.on('room:track', (track: TrackInfo | null) => { ... });
```

---

### `room:playback-mode`

**Direction:** Client (host) → Server → Listeners

Updates the host-declared room playback mode. `preview` means the host is
streaming the 42% fallback because full access was not available.

```typescript
// Host emits
socket.emit('room:playback-mode', { playbackMode: 'full' | 'preview' });

// Listener receives
socket.on('room:playback-mode', (payload: { playbackMode?: 'full' | 'preview' }) => { ... });
```

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
