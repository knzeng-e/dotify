// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

import { LibMusicContributions as C } from '../libraries/LibMusicContributions.sol';
import { LibMusicRegistry } from '../libraries/LibMusicRegistry.sol';
import { LibMusicRoyalties } from '../libraries/LibMusicRoyalties.sol';
import { LibDiamond } from '../libraries/LibDiamond.sol';
import { LibReentrancyGuard } from '../libraries/LibReentrancyGuard.sol';

/// @notice Voluntary contributions never write listening entitlements.
contract MusicContributionsPallet {
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

  function musicGiftPolicy(bytes32 scope) external view returns (C.Policy memory) {
    return C.store().policies[scope];
  }

  function musicGiftSetPolicy(bytes32 scope, C.Policy calldata next) external {
    if (scope == bytes32(0)) LibDiamond.enforceIsContractOwner();
    else {
      LibMusicRegistry.requireExists(LibMusicRegistry.store(), scope);
      require(LibMusicRegistry.store().tracks[scope].artist == msg.sender, 'Contribution: artist only');
    }
    C.Policy storage current = C.store().policies[scope];
    require(next.version == current.version, 'Contribution: policy changed');
    require(next.hostBps <= 10000 && (scope != bytes32(0) || next.hostBps == 0), 'Contribution: host share');
    require(next.endsAt == 0 || next.endsAt > next.startsAt, 'Contribution: dates');
    require(bytes(next.description).length <= 280, 'Contribution: description');
    require(next.recipients.length == next.shares.length && next.recipients.length <= 16, 'Contribution: recipients');
    uint256 total;
    for (uint256 i; i < next.recipients.length; i++) {
      require(next.recipients[i] != address(0) && next.recipients[i] != address(this) && next.shares[i] > 0, 'Contribution: recipient');
      total += next.shares[i];
    }
    require(total <= 10000, 'Contribution: shares');
    uint64 version = current.version + 1;
    C.store().policies[scope] = next;
    C.store().policies[scope].version = version;
    emit ContributionPolicy(scope, version, next.campaign);
  }

  function musicGiftQuote(Context calldata context, uint256 amount) public view returns (Quote memory q) {
    require(amount > 0, 'Contribution: amount');
    C.Policy storage p = C.store().policies[context.contentHash];
    bool active = block.timestamp >= p.startsAt && (p.endsAt == 0 || block.timestamp < p.endsAt);
    address artist = LibDiamond.contractOwner();
    uint256 distributable = amount;
    LibMusicRoyalties.RoyaltySplit[] storage splits = LibMusicRoyalties.store().splits[context.contentHash];
    q.recipients = new address[](splits.length + p.recipients.length + 2);
    q.amounts = new uint256[](q.recipients.length);
    q.roles = new uint8[](q.recipients.length);
    uint256 n;
    if (context.contentHash != bytes32(0)) {
      LibMusicRegistry.requireExists(LibMusicRegistry.store(), context.contentHash);
      LibMusicRegistry.requireActive(LibMusicRegistry.store(), context.contentHash);
      artist = LibMusicRegistry.store().tracks[context.contentHash].artist;
    }
    q.attestor = p.roomAttestor != address(0) ? p.roomAttestor : C.store().policies[bytes32(0)].roomAttestor;
    if (context.room != bytes32(0)) {
      require(context.contentHash != bytes32(0) && context.host != address(0) && q.attestor != address(0), 'Contribution: room unavailable');
      uint256 hostAmount = active ? (amount * p.hostBps) / 10000 : 0;
      distributable -= hostAmount;
      q.recipients[n] = context.host;
      q.amounts[n] = hostAmount;
      q.roles[n++] = 2;
    } else require(context.host == address(0), 'Contribution: host without room');
    uint256 artistAmount = distributable;
    if (context.contentHash != bytes32(0)) {
      for (uint256 i; i < splits.length; i++) {
        if (splits[i].recipient == artist) continue;
        uint256 share = (distributable * splits[i].bps) / 10000;
        artistAmount -= share;
        q.recipients[n] = splits[i].recipient;
        q.amounts[n] = share;
        q.roles[n++] = 1;
      }
    }
    uint256 distributed;
    if (active) {
      q.campaign = p.campaign;
      for (uint256 i; i < p.recipients.length; i++) {
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
    require(context.intentId != bytes32(0) && !C.store().used[msg.sender][context.intentId], 'Contribution: already submitted');
    require(context.expiresAt >= block.timestamp && context.expiresAt <= block.timestamp + 1800, 'Contribution: quote expired');
    Quote memory q = musicGiftQuote(context, msg.value);
    require(q.digest == expectedQuote, 'Contribution: review changed distribution');
    if (context.room != bytes32(0)) {
      bytes32 digest = keccak256(abi.encode(block.chainid, address(this), msg.sender, context, msg.value));
      require(_signer(digest, roomProof) == q.attestor, 'Contribution: invalid room proof');
    } else require(roomProof.length == 0, 'Contribution: unexpected proof');
    C.store().used[msg.sender][context.intentId] = true;
    bytes32 id = keccak256(abi.encode(msg.sender, context.intentId));
    emit ContributionReceived(id, context.contentHash, msg.sender, msg.value, context.host, context.room, q.campaign, q.digest, uint64(block.timestamp));
    for (uint256 i; i < q.recipients.length; i++) {
      if (q.amounts[i] == 0) continue;
      bool paid = LibMusicRoyalties.trySendNative(q.recipients[i], q.amounts[i]);
      if (!paid) C.store().pending[id][q.recipients[i]] += q.amounts[i];
      emit ContributionShare(id, q.recipients[i], q.amounts[i], q.roles[i], paid);
    }
  }

  function musicGiftPending(bytes32 id, address recipient) external view returns (uint256) {
    return C.store().pending[id][recipient];
  }
  function musicGiftClaim(bytes32 id) external contributionGuard {
    uint256 amount = C.store().pending[id][msg.sender];
    require(amount > 0, 'Contribution: nothing to claim');
    C.store().pending[id][msg.sender] = 0;
    require(LibMusicRoyalties.trySendNative(msg.sender, amount), 'Contribution: recipient rejected claim');
    emit ContributionClaimed(id, msg.sender, amount);
  }

  function _signer(bytes32 digest, bytes calldata signature) private pure returns (address signer) {
    require(signature.length == 65, 'Contribution: proof length');
    bytes32 r;
    bytes32 s;
    uint8 v;
    assembly {
      r := calldataload(signature.offset)
      s := calldataload(add(signature.offset, 32))
      v := byte(0, calldataload(add(signature.offset, 64)))
    }
    require(uint256(s) <= 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0 && (v == 27 || v == 28), 'Contribution: proof encoding');
    signer = ecrecover(keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', digest)), v, r, s);
    require(signer != address(0), 'Contribution: proof signer');
  }
}
