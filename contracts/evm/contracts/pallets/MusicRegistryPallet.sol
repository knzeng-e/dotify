// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

import { LibMusicBounds } from '../libraries/LibMusicBounds.sol';
import { LibRuntimeArtist } from '../libraries/LibRuntimeArtist.sol';
import { LibMusicRegistry } from '../libraries/LibMusicRegistry.sol';
import { LibNativePrice } from '../libraries/LibNativePrice.sol';
import { LibMusicRoyalties } from '../libraries/LibMusicRoyalties.sol';

/// @title MusicRegistryPallet
/// @notice Smart Pallet for registering and deactivating music tracks on the
///         Dotify rights registry. Registration binds the original artist and
///         fixes royalty splits without creating a transferable token.
///
///         Storage: LibMusicRegistry, LibMusicRoyalties
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

  /// @notice Register a new music track and its artist-controlled access policy.
  /// @param reg  Track metadata and access configuration.
  /// @param recipients  Royalty recipient addresses (at least one required).
  /// @param bps         Basis points for each recipient; must sum to ≤ 10 000.
  function musicRegRegister(TrackRegistration calldata reg, address[] calldata recipients, uint16[] calldata bps) external {
    LibRuntimeArtist.enforceArtist();

    LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
    _validateRegistration(rs, reg);

    uint16 totalBps = LibMusicRoyalties.storeSplits(LibMusicRoyalties.store(), reg.contentHash, recipients, bps);

    rs.trackHashes.push(reg.contentHash);

    LibMusicRegistry.TrackRecord storage track = rs.tracks[reg.contentHash];
    track.artist = msg.sender;
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

    emit TrackRegistered(reg.contentHash, msg.sender, reg.title, reg.accessMode, track.pricePlanck, track.requiredPersonhood);
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

  function musicRegGetTrack(bytes32 contentHash) external view returns (LibMusicRegistry.TrackRecord memory track) {
    LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
    LibMusicRegistry.requireExists(rs, contentHash);
    return rs.tracks[contentHash];
  }

  /// @notice Native Balance decimals for exact Classic publication/payment values.
  function musicRegNativeDecimals() external view returns (uint8) {
    return LibNativePrice.nativeDecimals();
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

  /// @notice Registration-order page, including inactive tracks. At most 100 hashes.
  /// Out-of-range offsets and zero limits return an empty page; large limits clamp.
  function musicRegTrackHashesPage(uint256 offset, uint256 limit) external view returns (bytes32[] memory hashes) {
    bytes32[] storage all = LibMusicRegistry.store().trackHashes;
    uint256 total = all.length;
    if (offset >= total || limit == 0) return new bytes32[](0);
    uint256 length = total - offset;
    if (length > limit) length = limit;
    if (length > LibMusicBounds.TRACK_PAGE_SIZE) length = LibMusicBounds.TRACK_PAGE_SIZE;
    hashes = new bytes32[](length);
    for (uint256 i; i < length; ++i) hashes[i] = all[offset + i];
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
    require(bytes(reg.title).length <= LibMusicBounds.TITLE_BYTES, 'MusicRegistry: title too long');
    require(bytes(reg.artistName).length <= LibMusicBounds.ARTIST_BYTES, 'MusicRegistry: artistName too long');
    require(bytes(reg.description).length <= LibMusicBounds.DESCRIPTION_BYTES, 'MusicRegistry: description too long');
    require(bytes(reg.imageRef).length <= LibMusicBounds.REFERENCE_BYTES, 'MusicRegistry: imageRef too long');
    require(bytes(reg.audioRef).length <= LibMusicBounds.REFERENCE_BYTES, 'MusicRegistry: audioRef too long');
    require(bytes(reg.metadataRef).length <= LibMusicBounds.REFERENCE_BYTES, 'MusicRegistry: metadataRef too long');
    require(bytes(reg.artistContractRef).length <= LibMusicBounds.REFERENCE_BYTES, 'MusicRegistry: artistContractRef too long');
    require(rs.tracks[reg.contentHash].artist == address(0), 'MusicRegistry: already registered');
    _validateAccessPolicy(reg.accessMode, reg.pricePlanck, reg.requiredPersonhood);
  }

  /// @dev Mode-specific policy validation, shared by registration and mode
  ///      changes. Free has no requirements: no price, no personhood.
  function _validateAccessPolicy(
    LibMusicRegistry.AccessMode accessMode,
    uint128 pricePlanck,
    LibMusicRegistry.PersonhoodLevel requiredPersonhood
  ) private view {
    if (accessMode == LibMusicRegistry.AccessMode.Classic) {
      require(pricePlanck > 0, 'MusicRegistry: Classic requires price');
      LibNativePrice.validate(pricePlanck);
    } else if (accessMode == LibMusicRegistry.AccessMode.HumanFree) {
      require(requiredPersonhood != LibMusicRegistry.PersonhoodLevel.None, 'MusicRegistry: HumanFree requires personhood level');
    }
    // Free: nothing to validate.
  }
}
