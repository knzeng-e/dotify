// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

import { LibMusicRegistry } from '../libraries/LibMusicRegistry.sol';

/// @notice Artist corrections to an existing work's public presentation.
/// Install as an additive diamond facet; keep the audited registration facet.
contract MusicMetadataPallet {
  event TrackMetadataUpdated(bytes32 indexed contentHash, address indexed artist, string metadataRef);

  function musicRegUpdateMetadata(
    bytes32 contentHash,
    string calldata title,
    string calldata description,
    string calldata metadataRef,
    string calldata expectedMetadataRef
  ) external {
    LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
    LibMusicRegistry.requireExists(rs, contentHash);
    LibMusicRegistry.TrackRecord storage track = rs.tracks[contentHash];
    require(track.artist == msg.sender, 'MusicRegistry: not artist');
    require(bytes(title).length > 0 && bytes(title).length <= 800, 'MusicRegistry: invalid title');
    require(bytes(description).length <= 8000, 'MusicRegistry: story too long');
    require(bytes(metadataRef).length > 0 && bytes(metadataRef).length <= 512, 'MusicRegistry: invalid metadata');
    require(keccak256(bytes(track.metadataRef)) == keccak256(bytes(expectedMetadataRef)), 'MusicRegistry: metadata changed');
    track.title = title;
    track.description = description;
    track.metadataRef = metadataRef;
    emit TrackMetadataUpdated(contentHash, msg.sender, metadataRef);
  }
}
