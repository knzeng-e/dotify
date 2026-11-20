// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

/// @notice Fresh-generation native payment precision. ABI prices and msg.value
/// remain 18-decimal EVM integers; one native unit is quantum EVM units.
library LibNativePrice {
  bytes32 constant POSITION = keccak256('dotify.runtime.native-price.storage');

  struct Store {
    uint8 nativeDecimals;
    uint256 quantum;
  }

  function store() internal pure returns (Store storage s) {
    bytes32 position = POSITION;
    assembly {
      s.slot := position
    }
  }

  function initialize(uint8 decimals) internal {
    require(decimals <= 18, 'NativePrice: unsupported decimals');
    require(store().quantum == 0, 'NativePrice: already initialized');
    store().nativeDecimals = decimals;
    store().quantum = 10 ** (18 - decimals);
  }

  function nativeDecimals() internal view returns (uint8) {
    require(store().quantum != 0, 'NativePrice: not initialized');
    return store().nativeDecimals;
  }

  function validate(uint256 price) internal view {
    uint256 quantum = store().quantum;
    require(quantum != 0, 'NativePrice: not initialized');
    require(price % quantum == 0, 'NativePrice: unrepresentable price');
  }
}
