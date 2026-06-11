// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title LibReentrancyGuard
/// @notice Namespaced diamond-storage reentrancy guard shared by all Smart Pallets.
///         Because pallets execute via delegatecall inside the SmartRuntime proxy,
///         the lock lives in the runtime's storage and protects every guarded
///         entry point across pallets with a single flag.
///
///         Solidity libraries cannot export modifiers across contracts, so this
///         library exposes internal `enter()` / `exit()` helpers; each pallet
///         defines a thin `nonReentrant` modifier on top of them.
///
/// Storage slot: keccak256("smart.runtime.pallet.reentrancy.storage")
library LibReentrancyGuard {
  bytes32 constant STORAGE_POSITION = keccak256('smart.runtime.pallet.reentrancy.storage');

  // Uninitialised storage reads as 0, so NOT_ENTERED must be 0.
  uint256 internal constant NOT_ENTERED = 0;
  uint256 internal constant ENTERED = 1;

  struct Storage {
    uint256 status;
  }

  function store() internal pure returns (Storage storage s) {
    bytes32 pos = STORAGE_POSITION;
    // solhint-disable-next-line no-inline-assembly
    assembly {
      s.slot := pos
    }
  }

  /// @dev Take the lock. Reverts if it is already held (reentrant call).
  function enter() internal {
    Storage storage s = store();
    require(s.status == NOT_ENTERED, 'ReentrancyGuard: reentrant call');
    s.status = ENTERED;
  }

  /// @dev Release the lock. Must be called on every exit path of a guarded function.
  function exit() internal {
    store().status = NOT_ENTERED;
  }
}
