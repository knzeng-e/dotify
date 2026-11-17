// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

import { LibMusicBounds } from './LibMusicBounds.sol';

/// @title LibMusicRoyalties
/// @notice Namespaced storage for per-track royalty split configurations.
///         Splits are written at registration and are immutable thereafter.
///
/// Storage slot: keccak256("smart.runtime.pallet.music-royalties.storage")
library LibMusicRoyalties {
  bytes32 constant STORAGE_POSITION = keccak256('smart.runtime.pallet.music-royalties.storage');
  uint256 internal constant NATIVE_TRANSFER_GAS_LIMIT = 100_000;

  struct RoyaltySplit {
    address recipient;
    uint16 bps; // basis points; sum across all splits ≤ 10_000
  }

  struct Storage {
    mapping(bytes32 => RoyaltySplit[]) splits; // contentHash → splits
    mapping(address => uint256) claimable; // recipient → pending native-token amount
  }

  function store() internal pure returns (Storage storage s) {
    bytes32 pos = STORAGE_POSITION;
    assembly {
      s.slot := pos
    }
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /// @dev Writes splits and returns total bps. Reverts on any validation failure.
  function storeSplits(Storage storage s, bytes32 contentHash, address[] calldata recipients, uint16[] calldata bps) internal returns (uint16 totalBps) {
    uint256 recipientCount = recipients.length;
    require(recipientCount <= LibMusicBounds.SPLIT_RECIPIENTS, 'MusicRoyalties: too many recipients');
    require(recipientCount > 0, 'MusicRoyalties: no splits');
    require(recipientCount == bps.length, 'MusicRoyalties: length mismatch');
    RoyaltySplit[] storage splits = s.splits[contentHash];
    for (uint256 i; i < recipientCount; ++i) {
      require(recipients[i] != address(0), 'MusicRoyalties: zero recipient');
      require(bps[i] > 0, 'MusicRoyalties: zero bps');
      totalBps += bps[i];
      require(totalBps <= 10_000, 'MusicRoyalties: bps overflow');
      splits.push(RoyaltySplit({ recipient: recipients[i], bps: bps[i] }));
    }
  }

  function trySendNative(address recipient, uint256 amount) internal returns (bool) {
    if (amount == 0) return true;
    (bool ok, ) = payable(recipient).call{ value: amount, gas: NATIVE_TRANSFER_GAS_LIMIT }('');
    return ok;
  }

  function addClaimable(Storage storage s, address recipient, uint256 amount) internal returns (uint256 pendingTotal) {
    if (amount == 0) return s.claimable[recipient];
    pendingTotal = s.claimable[recipient] + amount;
    s.claimable[recipient] = pendingTotal;
  }

  function takeClaimable(Storage storage s, address recipient) internal returns (uint256 amount) {
    amount = s.claimable[recipient];
    if (amount > 0) {
      s.claimable[recipient] = 0;
    }
  }

  function restoreClaimable(Storage storage s, address recipient, uint256 amount) internal returns (uint256 pendingTotal) {
    if (amount == 0) return s.claimable[recipient];
    pendingTotal = s.claimable[recipient] + amount;
    s.claimable[recipient] = pendingTotal;
  }
}
