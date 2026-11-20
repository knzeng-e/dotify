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
the [NFT-free price candidate](native-price-without-nft.md) changes the record ABI and Classic price policy.

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
| `4` | Install `MusicRoyaltiesPallet` |
| `5` | Install `MusicAccessPallet` |
| `6` | Install `MusicMetadataPallet` for artist-controlled corrections |
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

Returns paired artist/runtime arrays in registration order. API and standalone
Web readers request 50 entries per call; Product defaults to 50. Audit tooling
requests at most 100. The function signature and return ABI are unchanged.

### Directory page bounds (A08)

The source candidate returns at most **100 pairs** per call, matching the
existing track-page maximum. With `total = artistCount()`:

| Input | Returned length |
| --- | --- |
| `limit == 0`, empty directory or `offset >= total` | 0 in both arrays |
| Otherwise | `min(limit, 100, total - offset)` |

The calculation subtracts only after checking the offset and never adds the
untrusted limit. `offset = 1, limit = uint256.max` therefore returns a bounded
page instead of an arithmetic panic. Maximum offsets also return empty arrays.
Both arrays have the same length and each runtime belongs to the artist at the
same index. Registration, count, lookup and indexed reads retain their behavior.

The API pins enumeration to its selected confirmed block. Direct Web/Product
readers retain their existing unpinned queries; this correction does not add
snapshot isolation there. For a coherent snapshot, use one block throughout.
Either request at
most 100 entries and advance by that request, or advance by the actual returned
length; do not request 1,000 then advance 1,000 after receiving only 100.
`createProductCdmRuntimeReader` accepts `directoryPageSize` from 1 through 100
(default 50); invalid configuration raises a `RangeError` before querying.
API/Web fixed 50-entry requests and tooling's 100-entry requests remain valid.

This bounds one contract response, not the total artist count, catalogue memory
or provider load. Existing independent RPC concurrency, replay/address batches
and per-runtime read budgets still apply; this correction adds no catalogue-wide
admission limit. The directory is a standalone non-upgradeable contract, so corrected
bytecode belongs to the selected fresh generation, not a runtime facet upgrade.
See the [deployment gate](../operations/deployment-configuration.md#directory-pagination-a08)
and [scope](../backlog/bounded-contract-pagination.md).
[Local A08 evidence](../backlog/implementation/evidence/bounded-contract-pagination-2026-11-19.md)
records the reproduced overflow and complete contract/consumer traversals.

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

The bound artist registers a new content hash after bootstrap readiness and
fixes its royalty split without minting a token. Technical administration alone cannot
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
paidAccess[contentHash][listener] == true       → true
accessMode == human-free
  AND supported Individuality level >= requiredPersonhood → true
accessMode == free                             → true
otherwise                                     → false
```

---

### `musicAccHasPaid(bytes32 contentHash, address listener)`

```solidity
function musicAccHasPaid(bytes32 contentHash, address listener)
    external view returns (bool)
```

Returns the recorded Classic paid grant, including after mode changes or
deactivation. It does not evaluate personhood or current activity. For current
access, use `musicAccCanAccess`: the [A05 rule](paid-release-access.md) preserves
paid access across modes only while the release is active.

---

### Personhood diagnostics and predicates

`musicAccPersonhoodInfo(address)` returns `(uint8 status, bytes32 contextAlias,
bool live)`; `musicAccPersonhoodLevel(address)` returns the supported typed level.
`musicAccHasPersonhood(address, PersonhoodLevel)` checks a supported requirement.
The [reader policy](personhood-status-policy.md) defines the response table and
failure cases. A nonzero raw diagnostic status alone never grants access;
unsupported or malformed responses produce a typed None without enum panic.

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

## Native-compatible price policy

`musicRegNativeDecimals()` returns the generation's native Balance precision.
Classic registration and policy edits require a positive uint128 EVM price
that is divisible by `10 ** (18 - nativeDecimals)`. Prices remain 18-decimal
EVM integers; the historical `pricePlanck` name does not change their unit.
See [exact prices and NFT removal](native-price-without-nft.md) for the
constructor, getter/event changes, supported precision and delivery boundary.

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
publication and recipients do not move. See the
[canonical role and bootstrap model](runtime-artist-authority.md).

---

## Price conversion

The historical `pricePlanck` field stores 18-decimal EVM values. Decimal input
is parsed exactly by `dotToPlanck()` / `parseExactEvmAmount()` and prices are
formatted without truncation. EVM writers send that integer as `msg.value`;
Product converts only the extrinsic's native `Revive.call.value`. ABI price
arguments are never rescaled. The configured currency symbol is independent
of native Balance precision.

Publication and policy edits enforce the generation's native precision in both
writers and the registry. See [exact price units and limits](native-price-without-nft.md#price-units-and-authority)
for the authoritative conversion rule, supported decimals and failure policy.
