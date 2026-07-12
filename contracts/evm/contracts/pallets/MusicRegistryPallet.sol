// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { LibDiamond } from '../libraries/LibDiamond.sol';
import { LibMusicRegistry } from '../libraries/LibMusicRegistry.sol';
import { LibMusicNFT } from '../libraries/LibMusicNFT.sol';
import { LibMusicRoyalties } from '../libraries/LibMusicRoyalties.sol';

/// @title MusicRegistryPallet
/// @notice Smart Pallet for registering and deactivating music tracks on the
///         Dotify rights registry.  Each track registration mints a unique NFT
///         representing the artist's ownership deed and locks in royalty splits.
///
///         Storage: LibMusicRegistry, LibMusicNFT, LibMusicRoyalties
///         Prefix:  musicReg — avoids selector collisions with other pallets
contract MusicRegistryPallet {
  // -------------------------------------------------------------------------
  // Calldata struct (local — only used by musicRegRegister)
  // -------------------------------------------------------------------------

  struct TrackRegistration {
    bytes32 contentHash; // blake2b-256 hash of audio bytes
    string title;
    string artistName;
    string description;
    string imageRef; // ipfs://, seed://, dotify:local:, ...
    string audioRef;
    string metadataRef; // Bulletin Chain JSON manifest
    string artistContractRef; // artist contract document
    LibMusicRegistry.AccessMode accessMode;
    uint128 pricePlanck; // required > 0 for Classic; 0 ok for HumanFree
    LibMusicRegistry.PersonhoodLevel requiredPersonhood; // required for HumanFree
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  event TrackRegistered(
    bytes32 indexed contentHash,
    uint256 indexed tokenId,
    address indexed artist,
    string title,
    LibMusicRegistry.AccessMode accessMode,
    uint128 pricePlanck,
    LibMusicRegistry.PersonhoodLevel requiredPersonhood
  );

  event TrackDeactivated(bytes32 indexed contentHash, address indexed artist);
  event TrackReactivated(bytes32 indexed contentHash, address indexed artist);

  event TrackAccessModeChanged(
    bytes32 indexed contentHash,
    address indexed artist,
    LibMusicRegistry.AccessMode accessMode,
    uint128 pricePlanck,
    LibMusicRegistry.PersonhoodLevel requiredPersonhood
  );

  // -------------------------------------------------------------------------
  // Write functions
  // -------------------------------------------------------------------------

  /// @notice Register a new music track and mint the artist's ownership NFT.
  /// @param reg  Track metadata and access configuration.
  /// @param recipients  Royalty recipient addresses (at least one required).
  /// @param bps         Basis points for each recipient; must sum to ≤ 10 000.
  function musicRegRegister(TrackRegistration calldata reg, address[] calldata recipients, uint16[] calldata bps) external {
    LibDiamond.enforceIsContractOwner();

    LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
    _validateRegistration(rs, reg);

    uint16 totalBps = LibMusicRoyalties.storeSplits(LibMusicRoyalties.store(), reg.contentHash, recipients, bps);

    // Auto-increment token id; nextTokenId starts at 0 in uninitialised storage,
    // so we pre-increment to keep token IDs starting at 1.
    rs.nextTokenId += 1;
    uint256 tokenId = rs.nextTokenId;

    LibMusicNFT.mint(LibMusicNFT.store(), msg.sender, tokenId);
    rs.tokenIdToHash[tokenId] = reg.contentHash;
    rs.trackHashes.push(reg.contentHash);

    LibMusicRegistry.TrackRecord storage track = rs.tracks[reg.contentHash];
    track.artist = msg.sender;
    track.tokenId = tokenId;
    track.title = reg.title;
    track.artistName = reg.artistName;
    track.description = reg.description;
    track.imageRef = reg.imageRef;
    track.audioRef = reg.audioRef;
    track.metadataRef = reg.metadataRef;
    track.artistContractRef = reg.artistContractRef;
    track.royaltyBps = totalBps;
    track.accessMode = reg.accessMode;
    track.pricePlanck = reg.accessMode == LibMusicRegistry.AccessMode.Classic ? reg.pricePlanck : 0;
    track.requiredPersonhood = reg.accessMode == LibMusicRegistry.AccessMode.HumanFree ? reg.requiredPersonhood : LibMusicRegistry.PersonhoodLevel.None;
    track.registeredAtBlock = uint64(block.number);
    track.active = true;

    emit TrackRegistered(reg.contentHash, tokenId, msg.sender, reg.title, reg.accessMode, track.pricePlanck, track.requiredPersonhood);
  }

  /// @notice Change a track's access policy without re-uploading or re-pinning
  ///         anything: the ciphertext and CID never change, only the key-release
  ///         policy recorded here (Dotify v2 access model). Artist-only.
  ///
  ///         Past paid access is never revoked: a listener who bought a Classic
  ///         track keeps access through the paidAccess record even if the mode
  ///         later changes and changes back.
  /// @param contentHash         The track to update.
  /// @param accessMode          New mode: HumanFree, Classic, or Free.
  /// @param pricePlanck         New price; required > 0 for Classic, stored as 0 otherwise.
  /// @param requiredPersonhood  Required level for HumanFree, stored as None otherwise.
  function musicRegSetAccessMode(
    bytes32 contentHash,
    LibMusicRegistry.AccessMode accessMode,
    uint128 pricePlanck,
    LibMusicRegistry.PersonhoodLevel requiredPersonhood
  ) external {
    LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
    LibMusicRegistry.requireExists(rs, contentHash);
    LibMusicRegistry.TrackRecord storage track = rs.tracks[contentHash];
    require(track.artist == msg.sender, 'MusicRegistry: not artist');
    require(track.active, 'MusicRegistry: inactive');
    _validateAccessPolicy(accessMode, pricePlanck, requiredPersonhood);

    track.accessMode = accessMode;
    track.pricePlanck = accessMode == LibMusicRegistry.AccessMode.Classic ? pricePlanck : 0;
    track.requiredPersonhood = accessMode == LibMusicRegistry.AccessMode.HumanFree ? requiredPersonhood : LibMusicRegistry.PersonhoodLevel.None;

    emit TrackAccessModeChanged(contentHash, msg.sender, accessMode, track.pricePlanck, track.requiredPersonhood);
  }

  /// @notice Deactivate a track. Only the original artist can call this.
  ///         Deactivation prevents new access grants but does not revoke past payments.
  function musicRegDeactivate(bytes32 contentHash) external {
    LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
    LibMusicRegistry.requireExists(rs, contentHash);
    require(rs.tracks[contentHash].artist == msg.sender, 'MusicRegistry: not artist');
    require(rs.tracks[contentHash].active, 'MusicRegistry: already inactive');

    rs.tracks[contentHash].active = false;
    emit TrackDeactivated(contentHash, msg.sender);
  }

  /// @notice Reactivate a previously deactivated track. Only the original
  ///         artist can call this; the existing access policy and payment
  ///         history are preserved.
  function musicRegReactivate(bytes32 contentHash) external {
    LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
    LibMusicRegistry.requireExists(rs, contentHash);
    require(rs.tracks[contentHash].artist == msg.sender, 'MusicRegistry: not artist');
    require(!rs.tracks[contentHash].active, 'MusicRegistry: already active');

    rs.tracks[contentHash].active = true;
    emit TrackReactivated(contentHash, msg.sender);
  }

  // -------------------------------------------------------------------------
  // View functions
  // -------------------------------------------------------------------------

  function musicRegGetTrack(bytes32 contentHash) external view returns (LibMusicRegistry.TrackRecord memory track, address tokenOwner) {
    LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
    LibMusicRegistry.requireExists(rs, contentHash);
    track = rs.tracks[contentHash];
    tokenOwner = LibMusicNFT.store().ownerOf[track.tokenId];
  }

  function musicRegGetTrackByTokenId(uint256 tokenId) external view returns (LibMusicRegistry.TrackRecord memory track, address tokenOwner) {
    LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
    bytes32 contentHash = rs.tokenIdToHash[tokenId];
    require(contentHash != bytes32(0), 'MusicRegistry: token not found');
    track = rs.tracks[contentHash];
    tokenOwner = LibMusicNFT.store().ownerOf[tokenId];
  }

  function musicRegIsRegistered(bytes32 contentHash) external view returns (bool) {
    return LibMusicRegistry.store().tracks[contentHash].artist != address(0);
  }

  function musicRegIsActive(bytes32 contentHash) external view returns (bool) {
    return LibMusicRegistry.store().tracks[contentHash].active;
  }

  function musicRegTrackCount() external view returns (uint256) {
    return LibMusicRegistry.store().trackHashes.length;
  }

  function musicRegTrackHashAtIndex(uint256 index) external view returns (bytes32) {
    return LibMusicRegistry.store().trackHashes[index];
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  function _validateRegistration(LibMusicRegistry.Storage storage rs, TrackRegistration calldata reg) private view {
    require(reg.contentHash != bytes32(0), 'MusicRegistry: invalid hash');
    require(bytes(reg.title).length > 0, 'MusicRegistry: missing title');
    require(bytes(reg.artistName).length > 0, 'MusicRegistry: missing artist name');
    require(bytes(reg.description).length > 0, 'MusicRegistry: missing description');
    require(bytes(reg.imageRef).length > 0, 'MusicRegistry: missing image ref');
    require(bytes(reg.audioRef).length > 0, 'MusicRegistry: missing audio ref');
    require(bytes(reg.metadataRef).length > 0, 'MusicRegistry: missing metadata ref');
    require(bytes(reg.artistContractRef).length > 0, 'MusicRegistry: missing artist contract ref');
    require(rs.tracks[reg.contentHash].artist == address(0), 'MusicRegistry: already registered');
    _validateAccessPolicy(reg.accessMode, reg.pricePlanck, reg.requiredPersonhood);
  }

  /// @dev Mode-specific policy validation, shared by registration and mode
  ///      changes. Free has no requirements: no price, no personhood.
  function _validateAccessPolicy(
    LibMusicRegistry.AccessMode accessMode,
    uint128 pricePlanck,
    LibMusicRegistry.PersonhoodLevel requiredPersonhood
  ) private pure {
    if (accessMode == LibMusicRegistry.AccessMode.Classic) {
      require(pricePlanck > 0, 'MusicRegistry: Classic requires price');
    } else if (accessMode == LibMusicRegistry.AccessMode.HumanFree) {
      require(requiredPersonhood != LibMusicRegistry.PersonhoodLevel.None, 'MusicRegistry: HumanFree requires personhood level');
    }
    // Free: nothing to validate.
  }
}
