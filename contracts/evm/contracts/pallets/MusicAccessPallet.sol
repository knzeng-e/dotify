// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibMusicRegistry } from "../libraries/LibMusicRegistry.sol";
import { LibMusicAccess } from "../libraries/LibMusicAccess.sol";
import { LibMusicNFT } from "../libraries/LibMusicNFT.sol";

/// @title MusicAccessPallet
/// @notice Smart Pallet for access control queries and proof-of-personhood management.
///
///         Access logic:
///           1. Inactive track            → denied
///           2. Caller is artist or owner → granted (always)
///           3. HumanFree track           → granted if caller meets personhood level
///           4. Classic track             → granted if caller has paid
///
///         Personhood levels (DIM1, DIM2) are set by the personhood registrar —
///         an admin account that in production will mirror the Individuality Chain.
///         The registrar can be rotated by the SmartRuntime owner.
///
///         Storage: LibMusicAccess (owns), LibMusicRegistry (reads), LibMusicNFT (reads)
///         Prefix:  musicAcc — avoids selector collisions with other pallets
contract MusicAccessPallet {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event MusicAccPersonhoodRegistrarSet(address indexed previous, address indexed next);
    event MusicAccPersonhoodLevelSet(
        address indexed account,
        LibMusicRegistry.PersonhoodLevel level
    );

    // -------------------------------------------------------------------------
    // Admin — personhood registrar management (owner-only bootstrap)
    // -------------------------------------------------------------------------

    /// @notice Set the personhood registrar address.
    ///         Only the SmartRuntime owner can call this.
    ///         Call once after deployment; afterwards the registrar rotates itself.
    function musicAccSetRegistrar(address registrar) external {
        require(msg.sender == LibDiamond.contractOwner(), "MusicAccess: not owner");
        require(registrar != address(0), "MusicAccess: zero address");
        LibMusicAccess.Storage storage as_ = LibMusicAccess.store();
        emit MusicAccPersonhoodRegistrarSet(as_.personhoodRegistrar, registrar);
        as_.personhoodRegistrar = registrar;
    }

    /// @notice Rotate the personhood registrar.
    ///         Only the current registrar can call this.
    function musicAccRotateRegistrar(address next) external {
        LibMusicAccess.Storage storage as_ = LibMusicAccess.store();
        require(msg.sender == as_.personhoodRegistrar, "MusicAccess: not registrar");
        require(next != address(0), "MusicAccess: zero address");
        emit MusicAccPersonhoodRegistrarSet(as_.personhoodRegistrar, next);
        as_.personhoodRegistrar = next;
    }

    // -------------------------------------------------------------------------
    // Personhood level management (registrar-only)
    // -------------------------------------------------------------------------

    /// @notice Set the proof-of-personhood level for an account.
    ///         In production this would be called by an oracle reading the Individuality Chain.
    function musicAccSetPersonhoodLevel(
        address account,
        LibMusicRegistry.PersonhoodLevel level
    ) external {
        LibMusicAccess.Storage storage as_ = LibMusicAccess.store();
        require(msg.sender == as_.personhoodRegistrar, "MusicAccess: not registrar");
        require(account != address(0), "MusicAccess: zero address");
        as_.personhoodLevelOf[account] = level;
        emit MusicAccPersonhoodLevelSet(account, level);
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /// @notice Check whether `listener` is currently allowed to access `contentHash`.
    function musicAccCanAccess(bytes32 contentHash, address listener) external view returns (bool) {
        LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
        LibMusicRegistry.TrackRecord storage track = rs.tracks[contentHash];

        if (!track.active) return false;

        // Artist and current NFT owner always have access.
        if (listener == track.artist) return true;
        if (LibMusicNFT.store().ownerOf[track.tokenId] == listener) return true;

        if (track.accessMode == LibMusicRegistry.AccessMode.HumanFree) {
            return LibMusicAccess.hasRequiredPersonhood(
                LibMusicAccess.store(), listener, track.requiredPersonhood
            );
        }

        // Classic
        return LibMusicAccess.store().paidAccess[contentHash][listener];
    }

    /// @notice Returns true if `listener` has paid for access to a Classic track.
    function musicAccHasPaid(bytes32 contentHash, address listener) external view returns (bool) {
        return LibMusicAccess.store().paidAccess[contentHash][listener];
    }

    /// @notice Returns the verified personhood level for `account`.
    function musicAccPersonhoodLevel(address account)
        external view
        returns (LibMusicRegistry.PersonhoodLevel)
    {
        return LibMusicAccess.store().personhoodLevelOf[account];
    }

    /// @notice Returns true if `account` meets `required` personhood level.
    function musicAccHasPersonhood(
        address account,
        LibMusicRegistry.PersonhoodLevel required
    ) external view returns (bool) {
        return LibMusicAccess.hasRequiredPersonhood(LibMusicAccess.store(), account, required);
    }

    /// @notice Returns the current personhood registrar address.
    function musicAccGetRegistrar() external view returns (address) {
        return LibMusicAccess.store().personhoodRegistrar;
    }
}
