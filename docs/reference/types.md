# TypeScript Types Reference

All shared types are defined in `src/types.ts` and re-exported from there. Import them directly:

```typescript
import type { CatalogTrack, AccessMode, RoyaltyPayment } from './types';
```

---

## Primitive types

### `Mode`

```typescript
type Mode = 'host' | 'listener';
```

The role of the current user in a listening room session. A host streams audio; a listener receives the WebRTC stream.

---

### `PersonhoodLevel`

```typescript
type PersonhoodLevel = 'DIM1' | 'DIM2';
```

The Polkadot Proof of Personhood level required to access a Human free track.

| Value  | Meaning                                 |
| ------ | --------------------------------------- |
| `DIM1` | Basic proof of unique humanity          |
| `DIM2` | Higher-confidence identity verification |

---

### `View`

```typescript
type View = 'listen' | 'player' | 'rooms';
```

The active top-level listener-app view. The artist portal is a separate `/artists`
surface and is not part of this in-app view union.

| Value    | Screen                                              |
| -------- | --------------------------------------------------- |
| `listen` | Catalog grid — discover and browse tracks           |
| `player` | Integrated player — play a track and manage a room  |
| `rooms`  | Live rooms list — discover and join active sessions |

---

### `AccessMode`

```typescript
type AccessMode = 'human-free' | 'classic';
```

The access policy for a registered track.

| Value        | Meaning                                  |
| ------------ | ---------------------------------------- |
| `human-free` | Unlocked by Polkadot Proof of Personhood |
| `classic`    | Unlocked by DOT payment                  |

---

### `SocketStatus`

```typescript
type SocketStatus = 'offline' | 'connecting' | 'online' | 'error';
```

The connection status of the Socket.IO signaling client.

---

### `PeerStatus`

```typescript
type PeerStatus = 'waiting' | 'connecting' | 'connected' | 'disconnected';
```

The WebRTC connection status of a single listener peer.

| Value          | Meaning                                       |
| -------------- | --------------------------------------------- |
| `waiting`      | Room created but audio stream not started yet |
| `connecting`   | ICE negotiation in progress                   |
| `connected`    | Audio stream active                           |
| `disconnected` | Connection lost or closed                     |

---

### `SessionAction`

```typescript
type SessionAction = 'idle' | 'creating' | 'joining';
```

Tracks whether a room creation or join operation is in progress. Used to disable action buttons while a socket round-trip is pending.

---

### `AssetAction`

```typescript
type AssetAction = 'idle' | 'audio' | 'cover';
```

Tracks whether an asset upload (hashing + encryption + IPFS upload) is in progress.

---

### `ArtistTab`

```typescript
type ArtistTab = 'overview' | 'new' | 'releases' | 'royalties' | 'advanced';
```

The active tab within the artist studio shown after a wallet has claimed an
artist profile on `/artists`.

---

### `ReleaseStep`

```typescript
type ReleaseStep = 'assets' | 'metadata' | 'access' | 'review';
```

The current step in the four-step new release wizard.

| Step       | Content                                                |
| ---------- | ------------------------------------------------------ |
| `assets`   | Upload audio and cover image                           |
| `metadata` | Set title and description                              |
| `access`   | Choose access mode, personhood level, price, royalties |
| `review`   | Summary before publishing                              |

---

### `RoomPlaybackMode`

```typescript
type RoomPlaybackMode = 'full' | 'preview';
```

Host-declared playback mode for a room. `preview` means the host is streaming
the 42% fallback instead of full protected audio.

---

### `TransactionFeedbackTone`

```typescript
type TransactionFeedbackTone = 'pending' | 'success' | 'error';
```

Controls the visual state of the `TransactionModal`.

---

## Object types

### `RoyaltySplit`

```typescript
type RoyaltySplit = {
  label: string; // Display name for the recipient (UI only)
  recipient: `0x${string}`; // EVM wallet address
  bps: number; // Basis points (0–10000, where 10000 = 100 %)
};
```

A single entry in a track's royalty distribution table. Submitted as parallel arrays to `musicRegRegister()`.

---

### `TrackInfo`

```typescript
type TrackInfo = {
  title: string;
  artist: string;
  duration: number; // Seconds
  updatedAt: number; // Unix ms timestamp
  imageRef?: string; // URL or IPFS ref for cover image
  audioRef?: string; // URL or IPFS ref for audio file
  priceDot?: string; // Decimal DOT amount (Classic mode only)
  bulletinRef: string; // Bulletin archive ref, or empty string
  metadataRef?: string; // IPFS metadata ref (ipfs://<CID>)
  description?: string;
  accessMode?: AccessMode;
  hash: `0x${string}` | ''; // blake2b-256 content hash
  personhoodLevel?: PersonhoodLevel;
};
```

The lightweight track representation used in the player and emitted over Socket.IO to synchronize room state. It is created from `CatalogTrack` via `createTrackInfoFromCatalog()`.

---

### `CatalogTrack`

```typescript
type CatalogTrack = {
  id: string; // "<runtimeAddress>:<contentHash>" for on-chain tracks
  zone: string; // Display group ("Registry", "Studio", etc.)
  title: string;
  artist: string;
  artistAddress?: `0x${string}`;
  audioRef: string;
  imageRef: string;
  priceDot: string;
  localUrl?: string; // Resolved playable URL (blob:, http:, etc.)
  duration?: number;
  hash: `0x${string}`;
  description: string;
  bulletinRef: string;
  metadataRef: string;
  royaltyBps: number;
  txHash?: `0x${string}`;
  durationLabel: string;
  accessMode: AccessMode;
  source: 'seed' | 'artist';
  royaltySplits: RoyaltySplit[];
  personhoodLevel: PersonhoodLevel;
  encrypted: boolean; // true if audioRef is a Dotify encrypted ref
};
```

The full catalog entry for a track as used in the browse and player views. On-chain tracks have `source: 'artist'` and an `id` of the form `<runtimeAddress>:<contentHash>`.

---

### `PlayerState`

```typescript
type PlayerState = {
  playing: boolean;
  duration: number; // Seconds
  updatedAt: number; // Unix ms timestamp of last state emission
  currentTime: number; // Seconds
};
```

Emitted by the host every ~1 second (and immediately on play/pause/seek) to synchronize the listener's progress display. The `updatedAt` field allows listeners to estimate current position even if a state event is delayed.

---

### `ListenerRecord`

```typescript
type ListenerRecord = {
  id: string; // Socket.IO socket ID
  status: PeerStatus;
  displayName: string;
};
```

One connected listener as tracked by the host. The host maintains a list of these in `useSession`.

---

### `OpenRoom`

```typescript
type OpenRoom = {
  roomId: string;
  title?: string;
  hostName: string;
  hostAddress?: string | null;
  createdAt: number; // Unix ms timestamp
  expiresAt?: number; // Unix ms timestamp
  listenerCount: number;
  track: TrackInfo | null; // null if host has not started playing
  playerState: PlayerState | null;
  playbackMode?: RoomPlaybackMode;
  hostAccessRequired?: boolean;
  listenersNeedWalletAccess?: false;
};
```

The public listing for a room, broadcast by the signaling server to all clients.
Displayed in the Rooms view. Room access is host-based:
`listenersNeedWalletAccess` is always `false`.

---

### `CreateRoomResponse`

```typescript
type CreateRoomResponse = { ok: true; roomId: string; hostName: string; expiresAt?: number } | { ok: false; error: string };
```

Ack payload for `room:create`.

---

### `JoinRoomResponse`

```typescript
type JoinRoomResponse =
  | {
      ok: true;
      roomId: string;
      hostId: string;
      hostName: string;
      listenerCount: number;
      track: TrackInfo | null;
      playerState: PlayerState | null;
      playbackMode?: RoomPlaybackMode;
      expiresAt?: number;
    }
  | { ok: false; error: string; code?: string };
```

Ack payload for `room:join`.

---

### `TransactionFeedback`

```typescript
type TransactionFeedback = {
  tone: TransactionFeedbackTone;
  title: string;
  message: string;
  txHash?: `0x${string}`; // Present after transaction submission
};
```

Drives the `TransactionModal`. Set to `{ tone: 'pending' }` before submitting a transaction, then updated to `'success'` or `'error'` after confirmation.

---

### `AccessGate`

```typescript
type AccessGate = {
  track: CatalogTrack;
  title: string;
  message: string;
  hint: string;
  actionType: 'personhood' | 'payment' | 'signin';
};
```

Displayed as the `AccessGateOverlay` when a listener hits the 42 % preview limit without access. `actionType` controls which CTA is shown:

| `actionType` | Shown when                         | CTA                                             |
| ------------ | ---------------------------------- | ----------------------------------------------- |
| `signin`     | No wallet connected                | "Use wallet to unlock"                          |
| `payment`    | Wallet connected, Classic track    | "Pay X DOT to unlock"                           |
| `personhood` | Wallet connected, insufficient PoP | No payment CTA — user must obtain PoP off-chain |

---

### `RoyaltyPayment`

```typescript
type RoyaltyPayment = {
  id: string; // "<txHash>-<logIndex>"
  trackHash: `0x${string}`;
  trackTitle: string;
  listener: `0x${string}`;
  amountWei: bigint;
  amountDot: string; // Formatted for display
  paidAtMs: number | null; // null if block timestamp unavailable
  transactionHash: `0x${string}`;
  blockNumber: bigint;
  logIndex: number;
};
```

A single royalty payment event parsed from `MusicRoyAccessPaid` logs. Used in the
Royalties tab of the artist studio.

---

### `OnchainTrackRecord`

```typescript
type OnchainTrackRecord = {
  artist: `0x${string}`;
  tokenId: bigint;
  title: string;
  artistName: string;
  description: string;
  imageRef: string;
  audioRef: string;
  metadataRef: string;
  artistContractRef: string;
  royaltyBps: number;
  accessMode: number; // 0 = human-free, 1 = classic
  pricePlanck: bigint;
  requiredPersonhood: number; // 0 = none, 1 = DIM1, 2 = DIM2
  registeredAtBlock: bigint;
  active: boolean;
};
```

The raw return value of `musicRegGetTrack(contentHash)` from the smart contract. Converted to `CatalogTrack` by `fetchRuntimeCatalog()` in `useCatalog`.
