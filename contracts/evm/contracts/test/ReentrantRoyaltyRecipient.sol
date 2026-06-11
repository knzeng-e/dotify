// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev TEST-ONLY helper. A malicious royalty recipient that attempts to re-enter
///      `musicRoyPayAccess` for a different contentHash while receiving its share
///      mid-distribution. Used to prove the cross-pallet reentrancy guard holds.
interface IMusicRoyaltiesPallet {
  function musicRoyPayAccess(bytes32 contentHash) external payable;
}

contract ReentrantRoyaltyRecipient {
  address public runtime;
  bytes32 public targetHash;
  bool public attempted;
  bool public reenterSucceeded;

  function configure(address _runtime, bytes32 _targetHash) external {
    runtime = _runtime;
    targetHash = _targetHash;
  }

  receive() external payable {
    if (!attempted && runtime != address(0)) {
      attempted = true;
      // Re-enter the runtime for a different track. Forward all received value so
      // the only thing that can stop the call is the reentrancy guard itself.
      try IMusicRoyaltiesPallet(runtime).musicRoyPayAccess{ value: msg.value }(targetHash) {
        reenterSucceeded = true;
      } catch {
        reenterSucceeded = false;
      }
    }
  }
}
