# Smart Contracts API Reference

All contracts are deployed on **Paseo Asset Hub** (`chainId 420420417`). Source lives in `Dotify/contracts/evm/contracts/`.

**Live deployments:**

- `ArtistRuntimeFactory`: `0x38dba15b7296ca9d3544c9f996e8e1898ad42ca5`
- `ArtistDirectory`: `0x7f8bb68d2a451f330880b7bf9237bc3521158d9a`
- `DotifyRuntimeInitializer`: `0x2ae93335bf8d2fdaab1a92f2471c566bbef5d15b`

---

## ArtistRuntimeFactory

**File:** `contracts/ArtistRuntimeFactory.sol`

Deploys and registers one `SmartRuntime` Diamond proxy per artist. Called once per artist; subsequent calls revert if the artist is already registered.

### `createRuntime()`

```solidity
function createRuntime() external returns (address runtime)
```

Deploys a new `SmartRuntime` for `msg.sender`, registers it in `ArtistDirectory`, and initializes all music pallets.

| Gas consideration | Notes                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| High gas usage    | Deploys a proxy + initialises 7 pallets. Compile testnet deployments with optimizer + `viaIR`; unoptimized factories may hit Polkadot Hub EVM transaction/weight limits. |

**Reverts if:**

- `msg.sender` is already registered in `ArtistDirectory`.

**Emits:** None directly. `ArtistDirectory` emits `ArtistRegistered`.

---

## ArtistDirectory

**File:** `contracts/ArtistDirectory.sol`

Global on-chain index mapping artist addresses to their `SmartRuntime` addresses. Write-only by the factory.

### `runtimeOf(address artist)`

```solidity
function runtimeOf(address artist) external view returns (address)
```

Returns the SmartRuntime address for `artist`, or `address(0)` if not registered.

---

### `artistCount()`

```solidity
function artistCount() external view returns (uint256)
```

Returns the total number of registered artists.

---

### `artistsPage(uint256 offset, uint256 limit)`

```solidity
function artistsPage(uint256 offset, uint256 limit)
    external view
    returns (address[] memory artists, address[] memory runtimes)
```

Returns a paginated slice of artists and their runtime addresses. Used by the frontend to build the catalog in batches of 50.

| Parameter | Description           |
| --------- | --------------------- |
| `offset`  | Start index (0-based) |
| `limit`   | Max entries to return |

**Emits on registration:** `ArtistRegistered(address indexed artist, address indexed runtime)`

---

## MusicRegistryPallet

**File:** `contracts/pallets/MusicRegistryPallet.sol`

Tracks the on-chain record of every registered release. All state lives in the artist's own SmartRuntime.

### `musicRegRegister(TrackData calldata data, address[] calldata royaltyRecipients, uint256[] calldata royaltyShares)`

```solidity
struct TrackData {
    bytes32 contentHash;
    string title;
    string artistName;
    string description;
    string imageRef;
    string audioRef;
    string metadataRef;
    string artistContractRef;
    uint256 royaltyBps;
    uint8 accessMode;         // 0 = human-free, 1 = classic
    uint256 pricePlanck;       // Historical name; value is 18-decimal native token units.
    uint8 requiredPersonhood; // 0 = none, 1 = DIM1, 2 = DIM2
}

function musicRegRegister(
    TrackData calldata data,
    address[] calldata royaltyRecipients,
    uint256[] calldata royaltyShares
) external
```

Registers a new track. Mints an NFT via `MusicNFTPallet` and stores royalty splits in `MusicRoyaltiesPallet`.

**Caller must be:** Runtime owner (the artist).

**Reverts if:**

- `contentHash` is already registered and active.
- `royaltyRecipients.length != royaltyShares.length`.
- Sum of `royaltyShares` exceeds 10,000 bps.

**Emits:** `MusicTrackRegistered(bytes32 indexed contentHash, address indexed artist, uint256 tokenId)`

---

### `musicRegDeactivate(bytes32 contentHash)`

```solidity
function musicRegDeactivate(bytes32 contentHash) external
```

Marks a track as inactive. Deactivated tracks are excluded from catalog queries.

**Caller must be:** Runtime owner.

---

### `musicRegGetTrack(bytes32 contentHash)`

```solidity
function musicRegGetTrack(bytes32 contentHash)
    external view
    returns (OnchainTrackRecord memory record, bytes32 hash)
```

Returns the full track record for a given content hash.

---

### `musicRegTrackCount()`

```solidity
function musicRegTrackCount() external view returns (uint256)
```

Returns the total number of registered (including deactivated) tracks.

---

### `musicRegTrackHashAtIndex(uint256 index)`

```solidity
function musicRegTrackHashAtIndex(uint256 index) external view returns (bytes32)
```

Returns the content hash at a given storage index. Used with `musicRegTrackCount()` to iterate all tracks.

---

## MusicAccessPallet

**File:** `contracts/pallets/MusicAccessPallet.sol`

Resolves whether a given listener has access to a given track.

### `musicAccCanAccess(bytes32 contentHash, address listener)`

```solidity
function musicAccCanAccess(bytes32 contentHash, address listener)
    external view returns (bool)
```

Returns `true` if the listener is allowed full playback. Logic:

```
listener == owner(tokenId)           → true (artist always has access)
accessMode == classic
  AND paidAccess[contentHash][listener] == true  → true
accessMode == human-free
  AND personhoodLevelOf[listener] >= requiredPersonhood  → true
otherwise → false
```

---

### `musicAccHasPaid(bytes32 contentHash, address listener)`

```solidity
function musicAccHasPaid(bytes32 contentHash, address listener)
    external view returns (bool)
```

Returns whether the listener has paid for Classic-mode access. Does not evaluate personhood.

---

### `musicAccSetPersonhoodLevel(address listener, uint8 level)`

```solidity
function musicAccSetPersonhoodLevel(address listener, uint8 level) external
```

Records a personhood level for a listener address.

**Caller must be:** The designated personhood registrar (initially the artist; set by `DotifyRuntimeInitializer`).

| `level` | Meaning                |
| ------- | ---------------------- |
| `0`     | No personhood recorded |
| `1`     | DIM1                   |
| `2`     | DIM2                   |

---

## MusicRoyaltiesPallet

**File:** `contracts/pallets/MusicRoyaltiesPallet.sol`

Processes payments and records access grants for Classic-mode tracks.

### `musicRoyPayAccess(bytes32 contentHash)`

```solidity
function musicRoyPayAccess(bytes32 contentHash) external payable
```

Pay for access to a Classic-mode track.

**`msg.value`** must be at least the stored `pricePlanck` value. The Solidity
field name is historical; Dotify now stores the price as 18-decimal Asset Hub
EVM native units.

On success:

1. Distributes `msg.value` across royalty splits (basis points).
2. Sends remainder to the runtime owner.
3. Sets `paidAccess[contentHash][msg.sender] = true`.
4. Emits `MusicRoyAccessPaid`.

**Emits:** `MusicRoyAccessPaid(bytes32 indexed contentHash, address indexed listener, uint256 amount)`

---

### `musicRoyRecordListen(bytes32 contentHash)`

```solidity
function musicRoyRecordListen(bytes32 contentHash) external
```

Records a completed listen event for a Human free track (analytics only, no payment).

**Emits:** `MusicRoyListenRecorded(bytes32 indexed contentHash, address indexed listener)`

---

## MusicNFTPallet

**File:** `contracts/pallets/MusicNFTPallet.sol`

ERC-721-style NFT per track. Each registered track mints one NFT to the artist.

### `ownerOf(uint256 tokenId)`

```solidity
function ownerOf(uint256 tokenId) external view returns (address)
```

---

### `balanceOf(address owner)`

```solidity
function balanceOf(address owner) external view returns (uint256)
```

---

### `transferFrom(address from, address to, uint256 tokenId)`

```solidity
function transferFrom(address from, address to, uint256 tokenId) external
```

Transfers track ownership (NFT). For Human free tracks, `to` must have the required personhood level.

---

## Core Diamond pallets

These are inherited from the `smart-runtimes` shared library.

### `DiamondCutPallet` — `diamondCut(FacetCut[] calldata cuts, address init, bytes calldata data)`

Adds, replaces, or removes function selectors on the runtime. Caller must be the runtime owner.

### `DiamondLoupePallet`

Introspection: `facets()`, `facetFunctionSelectors(address)`, `facetAddresses()`, `facetAddress(bytes4)`.

### `OwnershipPallet`

`owner()` — returns the current runtime owner.
`transferOwnership(address newOwner)` — transfers runtime ownership.

---

## Price conversion

The Solidity field is still named `pricePlanck` for historical/Substrate
context, but the active EVM path stores prices directly as 18-decimal native
token units. The frontend uses viem's `parseEther()` and `formatEther()` helpers
for DOT display and `msg.value`.

| Format                         | Example                   |
| ------------------------------ | ------------------------- |
| DOT (display)                  | `0.5`                     |
| Stored value / EVM `msg.value` | `500_000_000_000_000_000` |

Frontend conversion: `src/utils/format.ts` → `dotToPlanck()` for input and
`formatWeiAsDot()` for display. The `dotToPlanck()` function name is legacy; it
returns 18-decimal native units via `parseEther()`.
