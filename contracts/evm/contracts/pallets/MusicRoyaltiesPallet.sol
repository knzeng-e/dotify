// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { LibMusicRegistry } from "../libraries/LibMusicRegistry.sol";
import { LibMusicRoyalties } from "../libraries/LibMusicRoyalties.sol";
import { LibMusicAccess } from "../libraries/LibMusicAccess.sol";
import { LibMusicNFT } from "../libraries/LibMusicNFT.sol";

/// @title MusicRoyaltiesPallet
/// @notice Smart Pallet for on-chain payment collection and royalty distribution.
///
///         Classic tracks: listeners call `musicRoyPayAccess` with the track price
///         in native currency.  Payment is immediately split across all royalty
///         recipients according to their basis-point allocation; any rounding
///         remainder goes to the original artist.
///
///         HumanFree tracks: no payment required, but the pallet exposes
///         `musicRoyRecordListen` as an on-chain analytics hook — it verifies the
///         caller's personhood level and emits an event without charging anything.
///
///         Storage: LibMusicRoyalties (owns), LibMusicRegistry (reads),
///                  LibMusicAccess (writes paidAccess), LibMusicNFT (reads owner)
///         Prefix:  musicRoy — avoids selector collisions with other pallets
contract MusicRoyaltiesPallet {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event MusicRoyAccessPaid(
        bytes32 indexed contentHash,
        address indexed listener,
        uint256 amount
    );

    event MusicRoyListenRecorded(
        bytes32 indexed contentHash,
        address indexed listener,
        LibMusicRegistry.PersonhoodLevel requiredPersonhood
    );

    // -------------------------------------------------------------------------
    // Write functions
    // -------------------------------------------------------------------------

    /// @notice Pay for access to a Classic track.
    ///         `msg.value` must be >= `track.pricePlanck`.
    ///         Payment is immediately distributed to royalty recipients.
    function musicRoyPayAccess(bytes32 contentHash) external payable {
        LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
        LibMusicRegistry.requireExists(rs, contentHash);
        LibMusicRegistry.requireActive(rs, contentHash);

        LibMusicRegistry.TrackRecord storage track = rs.tracks[contentHash];
        require(
            track.accessMode == LibMusicRegistry.AccessMode.Classic,
            "MusicRoyalties: not a Classic track"
        );
        require(msg.value >= track.pricePlanck, "MusicRoyalties: insufficient payment");

        LibMusicAccess.store().paidAccess[contentHash][msg.sender] = true;

        LibMusicRoyalties.distribute(LibMusicRoyalties.store(), contentHash, track.artist, msg.value);

        emit MusicRoyAccessPaid(contentHash, msg.sender, msg.value);
    }

    /// @notice Record a listen event for a HumanFree track (analytics; no charge).
    ///         Reverts if the caller does not hold the required personhood level.
    function musicRoyRecordListen(bytes32 contentHash) external {
        LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
        LibMusicRegistry.requireExists(rs, contentHash);
        LibMusicRegistry.requireActive(rs, contentHash);

        LibMusicRegistry.TrackRecord storage track = rs.tracks[contentHash];
        require(
            track.accessMode == LibMusicRegistry.AccessMode.HumanFree,
            "MusicRoyalties: not a HumanFree track"
        );
        require(
            LibMusicAccess.hasRequiredPersonhood(LibMusicAccess.store(), msg.sender, track.requiredPersonhood),
            "MusicRoyalties: personhood required"
        );

        emit MusicRoyListenRecorded(contentHash, msg.sender, track.requiredPersonhood);
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    function musicRoySplitCount(bytes32 contentHash) external view returns (uint256) {
        return LibMusicRoyalties.store().splits[contentHash].length;
    }

    function musicRoySplitAt(bytes32 contentHash, uint256 index)
        external view
        returns (address recipient, uint16 bps)
    {
        LibMusicRoyalties.RoyaltySplit storage split = LibMusicRoyalties.store().splits[contentHash][index];
        return (split.recipient, split.bps);
    }

    /// @notice Sum of all basis points across the track's royalty splits.
    function musicRoyTotalBps(bytes32 contentHash) external view returns (uint16 total) {
        LibMusicRoyalties.RoyaltySplit[] storage sp = LibMusicRoyalties.store().splits[contentHash];
        for (uint256 i = 0; i < sp.length; i++) {
            total += sp[i].bps;
        }
    }
}
