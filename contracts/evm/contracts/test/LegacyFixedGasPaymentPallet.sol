// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

import { LibMusicRegistry } from '../libraries/LibMusicRegistry.sol';
import { LibMusicRoyalties } from '../libraries/LibMusicRoyalties.sol';
import { LibMusicAccess } from '../libraries/LibMusicAccess.sol';
import { LibReentrancyGuard } from '../libraries/LibReentrancyGuard.sol';

/// @dev Migration fixture for the old 100k payment/claim behavior. Intentionally
/// supports one 100% split only; never deployed by the factory or upgrade tools.
contract LegacyFixedGasPaymentPallet {
  event MusicRoyAccessPaid(bytes32 indexed contentHash, address indexed listener, uint256 amount);
  event MusicRoyRoyaltyPaid(bytes32 indexed contentHash, address indexed listener, address indexed recipient, uint256 amount);
  event MusicRoyRoyaltyClaimable(bytes32 indexed contentHash, address indexed listener, address indexed recipient, uint256 amount, uint256 pendingTotal);
  event MusicRoyRoyaltyClaimed(address indexed recipient, uint256 amount);
  event MusicRoyRoyaltyClaimFailed(address indexed recipient, uint256 amount);

  function musicRoyPayAccess(bytes32 contentHash) external payable {
    LibReentrancyGuard.enter();
    LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
    LibMusicRegistry.requireExists(rs, contentHash);
    LibMusicRegistry.requireActive(rs, contentHash);
    LibMusicRegistry.TrackRecord storage track = rs.tracks[contentHash];
    require(track.accessMode == LibMusicRegistry.AccessMode.Classic, 'fixture: Classic only');
    require(msg.value == track.pricePlanck, 'fixture: exact payment');
    LibMusicRoyalties.Storage storage royalties = LibMusicRoyalties.store();
    require(royalties.splits[contentHash].length == 1 && royalties.splits[contentHash][0].bps == 10_000, 'fixture: one split');
    require(!LibMusicAccess.store().paidAccess[contentHash][msg.sender], 'fixture: already paid');
    LibMusicAccess.store().paidAccess[contentHash][msg.sender] = true;
    address recipient = royalties.splits[contentHash][0].recipient;
    (bool paid, ) = payable(recipient).call{ value: msg.value, gas: 100_000 }('');
    if (paid) emit MusicRoyRoyaltyPaid(contentHash, msg.sender, recipient, msg.value);
    else {
      uint256 pending = LibMusicRoyalties.addClaimable(royalties, recipient, msg.value);
      emit MusicRoyRoyaltyClaimable(contentHash, msg.sender, recipient, msg.value, pending);
    }
    emit MusicRoyAccessPaid(contentHash, msg.sender, msg.value);
    LibReentrancyGuard.exit();
  }

  function musicRoyClaimable(address recipient) external view returns (uint256) {
    return LibMusicRoyalties.store().claimable[recipient];
  }

  function musicRoyClaim(address recipient) external returns (uint256 amount, bool settled) {
    require(msg.sender == recipient, 'fixture: self only');
    LibReentrancyGuard.enter();
    amount = LibMusicRoyalties.takeClaimable(LibMusicRoyalties.store(), recipient);
    require(amount > 0, 'fixture: nothing to claim');
    (settled, ) = payable(recipient).call{ value: amount, gas: 100_000 }('');
    if (settled) emit MusicRoyRoyaltyClaimed(recipient, amount);
    else {
      LibMusicRoyalties.restoreClaimable(LibMusicRoyalties.store(), recipient, amount);
      emit MusicRoyRoyaltyClaimFailed(recipient, amount);
    }
    LibReentrancyGuard.exit();
  }
}
