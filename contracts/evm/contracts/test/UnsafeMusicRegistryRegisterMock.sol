// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Test-only facet that exposes the production registration selector
///         without an owner check. It models the authorization defect present
///         in the legacy deployed facet; it must never be deployed by scripts.
contract UnsafeMusicRegistryRegisterMock {
  struct TrackRegistration {
    bytes32 contentHash;
    string title;
    string artistName;
    string description;
    string imageRef;
    string audioRef;
    string metadataRef;
    string artistContractRef;
    uint8 accessMode;
    uint128 pricePlanck;
    uint8 requiredPersonhood;
  }

  bytes32 private constant CALL_COUNT_SLOT = keccak256('dotify.test.unsafe-music-registry-register.calls');

  function musicRegRegister(TrackRegistration calldata, address[] calldata, uint16[] calldata) external {
    bytes32 slot = CALL_COUNT_SLOT;
    assembly {
      sstore(slot, add(sload(slot), 1))
    }
  }
}
