// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { LibMusicNFT } from "../libraries/LibMusicNFT.sol";
import { LibMusicRegistry } from "../libraries/LibMusicRegistry.sol";
import { LibMusicAccess } from "../libraries/LibMusicAccess.sol";

/// @title MusicNFTPallet
/// @notice Smart Pallet for music track NFT ownership management.
///         Each token ID corresponds to a registered track and represents the
///         artist's rights deed.  Transferring the NFT transfers control rights;
///         the original `artist` field in the track record is immutable.
///
///         HumanFree tracks gate transfers: the recipient must meet the track's
///         required personhood level before the NFT can be sent to them.
///
///         Storage: LibMusicNFT (owns), LibMusicRegistry (reads), LibMusicAccess (reads)
///         Prefix:  musicNFT — avoids selector collisions with other pallets
contract MusicNFTPallet {
    // -------------------------------------------------------------------------
    // Events (ERC-721 compatible, emitted on SmartRuntime address)
    // -------------------------------------------------------------------------

    event MusicNFTTransfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event MusicNFTApproval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event MusicNFTApprovalForAll(address indexed owner, address indexed operator, bool approved);

    // -------------------------------------------------------------------------
    // Write functions
    // -------------------------------------------------------------------------

    /// @notice Transfer a music track NFT to another address.
    ///         For HumanFree tracks the recipient must meet the required personhood level.
    function musicNFTTransfer(uint256 tokenId, address to) external {
        LibMusicNFT.Storage storage ns = LibMusicNFT.store();
        require(LibMusicNFT.isApprovedOrOwner(ns, msg.sender, tokenId), "MusicNFT: not owner or approved");
        require(to != address(0), "MusicNFT: invalid recipient");

        LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
        bytes32 contentHash = rs.tokenIdToHash[tokenId];
        require(contentHash != bytes32(0), "MusicNFT: token has no track");
        LibMusicRegistry.requireActive(rs, contentHash);

        LibMusicRegistry.TrackRecord storage track = rs.tracks[contentHash];
        if (track.accessMode == LibMusicRegistry.AccessMode.HumanFree) {
            require(
                LibMusicAccess.hasRequiredPersonhood(LibMusicAccess.store(), to, track.requiredPersonhood),
                "MusicNFT: recipient lacks required personhood"
            );
        }

        address from = ns.ownerOf[tokenId];
        ns.tokenApprovals[tokenId] = address(0);
        ns.ownerOf[tokenId] = to;
        ns.balanceOf[from] -= 1;
        ns.balanceOf[to] += 1;

        emit MusicNFTTransfer(from, to, tokenId);
    }

    /// @notice Approve `to` to transfer `tokenId` on the caller's behalf.
    function musicNFTApprove(address to, uint256 tokenId) external {
        LibMusicNFT.Storage storage ns = LibMusicNFT.store();
        address owner = ns.ownerOf[tokenId];
        require(
            msg.sender == owner || ns.operatorApprovals[owner][msg.sender],
            "MusicNFT: not owner or operator"
        );
        ns.tokenApprovals[tokenId] = to;
        emit MusicNFTApproval(owner, to, tokenId);
    }

    /// @notice Grant or revoke `operator` the right to transfer any of the caller's tokens.
    function musicNFTSetApprovalForAll(address operator, bool approved) external {
        require(operator != address(0), "MusicNFT: invalid operator");
        LibMusicNFT.store().operatorApprovals[msg.sender][operator] = approved;
        emit MusicNFTApprovalForAll(msg.sender, operator, approved);
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    function musicNFTOwnerOf(uint256 tokenId) external view returns (address) {
        address owner = LibMusicNFT.store().ownerOf[tokenId];
        require(owner != address(0), "MusicNFT: nonexistent token");
        return owner;
    }

    function musicNFTBalanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "MusicNFT: zero address");
        return LibMusicNFT.store().balanceOf[owner];
    }

    function musicNFTGetApproved(uint256 tokenId) external view returns (address) {
        return LibMusicNFT.store().tokenApprovals[tokenId];
    }

    function musicNFTIsApprovedForAll(address owner, address operator) external view returns (bool) {
        return LibMusicNFT.store().operatorApprovals[owner][operator];
    }
}
