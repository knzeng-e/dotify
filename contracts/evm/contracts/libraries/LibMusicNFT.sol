// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title LibMusicNFT
/// @notice Namespaced storage for music track NFT ownership.
///         Each track token represents the original artist's rights deed.
///
/// Storage slot: keccak256("smart.runtime.pallet.music-nft.storage")
library LibMusicNFT {
    bytes32 constant STORAGE_POSITION =
        keccak256("smart.runtime.pallet.music-nft.storage");

    struct Storage {
        mapping(uint256 => address) ownerOf;
        mapping(address => uint256) balanceOf;
        mapping(uint256 => address) tokenApprovals;
        mapping(address => mapping(address => bool)) operatorApprovals;
    }

    function store() internal pure returns (Storage storage s) {
        bytes32 pos = STORAGE_POSITION;
        assembly { s.slot := pos }
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function mint(Storage storage s, address to, uint256 tokenId) internal {
        require(s.ownerOf[tokenId] == address(0), "MusicNFT: token already minted");
        s.ownerOf[tokenId] = to;
        s.balanceOf[to] += 1;
    }

    function isApprovedOrOwner(Storage storage s, address spender, uint256 tokenId) internal view returns (bool) {
        address owner = s.ownerOf[tokenId];
        return spender == owner
            || s.tokenApprovals[tokenId] == spender
            || s.operatorApprovals[owner][spender];
    }
}
