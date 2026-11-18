// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

interface IRoyaltyClaimRuntime {
  function musicRoyClaim(address recipient) external returns (uint256 amount, bool settled);
  function musicGiftClaim(bytes32 id) external;
}

contract RejectingRoyaltyRecipient {
  receive() external payable {
    revert('RejectingRoyaltyRecipient: rejected');
  }

  function claimFrom(address runtime) external returns (uint256 amount, bool settled) {
    return IRoyaltyClaimRuntime(runtime).musicRoyClaim(address(this));
  }
}

contract GasConsumingRoyaltyRecipient {
  uint256 public sink;
  bool public burnGas = true;

  function setBurnGas(bool nextBurnGas) external {
    burnGas = nextBurnGas;
  }

  function claimContribution(address runtime, bytes32 id) external {
    IRoyaltyClaimRuntime(runtime).musicGiftClaim(id);
  }

  receive() external payable {
    if (!burnGas) return;
    while (burnGas) {
      sink += 1 + msg.value;
    }
  }

  function claimFrom(address runtime) external returns (uint256 amount, bool settled) {
    return IRoyaltyClaimRuntime(runtime).musicRoyClaim(address(this));
  }
}

/// @dev A legitimate receiver whose execution exceeds the old fixed stipend.
contract ExpensiveRoyaltyRecipient {
  uint256 public minimumGas = 150_000;

  receive() external payable {
    require(gasleft() >= minimumGas, 'ExpensiveRoyaltyRecipient: insufficient budget');
  }

  function claimFrom(address runtime) external returns (uint256 amount, bool settled) {
    return IRoyaltyClaimRuntime(runtime).musicRoyClaim(address(this));
  }

  function claimContribution(address runtime, bytes32 id) external {
    IRoyaltyClaimRuntime(runtime).musicGiftClaim(id);
  }

  function payAccess(address runtime, bytes32 contentHash) external payable {
    (bool ok, ) = runtime.call{ value: msg.value }(abi.encodeWithSignature('musicRoyPayAccess(bytes32)', contentHash));
    require(ok, 'ExpensiveRoyaltyRecipient: purchase failed');
  }
}
