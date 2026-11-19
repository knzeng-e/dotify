// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

import { LibDiamond } from '../libraries/LibDiamond.sol';
import { LibRuntimeArtist } from '../libraries/LibRuntimeArtist.sol';

/// @notice Upgrade administration only. Artist identity, publishing and rights
/// do not move with ownership. Subsequent transfers require recipient acceptance.
contract OwnershipPallet {
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
  event OwnershipTransferStarted(address indexed owner, address indexed pendingOwner);
  event OwnershipTransferCancelled(address indexed owner, address indexed pendingOwner);

  function owner() external view returns (address) {
    return LibDiamond.contractOwner();
  }

  function runtimeArtist() external view returns (address) {
    return LibRuntimeArtist.store().artist;
  }

  function pendingOwner() external view returns (address) {
    return LibDiamond.diamondStorage().pendingOwner;
  }

  function transferOwnership(address newOwner) external {
    LibDiamond.enforceIsContractOwner();
    require(newOwner != address(0) && newOwner != address(this) && newOwner != msg.sender, 'OwnershipPallet: invalid pending owner');
    LibDiamond.diamondStorage().pendingOwner = newOwner;
    emit OwnershipTransferStarted(msg.sender, newOwner);
  }

  function acceptOwnership() external {
    require(msg.sender == LibDiamond.diamondStorage().pendingOwner, 'OwnershipPallet: not pending owner');
    LibDiamond.setContractOwner(msg.sender);
  }

  function cancelOwnershipTransfer() external {
    LibDiamond.enforceIsContractOwner();
    address pending = LibDiamond.diamondStorage().pendingOwner;
    require(pending != address(0), 'OwnershipPallet: no pending owner');
    LibDiamond.diamondStorage().pendingOwner = address(0);
    emit OwnershipTransferCancelled(msg.sender, pending);
  }
}
