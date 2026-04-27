// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { SmartRuntime } from './SmartRuntime.sol';
import { IDiamondCut } from './interfaces/IDiamondCut.sol';
import { IDiamondLoupe } from './interfaces/IDiamondLoupe.sol';
import { IERC165 } from './interfaces/IERC165.sol';
import { ArtistDirectory } from './ArtistDirectory.sol';
import { OwnershipPallet } from './pallets/OwnershipPallet.sol';
import { MusicRegistryPallet } from './pallets/MusicRegistryPallet.sol';
import { MusicNFTPallet } from './pallets/MusicNFTPallet.sol';
import { MusicRoyaltiesPallet } from './pallets/MusicRoyaltiesPallet.sol';
import { MusicAccessPallet } from './pallets/MusicAccessPallet.sol';

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
  constructor(
    address _directory,
    address _initContract,
    address _cutPallet,
    address _loupePallet,
    address _ownershipPallet,
    address _registryPallet,
    address _nftPallet,
    address _royaltiesPallet,
    address _accessPallet
  ) {
    directory = ArtistDirectory(_directory);
    initContract = _initContract;
    cutPallet = _cutPallet;
    loupePallet = _loupePallet;
    ownershipPallet = _ownershipPallet;
    registryPallet = _registryPallet;
    nftPallet = _nftPallet;
    royaltiesPallet = _royaltiesPallet;
    accessPallet = _accessPallet;
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
    cuts[0] = IDiamondCut.FacetCut(cutPallet, IDiamondCut.FacetCutAction.Add, _diamondCutSelectors());
    cuts[1] = IDiamondCut.FacetCut(loupePallet, IDiamondCut.FacetCutAction.Add, _diamondLoupeSelectors());
    cuts[2] = IDiamondCut.FacetCut(ownershipPallet, IDiamondCut.FacetCutAction.Add, _ownershipSelectors());
    cuts[3] = IDiamondCut.FacetCut(registryPallet, IDiamondCut.FacetCutAction.Add, _musicRegistrySelectors());
    cuts[4] = IDiamondCut.FacetCut(nftPallet, IDiamondCut.FacetCutAction.Add, _musicNFTSelectors());
    cuts[5] = IDiamondCut.FacetCut(royaltiesPallet, IDiamondCut.FacetCutAction.Add, _musicRoyaltiesSelectors());
    cuts[6] = IDiamondCut.FacetCut(accessPallet, IDiamondCut.FacetCutAction.Add, _musicAccessSelectors());
  }

  function _diamondCutSelectors() private pure returns (bytes4[] memory selectors) {
    selectors = new bytes4[](1);
    selectors[0] = IDiamondCut.diamondCut.selector;
  }

  function _diamondLoupeSelectors() private pure returns (bytes4[] memory selectors) {
    selectors = new bytes4[](5);
    selectors[0] = IDiamondLoupe.facets.selector;
    selectors[1] = IDiamondLoupe.facetFunctionSelectors.selector;
    selectors[2] = IDiamondLoupe.facetAddresses.selector;
    selectors[3] = IDiamondLoupe.facetAddress.selector;
    selectors[4] = IERC165.supportsInterface.selector;
  }

  function _ownershipSelectors() private pure returns (bytes4[] memory selectors) {
    selectors = new bytes4[](2);
    selectors[0] = OwnershipPallet.owner.selector;
    selectors[1] = OwnershipPallet.transferOwnership.selector;
  }

  function _musicRegistrySelectors() private pure returns (bytes4[] memory selectors) {
    selectors = new bytes4[](8);
    selectors[0] = MusicRegistryPallet.musicRegRegister.selector;
    selectors[1] = MusicRegistryPallet.musicRegDeactivate.selector;
    selectors[2] = MusicRegistryPallet.musicRegGetTrack.selector;
    selectors[3] = MusicRegistryPallet.musicRegGetTrackByTokenId.selector;
    selectors[4] = MusicRegistryPallet.musicRegIsRegistered.selector;
    selectors[5] = MusicRegistryPallet.musicRegIsActive.selector;
    selectors[6] = MusicRegistryPallet.musicRegTrackCount.selector;
    selectors[7] = MusicRegistryPallet.musicRegTrackHashAtIndex.selector;
  }

  function _musicNFTSelectors() private pure returns (bytes4[] memory selectors) {
    selectors = new bytes4[](7);
    selectors[0] = MusicNFTPallet.musicNFTTransfer.selector;
    selectors[1] = MusicNFTPallet.musicNFTApprove.selector;
    selectors[2] = MusicNFTPallet.musicNFTSetApprovalForAll.selector;
    selectors[3] = MusicNFTPallet.musicNFTOwnerOf.selector;
    selectors[4] = MusicNFTPallet.musicNFTBalanceOf.selector;
    selectors[5] = MusicNFTPallet.musicNFTGetApproved.selector;
    selectors[6] = MusicNFTPallet.musicNFTIsApprovedForAll.selector;
  }

  function _musicRoyaltiesSelectors() private pure returns (bytes4[] memory selectors) {
    selectors = new bytes4[](5);
    selectors[0] = MusicRoyaltiesPallet.musicRoyPayAccess.selector;
    selectors[1] = MusicRoyaltiesPallet.musicRoyRecordListen.selector;
    selectors[2] = MusicRoyaltiesPallet.musicRoySplitCount.selector;
    selectors[3] = MusicRoyaltiesPallet.musicRoySplitAt.selector;
    selectors[4] = MusicRoyaltiesPallet.musicRoyTotalBps.selector;
  }

  function _musicAccessSelectors() private pure returns (bytes4[] memory selectors) {
    selectors = new bytes4[](7);
    selectors[0] = MusicAccessPallet.setPersonhoodRegistrar.selector;
    selectors[1] = MusicAccessPallet.musicAccSetPersonhoodLevel.selector;
    selectors[2] = MusicAccessPallet.musicAccCanAccess.selector;
    selectors[3] = MusicAccessPallet.musicAccHasPaid.selector;
    selectors[4] = MusicAccessPallet.musicAccPersonhoodLevel.selector;
    selectors[5] = MusicAccessPallet.musicAccHasPersonhood.selector;
    selectors[6] = MusicAccessPallet.musicAccGetRegistrar.selector;
  }
}
