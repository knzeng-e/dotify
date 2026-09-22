// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

import { LibMusicRegistry } from '../libraries/LibMusicRegistry.sol';
import { LibMusicRoyalties } from '../libraries/LibMusicRoyalties.sol';
import { LibMusicAccess } from '../libraries/LibMusicAccess.sol';
import { LibMusicNFT } from '../libraries/LibMusicNFT.sol';
import { LibReentrancyGuard } from '../libraries/LibReentrancyGuard.sol';

/// @title MusicRoyaltiesPallet
/// @notice Smart Pallet for on-chain payment collection and royalty distribution.
///
///         Classic tracks: listeners call `musicRoyPayAccess` with the track price
///         in native currency. Payment is settled across all royalty recipients
///         according to their basis-point allocation; any rounding remainder goes
///         to the original artist. Immediate native transfers are gas-bounded. If
///         a recipient cannot receive its share in the payment transaction, that
///         share becomes claimable instead of reverting the listener's purchase.
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

  event MusicRoyAccessPaid(bytes32 indexed contentHash, address indexed listener, uint256 amount);

  event MusicRoyRoyaltyPaid(bytes32 indexed contentHash, address indexed listener, address indexed recipient, uint256 amount);

  event MusicRoyRoyaltyPayoutFailed(bytes32 indexed contentHash, address indexed listener, address indexed recipient, uint256 amount);

  event MusicRoyRoyaltyClaimable(bytes32 indexed contentHash, address indexed listener, address indexed recipient, uint256 amount, uint256 pendingTotal);

  event MusicRoyRoyaltyClaimed(address indexed recipient, uint256 amount);

  event MusicRoyRoyaltyClaimFailed(address indexed recipient, uint256 amount);

  event MusicRoyRefunded(bytes32 indexed contentHash, address indexed listener, uint256 amount);

  event MusicRoyListenRecorded(bytes32 indexed contentHash, address indexed listener, LibMusicRegistry.PersonhoodLevel requiredPersonhood);

  // -------------------------------------------------------------------------
  // Reentrancy guard
  // -------------------------------------------------------------------------

  /// @dev Cross-pallet reentrancy lock backed by LibReentrancyGuard's namespaced
  ///      diamond storage slot. Guards every ETH-sending external entry point so a
  ///      malicious royalty recipient cannot re-enter mid-distribution.
  modifier nonReentrant() {
    LibReentrancyGuard.enter();
    _;
    LibReentrancyGuard.exit();
  }

  // -------------------------------------------------------------------------
  // Write functions
  // -------------------------------------------------------------------------

  /// @notice Pay for access to a Classic track.
  ///         `msg.value` must be >= `track.pricePlanck`. Exactly `pricePlanck`
  ///         is distributed to royalty recipients; any excess is refunded to the
  ///         caller. Reverts if the caller already holds paid access.
  function musicRoyPayAccess(bytes32 contentHash) external payable nonReentrant {
    LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
    LibMusicRegistry.requireExists(rs, contentHash);
    LibMusicRegistry.requireActive(rs, contentHash);

    LibMusicRegistry.TrackRecord storage track = rs.tracks[contentHash];
    require(track.accessMode == LibMusicRegistry.AccessMode.Classic, 'MusicRoyalties: not a Classic track');

    LibMusicAccess.Storage storage accessStore = LibMusicAccess.store();
    require(!accessStore.paidAccess[contentHash][msg.sender], 'MusicRoyalties: already paid');

    uint256 price = track.pricePlanck;
    require(msg.value >= price, 'MusicRoyalties: insufficient payment');

    accessStore.paidAccess[contentHash][msg.sender] = true;

    // Settle exactly the track price; refund any overpayment.
    _settleRoyalties(contentHash, msg.sender, track.artist, price);

    uint256 refund = msg.value - price;
    if (refund > 0) {
      bool refunded = LibMusicRoyalties.trySendNative(msg.sender, refund);
      require(refunded, 'MusicRoyalties: refund failed');
      emit MusicRoyRefunded(contentHash, msg.sender, refund);
    }

    emit MusicRoyAccessPaid(contentHash, msg.sender, price);
  }

  /// @notice Native-token royalty amount currently waiting for `recipient` to claim.
  function musicRoyClaimable(address recipient) external view returns (uint256) {
    return LibMusicRoyalties.store().claimable[recipient];
  }

  /// @notice Claim pending native-token royalties for the caller.
  /// @dev The recipient argument is intentional: it makes the authorization check
  ///      explicit in receipts and prevents a caller from draining someone else's
  ///      pending balance through a helper contract. A failed transfer is recorded
  ///      and left claimable; the transaction itself does not revert.
  function musicRoyClaim(address recipient) external nonReentrant returns (uint256 amount, bool settled) {
    require(recipient == msg.sender, 'MusicRoyalties: claim self only');

    LibMusicRoyalties.Storage storage royaltyStore = LibMusicRoyalties.store();
    amount = LibMusicRoyalties.takeClaimable(royaltyStore, recipient);
    require(amount > 0, 'MusicRoyalties: nothing to claim');

    settled = LibMusicRoyalties.trySendNative(recipient, amount);
    if (settled) {
      emit MusicRoyRoyaltyClaimed(recipient, amount);
      return (amount, true);
    }

    LibMusicRoyalties.restoreClaimable(royaltyStore, recipient, amount);
    emit MusicRoyRoyaltyClaimFailed(recipient, amount);
    return (amount, false);
  }

  /// @notice Record a listen event for a HumanFree track (analytics; no charge).
  ///         Reverts if the caller does not hold the required personhood level.
  function musicRoyRecordListen(bytes32 contentHash) external {
    LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
    LibMusicRegistry.requireExists(rs, contentHash);
    LibMusicRegistry.requireActive(rs, contentHash);

    LibMusicRegistry.TrackRecord storage track = rs.tracks[contentHash];
    require(track.accessMode == LibMusicRegistry.AccessMode.HumanFree, 'MusicRoyalties: not a HumanFree track');
    require(LibMusicAccess.hasRequiredPersonhood(LibMusicAccess.store(), msg.sender, track.requiredPersonhood), 'MusicRoyalties: personhood required');

    emit MusicRoyListenRecorded(contentHash, msg.sender, track.requiredPersonhood);
  }

  // -------------------------------------------------------------------------
  // View functions
  // -------------------------------------------------------------------------

  function musicRoySplitCount(bytes32 contentHash) external view returns (uint256) {
    return LibMusicRoyalties.store().splits[contentHash].length;
  }

  function musicRoySplitAt(bytes32 contentHash, uint256 index) external view returns (address recipient, uint16 bps) {
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

  function _settleRoyalties(bytes32 contentHash, address listener, address artist, uint256 amount) private {
    LibMusicRoyalties.Storage storage royaltyStore = LibMusicRoyalties.store();
    LibMusicRoyalties.RoyaltySplit[] storage sp = royaltyStore.splits[contentHash];
    uint256 distributed;

    for (uint256 i = 0; i < sp.length; i++) {
      uint256 share = (amount * sp[i].bps) / 10_000;
      distributed += share;
      _settleRoyaltyShare(royaltyStore, contentHash, listener, sp[i].recipient, share);
    }

    if (amount > distributed) {
      _settleRoyaltyShare(royaltyStore, contentHash, listener, artist, amount - distributed);
    }
  }

  function _settleRoyaltyShare(
    LibMusicRoyalties.Storage storage royaltyStore,
    bytes32 contentHash,
    address listener,
    address recipient,
    uint256 amount
  ) private {
    if (amount == 0) return;

    if (LibMusicRoyalties.trySendNative(recipient, amount)) {
      emit MusicRoyRoyaltyPaid(contentHash, listener, recipient, amount);
      return;
    }

    uint256 pendingTotal = LibMusicRoyalties.addClaimable(royaltyStore, recipient, amount);
    emit MusicRoyRoyaltyPayoutFailed(contentHash, listener, recipient, amount);
    emit MusicRoyRoyaltyClaimable(contentHash, listener, recipient, amount, pendingTotal);
  }
}
