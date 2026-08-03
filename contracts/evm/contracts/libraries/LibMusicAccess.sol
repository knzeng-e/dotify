// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { LibMusicRegistry } from './LibMusicRegistry.sol';
import { LibPersonhood } from './LibPersonhood.sol';

/// @title LibMusicAccess
/// @notice Namespaced storage for listener access records, and personhood gating read
///         from the Individuality precompile.
///
///         Personhood is no longer stored here. `personhoodLevelOf` and
///         `personhoodRegistrar` remain declared so existing runtimes keep their storage
///         layout intact — a diamond cannot safely reorder occupied slots — but neither
///         participates in an access decision any more. The registrar defaulted to the
///         artist, which meant an artist could grant personhood to their own listeners;
///         the precompile removes that path.
///
///         PersonhoodLevel maps onto the precompile tiers by ordinal:
///         None(0) -> None(0), DIM1(1) -> Lite(1), DIM2(2) -> Full(2).
///
/// Storage slot: keccak256("smart.runtime.pallet.music-access.storage")
library LibMusicAccess {
  bytes32 constant STORAGE_POSITION = keccak256('smart.runtime.pallet.music-access.storage');

  struct Storage {
    // contentHash → listener → paid
    mapping(bytes32 => mapping(address => bool)) paidAccess;
    // DEPRECATED — no longer read for access. Kept to preserve the storage layout of
    // already-deployed runtimes. Personhood now comes from the precompile.
    mapping(address => LibMusicRegistry.PersonhoodLevel) personhoodLevelOf;
    // DEPRECATED — see above. Retained for layout compatibility only.
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

  /// @notice True when `account` meets `required` personhood, per the Individuality
  ///         precompile. The storage argument is unused and kept only so existing
  ///         call sites and the pallet ABI stay unchanged.
  /// @dev Fails closed when the precompile cannot answer. See LibPersonhood.hasStatus.
  function hasRequiredPersonhood(Storage storage, address account, LibMusicRegistry.PersonhoodLevel required) internal view returns (bool) {
    return LibPersonhood.hasStatus(account, uint8(required));
  }

  /// @notice Dotify-context personhood tier and pseudonym for `account`.
  /// @dev Exposes the alias so a runtime can later count distinct people rather than
  ///      distinct addresses. Not used for access decisions today.
  function personhoodOf(address account) internal view returns (uint8 status, bytes32 contextAlias, bool live) {
    return LibPersonhood.readStatus(account);
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
