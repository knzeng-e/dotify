// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

import { OwnershipPallet } from '../pallets/OwnershipPallet.sol';

/// @dev Local governance-receiver fixture; never installed as a runtime facet.
contract AdminReceiverMock {
  function accept(address runtime) external {
    OwnershipPallet(runtime).acceptOwnership();
  }
}
