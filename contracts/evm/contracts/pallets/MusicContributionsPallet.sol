// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

import { LibMusicContributions as C } from '../libraries/LibMusicContributions.sol';
import { LibMusicRegistry } from '../libraries/LibMusicRegistry.sol';
import { LibMusicRoyalties } from '../libraries/LibMusicRoyalties.sol';
import { LibDiamond } from '../libraries/LibDiamond.sol';
import { LibReentrancyGuard } from '../libraries/LibReentrancyGuard.sol';

/// @notice Voluntary contributions never write listening entitlements.
contract MusicContributionsPallet {
  error ContributionArtistOnly();
  error ContributionPolicyChanged();
  error ContributionInvalidHostShare();
  error ContributionInvalidDates();
  error ContributionDescriptionTooLong();
  error ContributionInvalidRecipients();
  error ContributionInvalidRecipient(uint256 index);
  error ContributionInvalidShares();
  error ContributionInvalidAmount();
  error ContributionRoomUnavailable();
  error ContributionHostWithoutRoom();
  error ContributionAlreadySubmitted();
  error ContributionQuoteExpired();
  error ContributionDistributionChanged();
  error ContributionInvalidRoomProof();
  error ContributionUnexpectedProof();
  error ContributionNothingToClaim();
  error ContributionClaimRejected();
  error ContributionInvalidProofLength();
  error ContributionInvalidProofEncoding();
  error ContributionInvalidProofSigner();

  struct Context {
    bytes32 contentHash; // zero = personal gift, otherwise a tip
    bytes32 intentId;
    address host;
    bytes32 room;
    uint64 expiresAt;
  }
  struct Quote {
    bytes32 digest;
    bytes32 campaign;
    address attestor;
    address[] recipients;
    uint256[] amounts;
    uint8[] roles; // 0 artist/assigned cause, 1 collaborator, 2 host
  }
  event ContributionPolicy(bytes32 indexed scope, uint64 version, bytes32 campaign);
  event ContributionReceived(
    bytes32 indexed id,
    bytes32 indexed contentHash,
    address indexed sender,
    uint256 amount,
    address host,
    bytes32 room,
    bytes32 campaign,
    bytes32 policy,
    uint64 timestamp
  );
  event ContributionShare(bytes32 indexed id, address indexed recipient, uint256 amount, uint8 role, bool paid);
  event ContributionClaimed(bytes32 indexed id, address indexed recipient, uint256 amount);

  modifier contributionGuard() {
    LibReentrancyGuard.enter();
    _;
    LibReentrancyGuard.exit();
  }

  /// @notice Zero selects profile gifts; a nonzero scope must be a registered work.
  /// A registered work without a configured policy returns the default version zero.
  /// Inactive works remain readable for policy management, but cannot receive tips.
  function musicGiftPolicy(bytes32 scope) external view returns (C.Policy memory) {
    if (scope != bytes32(0)) LibMusicRegistry.requireExists(LibMusicRegistry.store(), scope);
    return C.store().policies[scope];
  }

  function musicGiftSetPolicy(bytes32 scope, C.Policy calldata next) external {
    if (scope == bytes32(0)) LibDiamond.enforceIsContractOwner();
    else {
      LibMusicRegistry.Storage storage registry = LibMusicRegistry.store();
      LibMusicRegistry.requireExists(registry, scope);
      if (registry.tracks[scope].artist != msg.sender) revert ContributionArtistOnly();
    }
    C.Store storage contributions = C.store();
    C.Policy storage current = contributions.policies[scope];
    if (next.version != current.version) revert ContributionPolicyChanged();
    if (next.hostBps > 10000 || (scope == bytes32(0) && next.hostBps != 0)) revert ContributionInvalidHostShare();
    if (next.endsAt != 0 && next.endsAt <= next.startsAt) revert ContributionInvalidDates();
    if (bytes(next.description).length > 280) revert ContributionDescriptionTooLong();
    uint256 recipientCount = next.recipients.length;
    if (recipientCount != next.shares.length || recipientCount > 16) revert ContributionInvalidRecipients();
    uint256 total;
    for (uint256 i; i < recipientCount; ++i) {
      if (next.recipients[i] == address(0) || next.recipients[i] == address(this) || next.shares[i] == 0) revert ContributionInvalidRecipient(i);
      total += next.shares[i];
    }
    if (total > 10000) revert ContributionInvalidShares();
    uint64 version = current.version + 1;
    contributions.policies[scope] = next;
    current.version = version;
    emit ContributionPolicy(scope, version, next.campaign);
  }

  function musicGiftQuote(Context calldata context, uint256 amount) public view returns (Quote memory q) {
    if (amount == 0) revert ContributionInvalidAmount();
    C.Store storage contributions = C.store();
    C.Policy storage p = contributions.policies[context.contentHash];
    bool active = block.timestamp >= p.startsAt && (p.endsAt == 0 || block.timestamp < p.endsAt);
    address artist = LibDiamond.contractOwner();
    uint256 distributable = amount;
    LibMusicRoyalties.RoyaltySplit[] storage splits = LibMusicRoyalties.store().splits[context.contentHash];
    if (context.contentHash != bytes32(0)) {
      LibMusicRegistry.Storage storage registry = LibMusicRegistry.store();
      LibMusicRegistry.requireExists(registry, context.contentHash);
      LibMusicRegistry.requireActive(registry, context.contentHash);
      artist = registry.tracks[context.contentHash].artist;
    }
    // Splits are immutable. Inactive policy destinations cannot receive a share.
    uint256 splitCount = context.contentHash == bytes32(0) ? 0 : splits.length;
    uint256 recipientCount = active ? p.recipients.length : 0;
    uint256 capacity = splitCount + recipientCount + 2;
    q.recipients = new address[](capacity);
    q.amounts = new uint256[](capacity);
    q.roles = new uint8[](capacity);
    uint256 n;
    address authority = p.roomAttestor;
    q.attestor = authority != address(0) ? authority : contributions.policies[bytes32(0)].roomAttestor;
    if (context.room != bytes32(0)) {
      if (context.contentHash == bytes32(0) || context.host == address(0) || q.attestor == address(0)) revert ContributionRoomUnavailable();
      uint256 hostAmount = active ? (amount * p.hostBps) / 10000 : 0;
      distributable -= hostAmount;
      q.recipients[n] = context.host;
      q.amounts[n] = hostAmount;
      q.roles[n++] = 2;
    } else if (context.host != address(0)) revert ContributionHostWithoutRoom();
    uint256 artistAmount = distributable;
    if (context.contentHash != bytes32(0)) {
      for (uint256 i; i < splitCount; ++i) {
        address recipient = splits[i].recipient;
        if (recipient == artist) continue;
        uint256 share = (distributable * splits[i].bps) / 10000;
        artistAmount -= share;
        q.recipients[n] = recipient;
        q.amounts[n] = share;
        q.roles[n++] = 1;
      }
    }
    uint256 distributed;
    if (active) {
      q.campaign = p.campaign;
      for (uint256 i; i < recipientCount; ++i) {
        uint256 share = (artistAmount * p.shares[i]) / 10000;
        distributed += share;
        q.recipients[n] = p.recipients[i];
        q.amounts[n++] = share;
      }
    }
    q.recipients[n] = artist;
    q.amounts[n++] = artistAmount - distributed;
    // Trim reserved capacity, preserving the exact recipient-level quote.
    address[] memory recipients = q.recipients;
    uint256[] memory amounts = q.amounts;
    uint8[] memory roles = q.roles;
    assembly {
      mstore(recipients, n)
      mstore(amounts, n)
      mstore(roles, n)
    }
    q.digest = keccak256(abi.encode(block.chainid, address(this), context, amount, p.version, active, q.campaign, q.attestor, recipients, amounts, roles));
  }

  function musicGiftContribute(Context calldata context, bytes32 expectedQuote, bytes calldata roomProof) external payable contributionGuard {
    C.Store storage contributions = C.store();
    if (context.intentId == bytes32(0) || contributions.used[msg.sender][context.intentId]) revert ContributionAlreadySubmitted();
    if (context.expiresAt < block.timestamp || context.expiresAt > block.timestamp + 1800) revert ContributionQuoteExpired();
    Quote memory q = musicGiftQuote(context, msg.value);
    if (q.digest != expectedQuote) revert ContributionDistributionChanged();
    if (context.room != bytes32(0)) {
      bytes32 digest = keccak256(abi.encode(block.chainid, address(this), msg.sender, context, msg.value));
      if (_signer(digest, roomProof) != q.attestor) revert ContributionInvalidRoomProof();
    } else if (roomProof.length != 0) revert ContributionUnexpectedProof();
    contributions.used[msg.sender][context.intentId] = true;
    bytes32 id = keccak256(abi.encode(msg.sender, context.intentId));
    emit ContributionReceived(id, context.contentHash, msg.sender, msg.value, context.host, context.room, q.campaign, q.digest, uint64(block.timestamp));
    uint256 recipientCount = q.recipients.length;
    for (uint256 i; i < recipientCount; ++i) {
      uint256 amount = q.amounts[i];
      if (amount == 0) continue;
      address recipient = q.recipients[i];
      bool paid = LibMusicRoyalties.trySendNative(recipient, amount);
      if (!paid) contributions.pending[id][recipient] += amount;
      emit ContributionShare(id, recipient, amount, q.roles[i], paid);
    }
  }

  function musicGiftPending(bytes32 id, address recipient) external view returns (uint256) {
    return C.store().pending[id][recipient];
  }
  function musicGiftClaim(bytes32 id) external contributionGuard {
    C.Store storage contributions = C.store();
    uint256 amount = contributions.pending[id][msg.sender];
    if (amount == 0) revert ContributionNothingToClaim();
    contributions.pending[id][msg.sender] = 0;
    if (!LibMusicRoyalties.trySendNative(msg.sender, amount)) revert ContributionClaimRejected();
    emit ContributionClaimed(id, msg.sender, amount);
  }

  function _signer(bytes32 digest, bytes calldata signature) private pure returns (address signer) {
    if (signature.length != 65) revert ContributionInvalidProofLength();
    bytes32 r;
    bytes32 s;
    uint8 v;
    assembly {
      r := calldataload(signature.offset)
      s := calldataload(add(signature.offset, 32))
      v := byte(0, calldataload(add(signature.offset, 64)))
    }
    if (uint256(s) > 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0 || (v != 27 && v != 28)) revert ContributionInvalidProofEncoding();
    signer = ecrecover(keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', digest)), v, r, s);
    if (signer == address(0)) revert ContributionInvalidProofSigner();
  }
}
