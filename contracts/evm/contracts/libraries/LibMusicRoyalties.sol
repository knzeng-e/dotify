// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title LibMusicRoyalties
/// @notice Namespaced storage for per-track royalty split configurations.
///         Splits are written at registration and are immutable thereafter.
///
/// Storage slot: keccak256("smart.runtime.pallet.music-royalties.storage")
library LibMusicRoyalties {
    bytes32 constant STORAGE_POSITION =
        keccak256("smart.runtime.pallet.music-royalties.storage");

    struct RoyaltySplit {
        address recipient;
        uint16 bps; // basis points; sum across all splits ≤ 10_000
    }

    struct Storage {
        mapping(bytes32 => RoyaltySplit[]) splits; // contentHash → splits
    }

    function store() internal pure returns (Storage storage s) {
        bytes32 pos = STORAGE_POSITION;
        assembly { s.slot := pos }
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /// @dev Writes splits and returns total bps. Reverts on any validation failure.
    function storeSplits(
        Storage storage s,
        bytes32 contentHash,
        address[] calldata recipients,
        uint16[] calldata bps
    ) internal returns (uint16 totalBps) {
        require(recipients.length > 0, "MusicRoyalties: no splits");
        require(recipients.length == bps.length, "MusicRoyalties: length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "MusicRoyalties: zero recipient");
            require(bps[i] > 0, "MusicRoyalties: zero bps");
            totalBps += bps[i];
            require(totalBps <= 10_000, "MusicRoyalties: bps overflow");
            s.splits[contentHash].push(RoyaltySplit({ recipient: recipients[i], bps: bps[i] }));
        }
    }

    /// @dev Distributes `amount` across splits; remainder goes to `artist`.
    function distribute(
        Storage storage s,
        bytes32 contentHash,
        address artist,
        uint256 amount
    ) internal {
        RoyaltySplit[] storage sp = s.splits[contentHash];
        uint256 distributed;
        for (uint256 i = 0; i < sp.length; i++) {
            uint256 share = (amount * sp[i].bps) / 10_000;
            distributed += share;
            _send(sp[i].recipient, share);
        }
        if (amount > distributed) {
            _send(artist, amount - distributed);
        }
    }

    function _send(address recipient, uint256 amount) private {
        if (amount == 0) return;
        (bool ok,) = payable(recipient).call{value: amount}("");
        require(ok, "MusicRoyalties: transfer failed");
    }
}
