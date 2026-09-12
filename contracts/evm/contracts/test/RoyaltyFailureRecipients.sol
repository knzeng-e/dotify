// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

interface IRoyaltyClaimRuntime {
  function musicRoyClaim(address recipient) external returns (uint256 amount, bool settled);
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

  receive() external payable {
    if (!burnGas) return;
    for (uint256 i = 0; i < 300; i++) {
      sink += i + msg.value;
    }
  }

  function claimFrom(address runtime) external returns (uint256 amount, bool settled) {
    return IRoyaltyClaimRuntime(runtime).musicRoyClaim(address(this));
  }
}
