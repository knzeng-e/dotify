// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IDiamondCut } from "../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";

/// @title DiamondCutPallet
/// @notice Smart Pallet responsible for upgrading the Smart Runtime.
///
///         This pallet is registered in the SmartRuntime at construction time.
///         Only the Smart Runtime owner may call `diamondCut`.
///
///         Upgrade workflow:
///           1. Deploy the new Smart Pallet contract off-chain.
///           2. Call `diamondCut` with the new pallet's address and selectors.
///           3. The Smart Runtime now routes those selectors to the new pallet —
///              no full redeployment needed (forkless upgrade).
contract DiamondCutPallet is IDiamondCut {
    /// @inheritdoc IDiamondCut
    /// @dev Executed via delegatecall inside SmartRuntime, so `address(this)` is
    ///      SmartRuntime and storage mutations land in SmartRuntime's slot.
    function diamondCut(
        FacetCut[] calldata cuts,
        address init,
        bytes calldata initCalldata
    ) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.diamondCut(cuts, init, initCalldata);
    }
}
