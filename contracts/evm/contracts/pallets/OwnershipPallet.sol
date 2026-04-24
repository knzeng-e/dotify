// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { LibDiamond } from "../libraries/LibDiamond.sol";

/// @title OwnershipPallet
/// @notice Smart Pallet for managing the Smart Runtime's owner.
///
///         The owner is the account allowed to call `diamondCut` and therefore
///         controls which Smart Pallets are registered in the Smart Runtime.
///
///         Ownership transfer is a two-step, single-transaction operation here
///         (immediate transfer).  To implement a pending-accept pattern, replace
///         this pallet with an upgraded version — no redeployment of the Smart
///         Runtime required.
contract OwnershipPallet {
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @notice Returns the current owner of the Smart Runtime.
    function owner() external view returns (address owner_) {
        owner_ = LibDiamond.contractOwner();
    }

    /// @notice Transfer ownership of the Smart Runtime to `newOwner`.
    /// @dev Only callable by the current owner.
    function transferOwnership(address newOwner) external {
        LibDiamond.enforceIsContractOwner();
        require(newOwner != address(0), "OwnershipPallet: new owner is zero");
        LibDiamond.setContractOwner(newOwner);
    }
}
