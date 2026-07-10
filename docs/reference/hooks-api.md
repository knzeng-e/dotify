# React Hooks API Reference

Custom hooks that own all non-UI state and logic in the Dotify web app. View components receive their data and callbacks as props from these hooks via `App.tsx`.

---

## `useCatalog`

**File:** `src/hooks/useCatalog.ts`

Manages the music catalog: loading tracks from on-chain runtimes, resolving IPFS audio, enforcing access control, and handling file uploads for new releases.

### Usage

```typescript
const catalog = useCatalog({
  ethRpcUrl,
  listenerEvmAddress,
  connectedWallet,
  directoryAddress,
  setShowWalletModal,
  setTransactionFeedback,
  navigateToView,
  getActiveWalletClient,
  setBulletinManifestRef,
  setAccessMode,
  setPriceDot,
  setPersonhoodLevel,
  setArtistName,
  setDescription,
  setTitle
});
```

### Returns

#### State

| Field                    | Type                      | Description                                              |
| ------------------------ | ------------------------- | -------------------------------------------------------- |
| `catalogTracks`          | `CatalogTrack[]`          | All tracks loaded from on-chain registries               |
| `catalogStatus`          | `string`                  | Human-readable loading status message                    |
| `selectedTrackId`        | `string`                  | `id` of the currently selected track                     |
| `catalogAccessByTrackId` | `Record<string, boolean>` | Per-track access result for the connected wallet         |
| `audioSource`            | `string \| null`          | Playable URL for the selected track (blob:, http:, etc.) |
| `trackInfo`              | `TrackInfo \| null`       | Metadata for the currently playing track                 |
| `coverSource`            | `string`                  | URL for the current cover image                          |
| `playerState`            | `PlayerState \| null`     | Latest received player state (from host or local audio)  |
| `accessGate`             | `AccessGate \| null`      | Access gate to display, or `null` if dismissed           |
| `fileHash`               | `0x${string} \| ''`       | blake2b-256 hash of the uploaded audio file              |
| `audioCID`               | `string`                  | IPFS CID of the uploaded (encrypted) audio               |
| `coverCID`               | `string`                  | IPFS CID of the uploaded cover image                     |

#### Functions

| Function                     | Signature                                                                                                | Description                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectTrack`                | `(track: CatalogTrack, socketEmit?, setLocalStreamReady?, closeHostPeers?) => Promise<RoomPlaybackMode>` | Select a track, check access, resolve its playable audio URL, and update `audioSource`, `trackInfo`, `accessGate`. Access-v2 rooms emit `full` for protocol compatibility; unauthorized hosts stream no protected audio. |
| `openTrack`                  | `(track: CatalogTrack, socketEmit?, setLocalStreamReady?, closeHostPeers?) => Promise<RoomPlaybackMode>` | Navigate to the player view, then call `selectTrack`.                                                                                                         |
| `refreshCatalogFromRegistry` | `(preferredHash?: 0x${string}) => Promise<CatalogTrack[]>`                                               | Reload the full catalog from `ArtistDirectory`. Optionally selects a specific track by hash after loading.                                                    |
| `checkTrackAccess`           | `(track: CatalogTrack, address: 0x${string} \| null) => Promise<boolean>`                                | Calls `musicAccCanAccess` on the artist's SmartRuntime. Returns `true` if access is granted.                                                                  |
| `handleAudioFile`            | `(event: ChangeEvent<HTMLInputElement>) => Promise<void>`                                                | Hash, encrypt, and begin uploading an audio file. Updates `audioSource`, `fileHash`, `audioCID`.                                                              |
| `handleCoverFile`            | `(event: ChangeEvent<HTMLInputElement>) => void`                                                         | Begin uploading a cover image. Updates `coverSource`, `coverCID`.                                                                                             |
| `payForTrackAccess`          | `(track: CatalogTrack) => Promise<void>`                                                                 | Submits `musicRoyPayAccess` with the track's price. On success, re-selects the track with full access.                                                        |
| `setSelectedTrackId`         | `(id: string) => void`                                                                                   | Direct setter, used when clearing the draft upload state.                                                                                                     |
| `setTrackInfo`               | `(info: TrackInfo \| null) => void`                                                                      | Direct setter, used by `useSession` to update from room track events.                                                                                         |
| `setPlayerState`             | `(state: PlayerState \| null) => void`                                                                   | Direct setter, used by `useSession` to sync remote player state.                                                                                              |
| `setAccessGate`              | `(gate: AccessGate \| null) => void`                                                                     | Direct setter, used to dismiss the access gate.                                                                                                               |
| `setCoverSource`             | `(url: string) => void`                                                                                  | Direct setter, used when selecting a catalog track to update the player cover.                                                                                |

#### Refs (pass-through to views)

| Ref             | Type                          | Description                                       |
| --------------- | ----------------------------- | ------------------------------------------------- |
| `localAudioRef` | `RefObject<HTMLAudioElement>` | Ref to attach to the host `<audio>` element       |
| `objectUrlsRef` | `RefObject<Set<string>>`      | Tracks created Object URLs for cleanup on unmount |

---

## `useSession`

**File:** `src/hooks/useSession.ts`

Manages all WebRTC peer connections and Socket.IO signaling for listening rooms. Owns the full real-time communication layer.

### Usage

```typescript
const session = useSession({
  signalUrl,
  hostAddress,
  audioSource,
  trackInfo,
  setTrackInfo,
  setPlayerState,
  localAudioRef,
  objectUrlsRef,
  resolvedAudioSourcesRef,
  navigateToView,
  setAudioSource
});
```

### Returns

#### State

| Field               | Type               | Description                                                   |
| ------------------- | ------------------ | ------------------------------------------------------------- |
| `roomId`            | `string`           | Active room code, or empty string                             |
| `hostName`          | `string`           | Display name of the current host                              |
| `listeners`         | `ListenerRecord[]` | Connected listener list (host only)                           |
| `listenerCount`     | `number`           | Total number of connected listeners                           |
| `sessionStatus`     | `string`           | Human-readable room/stream status                             |
| `sessionAction`     | `SessionAction`    | Whether a create/join operation is in progress                |
| `mode`              | `Mode`             | `'host'` or `'listener'`                                      |
| `remoteReady`       | `boolean`          | `true` when the listener has received the WebRTC audio track  |
| `error`             | `string \| null`   | Last session error message, or `null`                         |
| `openRooms`         | `OpenRoom[]`       | List of publicly visible rooms                                |
| `socketStatus`      | `SocketStatus`     | Current Socket.IO connection state                            |
| `joinCode`          | `string`           | Room code currently in the join input field                   |
| `displayName`       | `string`           | Current user's display name for the room                      |
| `localStreamReady`  | `boolean`          | `true` when the host has captured and shared the audio stream |
| `isRefreshingRooms` | `boolean`          | `true` while a manual room-list refresh is pending            |
| `roomPlaybackMode`  | `RoomPlaybackMode` | Host-declared room playback mode. Access-v2 hosts emit `full`; `preview` is a legacy wire value. |
| `sessionLink`       | `string`           | Shareable `#/rooms/<roomId>` link for the active room         |

#### Functions

| Function             | Signature                                                                                                     | Description                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `createSession`      | `(trackInfo: TrackInfo \| null, playbackMode?: RoomPlaybackMode, event?: FormEvent<HTMLFormElement>) => void` | Create a new room as host. Emits `room:create`.                                         |
| `joinRoom`           | `(roomCode: string) => void`                                                                                  | Join a room as listener. Emits `room:join`.                                             |
| `joinSession`        | `(event: FormEvent<HTMLFormElement>) => void`                                                                 | Form submit handler wrapping `joinRoom(joinCode)`.                                      |
| `leaveSession`       | `() => void`                                                                                                  | Leave the current room, close all peer connections, reset state.                        |
| `requestOpenRooms`   | `(showBusy?: boolean) => void`                                                                                | Refresh the room list via `rooms:list`.                                                 |
| `changeMode`         | `(mode: Mode) => void`                                                                                        | Switch between host and listener mode.                                                  |
| `copySessionLink`    | `() => Promise<void>`                                                                                         | Copy the invite link for the active room to the clipboard.                              |
| `prepareLocalStream` | `() => Promise<void>`                                                                                         | Capture the host's audio element stream and offer it to all connected listeners.        |
| `emitPlayerState`    | `(force?: boolean) => void`                                                                                   | Emit the current `player:state` event. Called by audio element event handlers.          |
| `setJoinCode`        | `(code: string) => void`                                                                                      | Update the join code input value.                                                       |
| `setDisplayName`     | `(name: string) => void`                                                                                      | Update the display name.                                                                |
| `socketEmit`         | `(event: string, data: unknown) => void`                                                                      | Emit a raw room event, used by catalog/player code for track and playback-mode updates. |

#### Refs

| Ref              | Type                          | Description                                     |
| ---------------- | ----------------------------- | ----------------------------------------------- |
| `remoteAudioRef` | `RefObject<HTMLAudioElement>` | Ref to attach to the listener `<audio>` element |

---

## `useArtistConsole`

**File:** `src/hooks/useArtistConsole.ts`

Manages the full artist workflow: runtime registration, track publishing, royalty ledger, and Bulletin archival.

### Usage

```typescript
const artist = useArtistConsole({
  activeEvmAddress,
  connectedWallet,
  ethRpcUrl,
  factoryAddress,
  directoryAddress,
  fileHash,
  title,
  artistName,
  description,
  accessMode,
  priceDot,
  personhoodLevel,
  royaltyBps,
  audioSource,
  coverFile,
  audioCID,
  coverCID,
  coverSource,
  activeSubstrateAddress,
  activeSubstrateSigner,
  artistTracks,
  setTransactionFeedback,
  refreshCatalogFromRegistry,
  setAudioCID,
  setCoverCID,
  uploadToBulletinEnabled,
  audioUploadRef,
  coverUploadRef
});
```

### Returns

#### State

| Field                       | Type                  | Description                                                       |
| --------------------------- | --------------------- | ----------------------------------------------------------------- |
| `artistRuntimeAddress`      | `0x${string} \| null` | Address of the artist's SmartRuntime, or `null` if not registered |
| `artistRegistrationStatus`  | `string`              | Human-readable registration status message                        |
| `isRegisteringArtist`       | `boolean`             | `true` while `registerArtist()` is running                        |
| `isRefreshingArtistRuntime` | `boolean`             | `true` while `refreshArtistRuntime()` is running                  |
| `bulletinManifestRef`       | `string`              | Bulletin archive ref for the last registered track                |
| `rightsStatus`              | `string`              | Human-readable status of the current release operation            |
| `royaltyPayments`           | `RoyaltyPayment[]`    | All payment events for the artist's tracks                        |
| `royaltyStatus`             | `string`              | Human-readable royalty ledger status                              |
| `isRefreshingRoyalties`     | `boolean`             | `true` while royalties are being fetched                          |
| `expandedRoyaltyPaymentId`  | `string \| null`      | ID of the royalty entry currently expanded in the UI              |

#### Functions

| Function                      | Signature                                              | Description                                                                                        |
| ----------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `registerArtist`              | `() => Promise<void>`                                  | Deploy a SmartRuntime for the active address via `ArtistRuntimeFactory`.                           |
| `refreshArtistRuntime`        | `(showBusy?: boolean) => Promise<0x${string} \| null>` | Check `ArtistDirectory` for the active address. Updates `artistRuntimeAddress`.                    |
| `registerRights`              | `() => Promise<void>`                                  | Full release publish flow: IPFS upload → optional Bulletin → `musicRegRegister()`.                 |
| `refreshArtistRoyalties`      | `(showBusy?: boolean) => Promise<void>`                | Fetch all `MusicRoyAccessPaid` logs for the artist's runtime.                                      |
| `updateArtistName`            | `(name: string) => void`                               | Update artist name in state and persist to `localStorage`.                                         |
| `getActiveWalletClient`       | `() => Promise<WalletClient>`                          | Returns the viem `WalletClient` for the connected artist wallet. Throws if no wallet is connected. |
| `setUploadToBulletinEnabled`  | `(enabled: boolean) => void`                           | Toggle Bulletin archival for the next release.                                                     |
| `setExpandedRoyaltyPaymentId` | `(id: string \| null) => void`                         | Expand or collapse a royalty ledger entry.                                                         |
