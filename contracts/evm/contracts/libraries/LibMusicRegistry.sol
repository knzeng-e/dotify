// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title LibMusicRegistry
/// @notice Namespaced storage and shared types for the music rights registry pallets.
///
/// Storage slot: keccak256("smart.runtime.pallet.music-registry.storage")
library LibMusicRegistry {
    bytes32 constant STORAGE_POSITION =
        keccak256("smart.runtime.pallet.music-registry.storage");

    // -------------------------------------------------------------------------
    // Shared domain enums (used by all four music pallets)
    // -------------------------------------------------------------------------

    enum AccessMode {
        HumanFree, // 0 — gated by proof-of-personhood, free to listen
        Classic    // 1 — gated by on-chain payment
    }

    enum PersonhoodLevel {
        None, // 0 — no verification
        DIM1, // 1 — DIM1 Individuality Chain verification
        DIM2  // 2 — DIM2 Individuality Chain verification (stronger)
    }

    // -------------------------------------------------------------------------
    // Storage structs
    // -------------------------------------------------------------------------

    struct TrackRecord {
        address artist;              // original registrant / rights holder
        uint256 tokenId;             // corresponding NFT id
        string title;
        string artistName;
        string description;
        string imageRef;             // URI (ipfs://, seed://, dotify:local:, ...)
        string audioRef;
        string metadataRef;          // Bulletin Chain JSON manifest reference
        string artistContractRef;    // artist contract document reference
        uint16 royaltyBps;           // total bps across all royalty splits
        AccessMode accessMode;
        uint128 pricePlanck;         // 0 for HumanFree
        PersonhoodLevel requiredPersonhood; // None for Classic
        uint64 registeredAtBlock;
        bool active;
    }

    struct Storage {
        mapping(bytes32 => TrackRecord) tracks;        // contentHash → record
        mapping(uint256 => bytes32) tokenIdToHash;     // tokenId → contentHash
        bytes32[] trackHashes;                         // ordered enumeration
        uint256 nextTokenId;                           // auto-increments; starts at 1
    }

    function store() internal pure returns (Storage storage s) {
        bytes32 pos = STORAGE_POSITION;
        assembly { s.slot := pos }
    }

    // -------------------------------------------------------------------------
    // Internal helpers reused by multiple pallets
    // -------------------------------------------------------------------------

    function requireExists(Storage storage s, bytes32 contentHash) internal view {
        require(s.tracks[contentHash].artist != address(0), "MusicRegistry: track not found");
    }

    function requireActive(Storage storage s, bytes32 contentHash) internal view {
        require(s.tracks[contentHash].active, "MusicRegistry: track inactive");
    }
}
