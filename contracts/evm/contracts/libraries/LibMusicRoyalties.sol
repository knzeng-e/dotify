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
  // Contribution loops can include sixteen rights holders, sixteen policy
  // recipients, an artist remainder and a Room host. Each attempted push may use only a small share of the remaining
  // frame. Avoid an Ethereum-specific absolute stipend: Revive maps a nested
  // gas budget to proportional weight/deposit resources in native execution.
  uint256 internal constant TRANSFER_BUDGET_DIVISOR = 2 * (2 * LibMusicBounds.SPLIT_RECIPIENTS + 2);

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
      require(recipients[i] != address(this), 'MusicRoyalties: runtime recipient');
      require(bps[i] > 0, 'MusicRoyalties: zero bps');
      totalBps += bps[i];
      require(totalBps <= 10_000, 'MusicRoyalties: bps overflow');
      splits.push(RoyaltySplit({ recipient: recipients[i], bps: bps[i] }));
    }
  }

  function trySendNative(address recipient, uint256 amount) internal returns (bool) {
    if (amount == 0) return true;
    return sendNativeWithinBudget(recipient, amount, gasleft() / TRANSFER_BUDGET_DIVISOR);
  }

  /// @dev One self-authorized claim/refund has no later recipient loop. Give it
  /// more room while retaining half the caller frame for restoration/events.
  /// A receiver that needs more than the push budget can recover its own funds.
  function tryClaimNative(address recipient, uint256 amount) internal returns (bool) {
    if (amount == 0) return true;
    return sendNativeWithinBudget(recipient, amount, gasleft() / 2);
  }

  function sendNativeWithinBudget(address recipient, uint256 amount, uint256 budget) private returns (bool) {
    require(recipient != address(this), 'MusicRoyalties: runtime recipient');
    (bool ok, ) = payable(recipient).call{ value: amount, gas: budget }('');
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
