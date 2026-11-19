# Exact prices and NFT-free releases

This is the [#493 source candidate](../backlog/native-price-without-nft.md),
following the owner's 19 November 2026 request. It supersedes NFT functionality
in the earlier artist-runtime model. It is not a deployed or device-accepted
generation.

The [19 November local validation record](../backlog/implementation/evidence/native-price-without-nft-2026-11-19.md)
binds the checks to the candidate source and final signaling fixtures.

## Price units and authority

`pricePlanck` retains its historical ABI name but stores an unsigned 128-bit
**18-decimal EVM value**. It is not a native Balance integer. The fresh factory
declares `nativeTokenDecimals` from 0 to 18; `SmartRuntime` initializes that
precision in `LibNativePrice` before installing facets. The reviewed API has no
setter. `musicRegNativeDecimals()` exposes it and fails on uninitialized state.
Arbitrary administrator-installed code remains an upgrade trust boundary.

For a native precision `d`, one native unit equals `10 ** (18 - d)` EVM units.
Classic registration and policy changes require a positive price divisible by
that quantum. An invalid price reverts before changing registry or split state.
Free and HumanFree continue storing a zero price.

| Native decimals | Smallest Classic price, EVM units | Token amount |
| --- | --- | --- |
| 0 | 1000000000000000000 | 1 |
| 10 | 100000000 | 0.0000000001 |
| 12 | 1000000 | 0.000000000001 |
| 18 | 1 | 0.000000000000000001 |

The configured precision must match the target chain. It is not inferred from
EVM currency metadata, which reports 18 decimals, or hardcoded for all chains.
`DOTIFY_NATIVE_TOKEN_DECIMALS` is mandatory for deployment and planning; the
manifest and finalized factory readback include it. Product additionally
compares the runtime value with its native adapter configuration before
publishing or editing a price. Actual target-runtime compatibility remains a
delivery check.

## Client and catalog behavior

Both writers validate the declared precision and uint128 price range before
requesting a publication or policy-change signature. The studio preflights the
price before preparing publication assets. A missing getter or Product precision
mismatch is an error, with no legacy fallback.

Decimal inputs are parsed exactly: no floating-point conversion, exponent input
or rounding of more than 18 fractional digits. Native precision is checked
separately. The catalog's `priceWei` string preserves the full integer;
`priceDot` and artist policy drafts preserve its exact decimal value rather
than truncating to nine fractional digits. EVM payment submission also refuses
an incompatible quote before signing, using a proven-not-submitted error;
Product retains its exact EVM-to-native conversion guard. Neither route rounds
an old unsupported price into a different payment.

## NFT removal and interface changes

The active source no longer contains `MusicNFTPallet`, `LibMusicNFT` or the
unused monolithic `MusicRightsRegistry`. There are no mint, ownership, approval,
transfer or token-index lookup APIs, and the runtime does not advertise ERC-721.
The registry no longer stores token IDs or emits a token ID in `TrackRegistered`.
`musicRegGetTrack(contentHash)` returns the track record directly, with no token
identifier or second token-owner result. Web, API, signaling and Product readers
use that shape; API registry bindings come from compiler artifacts. Catalog
release responses and bootstrap fixtures no longer contain `tokenId`.

The factory takes six facet addresses (cut, loupe, ownership, registry,
royalties, access), followed by native decimals, after directory and initializer.
`SmartRuntime(owner, artist, nativeTokenDecimals, cuts, init, calldata)` binds
artist and precision independently. After `createRuntime`, six installation
calls finish the runtime: loupe, ownership, registry, royalties, access and
artist-signed finalization. The former NFT stage is absent.

An active release grants access to its recorded artist, to everyone in Free,
to a verified eligible person in HumanFree, or to a verified payer in Classic.
Technical administration grants no listener entitlement or artist identity.
Deactivation still denies new key delivery, and previously disclosed keys
cannot be recalled. NFT removal does not change A05's outstanding policy
question about future changes after a purchase.

## Delivery boundary

This changes constructor/creation bytecode, registry storage, read/event ABI
and the catalog response. It requires the selected **fresh generation**, not
an in-place facet replacement or an import of earlier releases. Deliver factory,
runtimes, initializer, API/catalog and clients together after the
[matched-generation gate](../operations/deployment-configuration.md#native-price-and-nft-removal-493).
Earlier deployment addresses and finalized CDM snapshots are historical inputs
until a separately authorized rollout replaces them; generated candidate ABIs
must not be mistaken for those deployed interfaces. Historical evidence is
retained. No NFT migration, old-key reset, public transaction or deployment is
performed here.
