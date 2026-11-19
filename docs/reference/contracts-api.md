# Smart Contracts API Reference

This reference includes the source candidate for the next clean **Paseo Asset
Hub** generation (`chainId 420420417`). Contracts live under
`contracts/evm/contracts/`; generated bindings are the exact interface source.
A source merge does not establish deployed bytecode or device acceptance.

The owner selected a complete fresh testnet generation after the audit fixes,
abandoning older contracts/releases/references as active state. A03 changes the
runtime constructor, stable artist identity and administration transfer; see
[the role model](runtime-artist-authority.md) and the
[fresh-generation gate](../operations/deployment-configuration.md#native-payment-correction-candidate-484).
Tracked `deployments.json` addresses do not automatically implement this
candidate. No reset or deployment is performed by this source change.

Classic unlock payments use native EVM `msg.value`; ordinary Web uses EVM units
and Product submission converts to the connected chain's native precision.
[Native payment settlement](../backlog/native-payment-settlement-parity.md)
retains its target-runtime and device acceptance gates.

The earlier [one-selector registry remediation](../operations/registry-facet-remediation.md)
is historical tooling, not a migration into A03. ABI bindings are authoritative;
legacy NFT entries below still await the separate A04 review.

---

## ArtistRuntimeFactory

**File:** `contracts/ArtistRuntimeFactory.sol`

Deploys and registers one `SmartRuntime` Diamond proxy per artist. Registration
is staged to stay below Polkadot Hub EVM transaction weight limits.

### `createRuntime()`

```solidity
function createRuntime() external returns (address runtime)
```

Starts artist runtime bootstrap. It deploys a minimal `SmartRuntime` shell owned
temporarily by the factory, installs only `DiamondCutPallet`, records the shell
in `pendingRuntimeOf`, and emits `ArtistRuntimeBootstrapStarted`.

The runtime is not visible in `ArtistDirectory` until all bootstrap stages are
complete.

**Reverts if:**

- `msg.sender` is already registered in `ArtistDirectory`.
- `msg.sender` already has a pending runtime bootstrap.

**Emits:**

- `ArtistRuntimeBootstrapStarted(address indexed artist, address indexed runtime)`
- `ArtistRuntimeBootstrapStep(address indexed artist, address indexed runtime, uint8 indexed completedStage)`

---

### `installRuntimeStep()`

```solidity
function installRuntimeStep() external returns (uint8 completedStage)
```

Installs the next pending bootstrap stage for `msg.sender`.

| Stage before call | Action performed |
| --- | --- |
| `1` | Install `DiamondLoupePallet` |
| `2` | Install `OwnershipPallet` |
| `3` | Install `MusicRegistryPallet` |
| `4` | Install `MusicNFTPallet` |
| `5` | Install `MusicRoyaltiesPallet` |
| `6` | Install `MusicAccessPallet` |
| `7` | Initialise access registrar, transfer ownership to the artist, register in `ArtistDirectory` |

When the final step completes, `pendingRuntimeOf[msg.sender]` is cleared and
`ArtistDirectory.runtimeOf(msg.sender)` becomes the runtime address.

**Reverts if:**

- `msg.sender` has no pending runtime bootstrap.
- the stored bootstrap stage is invalid.

**Emits:**

- `ArtistRuntimeBootstrapStep(address indexed artist, address indexed runtime, uint8 indexed completedStage)`
- `ArtistRuntimeCreated(address indexed artist, address indexed runtime)` on finalisation.
- `ArtistDirectory.ArtistRegistered(address indexed artist, address indexed runtime)` on finalisation.

---

### `pendingRuntimeOf(address artist)`

```solidity
function pendingRuntimeOf(address artist) external view returns (address)
```

Returns the runtime shell currently being bootstrapped for `artist`, or
`address(0)` when no bootstrap is pending.

---

### `pendingRuntimeStageOf(address artist)`

```solidity
function pendingRuntimeStageOf(address artist) external view returns (uint8)
```

Returns the last completed bootstrap stage. The next `installRuntimeStep()` call
performs the following stage. A value of `0` means no bootstrap is pending.

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

### `musicRegRegister(TrackRegistration reg, address[] recipients, uint16[] bps)`

```solidity
function musicRegRegister(
    TrackRegistration calldata reg,
    address[] calldata recipients,
    uint16[] calldata bps
) external
```

The bound artist registers a new content hash after bootstrap readiness, mints
its NFT and fixes the royalty split. Technical administration alone cannot
publish. The exact tuple fields and event signature are in the
[generated registry ABI](../../web/src/generated/contracts/musicRegistry.ts).

Metadata and recipient limits are enforced by `LibMusicBounds` and
`LibMusicRoyalties.storeSplits`. An already registered hash cannot be reused,
even if its record is inactive. `TrackRegistered` records the original artist;
a later administration transfer does not rewrite it.

---

### `musicRegDeactivate(bytes32 contentHash)`

```solidity
function musicRegDeactivate(bytes32 contentHash) external
```

Marks a track inactive without deleting its record or payment history. Inactive
policy denies new key grants; ordinary active discovery filters it out.

**Caller must be:** the recorded original track artist.

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
track.active == false                          → false
listener == original artist                    → true
listener == owner(tokenId)                     → true
accessMode == classic
  AND paidAccess[contentHash][listener] == true → true
accessMode == human-free
  AND Individuality level >= requiredPersonhood → true
accessMode == free                             → true
otherwise                                     → false
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

Deprecated ABI-stability entry point. Current runtimes read personhood from the
Individuality precompile in Dotify's application context; this setter reverts
instead of writing unused storage.

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

Frontend writes build an explicit native runtime payment intent before calling
this function. CASH is not passed through this runtime method; Product-native
CASH settlement requires a future receipt or bridge model.

On success:

1. Records `paidAccess[contentHash][msg.sender] = true`.
2. Settles the stored track price across royalty splits (basis points).
3. Sends each recipient share with bounded gas.
4. Records any failed recipient transfer as claimable.
5. Sends remainder to the original artist address stored on the track.
6. Refunds any overpayment to the caller.
7. Emits `MusicRoyAccessPaid` and per-recipient settlement events.

**Emits:**

- `MusicRoyAccessPaid(bytes32 indexed contentHash, address indexed listener, uint256 amount)`
- `MusicRoyRoyaltyPaid(bytes32 indexed contentHash, address indexed listener, address indexed recipient, uint256 amount)`
- `MusicRoyRoyaltyPayoutFailed(bytes32 indexed contentHash, address indexed listener, address indexed recipient, uint256 amount)`
- `MusicRoyRoyaltyClaimable(bytes32 indexed contentHash, address indexed listener, address indexed recipient, uint256 amount, uint256 pendingTotal)`

---

### `musicRoyClaimable(address recipient)`

```solidity
function musicRoyClaimable(address recipient) external view returns (uint256)
```

Returns the native-token amount currently waiting in the runtime for
`recipient`.

---

### `musicRoyClaim(address recipient)`

```solidity
function musicRoyClaim(address recipient) external returns (uint256 amount, bool settled)
```

Claims pending native-token royalties. The caller must be the same address as
`recipient`; third-party claim helpers cannot drain another recipient's balance.

The claim transfer uses the same bounded-gas native transfer helper as immediate
settlement. If the recipient still cannot receive the transfer, the transaction
does not revert; the balance is restored and remains claimable for a later retry.

**Emits:**

- `MusicRoyRoyaltyClaimed(address indexed recipient, uint256 amount)`
- `MusicRoyRoyaltyClaimFailed(address indexed recipient, uint256 amount)`

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
The current NFT owner has playback access while the release is active. NFT
transfer does not rewrite the original artist field, SmartRuntime ownership, or
royalty beneficiaries.

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

Transfers track ownership (NFT). For Human free tracks, `to` must have the
required personhood level.

---

## Core Diamond pallets

These are inherited from the `smart-runtimes` shared library.

### `DiamondCutPallet` — `diamondCut(FacetCut[] calldata cuts, address init, bytes calldata data)`

Adds, replaces, or removes function selectors on the runtime. Caller must be the runtime owner.

### `DiamondLoupePallet`

Introspection: `facets()`, `facetFunctionSelectors(address)`, `facetAddresses()`, `facetAddress(bytes4)`.

### `OwnershipPallet`

The generated [ownership ABI](../../web/src/generated/contracts/runtimeOwnership.ts)
exposes `owner()`, `runtimeArtist()` and `pendingOwner()`. `transferOwnership`
offers administration; only the pending recipient's `acceptOwnership` completes
it. The current owner can `cancelOwnershipTransfer`. Artist identity, authorship,
publication, NFTs and recipients do not move. See the
[canonical role and bootstrap model](runtime-artist-authority.md).

---

## Price conversion

The Solidity field is still named `pricePlanck` for historical/Substrate
context, but the active EVM path stores prices directly as 18-decimal native
token units. The frontend uses viem's `parseEther()` and `formatEther()` helpers
for display and `msg.value`; the payment symbol comes from the configured EVM
chain's native currency (`PAS` on chain `420420417`).

| Format                         | Example                   |
| ------------------------------ | ------------------------- |
| Native display amount                    | `0.5`                     |
| Stored value / EVM `msg.value`           | `500_000_000_000_000_000` |
| Paseo `Revive.call.value` (10 decimals)   | `5_000_000_000`           |

Frontend conversion: `src/utils/format.ts` → `dotToPlanck()` for input and
`formatWeiAsDot()` for display. The `dotToPlanck()` function name is legacy; it
returns 18-decimal EVM contract units via `parseEther()`.

The viem adapter sends the stored value directly as EVM `msg.value`. The Product
CDM adapter submits a native `pallet-revive` extrinsic instead, so it reads the
connected chain's `tokenDecimals` and divides only `Revive.call.value` by
`10^(18 - tokenDecimals)`. The pallet expands that native Balance back to the
same 18-decimal EVM value before contract execution. The adapter rejects values
that cannot be represented exactly; stored `pricePlanck` ABI arguments are never
rescaled.
