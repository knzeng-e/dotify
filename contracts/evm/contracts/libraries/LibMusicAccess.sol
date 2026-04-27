// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { LibMusicRegistry } from './LibMusicRegistry.sol';

/// @title LibMusicAccess
/// @notice Namespaced storage for listener access records and proof-of-personhood levels.
///         Personhood levels mirror the Individuality Chain DIM tiers; in the current
///         prototype they are set via an admin registrar account.
///
/// Storage slot: keccak256("smart.runtime.pallet.music-access.storage")
library LibMusicAccess {
  bytes32 constant STORAGE_POSITION = keccak256('smart.runtime.pallet.music-access.storage');

  struct Storage {
    // contentHash → listener → paid
    mapping(bytes32 => mapping(address => bool)) paidAccess;
    // account → verified personhood tier
    mapping(address => LibMusicRegistry.PersonhoodLevel) personhoodLevelOf;
    // address authorised to set personhood levels
    address personhoodRegistrar;
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

  function hasRequiredPersonhood(Storage storage s, address account, LibMusicRegistry.PersonhoodLevel required) internal view returns (bool) {
    if (required == LibMusicRegistry.PersonhoodLevel.None) return true;
    return uint8(s.personhoodLevelOf[account]) >= uint8(required);
  }

  function setPersonhoodRegistrar(Storage storage s, address registrar) internal returns (address previousRegistrar) {
    require(registrar != address(0), 'MusicAccess: zero address');
    previousRegistrar = s.personhoodRegistrar;
    s.personhoodRegistrar = registrar;
  }

  function requireRegistrar(Storage storage s) internal view {
    require(msg.sender == s.personhoodRegistrar, 'MusicAccess: not registrar');
  }
}
