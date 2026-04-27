// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { SmartRuntime } from './SmartRuntime.sol';
import { IDiamondCut } from './interfaces/IDiamondCut.sol';
import { ArtistDirectory } from './ArtistDirectory.sol';

/// @title ArtistRuntimeFactory
/// @notice Deploys a personal SmartRuntime for each Dotify artist.
///
///         Architecture
///         ────────────
///         Pallet implementations are deployed ONCE and shared across all artist
///         runtimes — storage lives in each SmartRuntime proxy, not in the pallet
///         contract, so artists are fully isolated.  Artists can later upgrade
///         their own runtime independently by calling `diamondCut` with a new
///         pallet address.
///
///         Initialisation
///         ──────────────
///         Every new SmartRuntime is bootstrapped by `DotifyRuntimeInitializer`
///         via `delegatecall`, which sets the personhood registrar to the artist
///         (owner) so they can grant listener access without extra admin steps
///         and retain owner control over future registrar updates.
///
///         Usage
///         ─────
///         1. Artist calls `createRuntime()`.
///         2. Factory deploys a new SmartRuntime owned by `msg.sender`.
///         3. All 7 pallets (3 core + 4 music) are wired in via `diamondCut`.
///         4. The runtime address is registered in `ArtistDirectory`.
///         5. Factory emits `ArtistRuntimeCreated` with the new runtime address.
contract ArtistRuntimeFactory {
  // -------------------------------------------------------------------------
  // Immutable references
  // -------------------------------------------------------------------------

  ArtistDirectory public immutable directory;
  address public immutable initContract;

  // Core pallet implementations (shared)
  address public immutable cutPallet;
  address public immutable loupePallet;
  address public immutable ownershipPallet;

  // Music pallet implementations (shared)
  address public immutable registryPallet;
  address public immutable nftPallet;
  address public immutable royaltiesPallet;
  address public immutable accessPallet;

  // -------------------------------------------------------------------------
  // Selector arrays (set once at construction)
  // -------------------------------------------------------------------------

  bytes4[] private _cutSels;
  bytes4[] private _loupeSels;
  bytes4[] private _ownershipSels;
  bytes4[] private _registrySels;
  bytes4[] private _nftSels;
  bytes4[] private _royaltiesSels;
  bytes4[] private _accessSels;

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  event ArtistRuntimeCreated(address indexed artist, address indexed runtime);

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  /// @param _directory     ArtistDirectory contract address.
  /// @param _initContract  DotifyRuntimeInitializer contract address.
  /// @param _cutPallet     DiamondCutPallet implementation address.
  /// @param _loupePallet   DiamondLoupePallet implementation address.
  /// @param _ownershipPallet OwnershipPallet implementation address.
  /// @param _registryPallet MusicRegistryPallet implementation address.
  /// @param _nftPallet       MusicNFTPallet implementation address.
  /// @param _royaltiesPallet MusicRoyaltiesPallet implementation address.
  /// @param _accessPallet    MusicAccessPallet implementation address.
  /// @param selectors        ABI selectors for each pallet in the same order
  ///                         [cut, loupe, ownership, registry, nft, royalties, access].
  constructor(
    address _directory,
    address _initContract,
    address _cutPallet,
    address _loupePallet,
    address _ownershipPallet,
    address _registryPallet,
    address _nftPallet,
    address _royaltiesPallet,
    address _accessPallet,
    bytes4[][] memory selectors
  ) {
    require(selectors.length == 7, 'Factory: need 7 selector arrays');

    directory = ArtistDirectory(_directory);
    initContract = _initContract;
    cutPallet = _cutPallet;
    loupePallet = _loupePallet;
    ownershipPallet = _ownershipPallet;
    registryPallet = _registryPallet;
    nftPallet = _nftPallet;
    royaltiesPallet = _royaltiesPallet;
    accessPallet = _accessPallet;

    _cutSels = selectors[0];
    _loupeSels = selectors[1];
    _ownershipSels = selectors[2];
    _registrySels = selectors[3];
    _nftSels = selectors[4];
    _royaltiesSels = selectors[5];
    _accessSels = selectors[6];
  }

  // -------------------------------------------------------------------------
  // External — artist entry point
  // -------------------------------------------------------------------------

  /// @notice Deploy a new SmartRuntime owned by `msg.sender`.
  ///         Reverts if the caller already has a runtime in the directory.
  /// @return runtime  The address of the newly deployed SmartRuntime.
  function createRuntime() external returns (address runtime) {
    require(directory.runtimeOf(msg.sender) == address(0), 'Factory: artist already has a runtime');

    IDiamondCut.FacetCut[] memory cuts = _buildCuts();
    bytes memory initCalldata = abi.encodeWithSignature('initialize()');

    SmartRuntime sr = new SmartRuntime(msg.sender, cuts, initContract, initCalldata);
    runtime = address(sr);

    directory.register(msg.sender, runtime);
    emit ArtistRuntimeCreated(msg.sender, runtime);
  }

  // -------------------------------------------------------------------------
  // View helpers
  // -------------------------------------------------------------------------

  /// @notice Returns the runtime for an artist, or address(0) if none.
  function runtimeOf(address artist) external view returns (address) {
    return directory.runtimeOf(artist);
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  function _buildCuts() private view returns (IDiamondCut.FacetCut[] memory cuts) {
    cuts = new IDiamondCut.FacetCut[](7);
    cuts[0] = IDiamondCut.FacetCut(cutPallet, IDiamondCut.FacetCutAction.Add, _cutSels);
    cuts[1] = IDiamondCut.FacetCut(loupePallet, IDiamondCut.FacetCutAction.Add, _loupeSels);
    cuts[2] = IDiamondCut.FacetCut(ownershipPallet, IDiamondCut.FacetCutAction.Add, _ownershipSels);
    cuts[3] = IDiamondCut.FacetCut(registryPallet, IDiamondCut.FacetCutAction.Add, _registrySels);
    cuts[4] = IDiamondCut.FacetCut(nftPallet, IDiamondCut.FacetCutAction.Add, _nftSels);
    cuts[5] = IDiamondCut.FacetCut(royaltiesPallet, IDiamondCut.FacetCutAction.Add, _royaltiesSels);
    cuts[6] = IDiamondCut.FacetCut(accessPallet, IDiamondCut.FacetCutAction.Add, _accessSels);
  }
}
