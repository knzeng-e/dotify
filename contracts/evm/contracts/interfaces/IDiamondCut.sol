// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IDiamondCut — ERC-2535 Diamond Cut Interface
/// @notice Defines the interface for upgrading Smart Pallets in the Smart Runtime.
///         Adding, replacing, or removing a Smart Pallet is done via `diamondCut`.
/// @dev https://eips.ethereum.org/EIPS/eip-2535
interface IDiamondCut {
    /// @notice The action to take for a set of function selectors.
    enum FacetCutAction {
        Add,     // Register new Smart Pallet selectors
        Replace, // Swap existing selectors to a new Smart Pallet
        Remove   // Unregister selectors (facetAddress must be address(0))
    }

    /// @notice Describes one upgrade step: which pallet and which selectors.
    struct FacetCut {
        address facetAddress;
        FacetCutAction action;
        bytes4[] functionSelectors;
    }

    /// @notice Emitted when any Smart Pallet upgrade is applied.
    event DiamondCut(FacetCut[] cuts, address init, bytes initCalldata);

    /// @notice Upgrade the Smart Runtime by adding, replacing, or removing Smart Pallets.
    /// @param cuts        Array of pallet cuts to apply.
    /// @param init        Address of a contract to call after the cut (for init logic), or address(0).
    /// @param initCalldata Calldata passed to `init` via delegatecall.
    function diamondCut(
        FacetCut[] calldata cuts,
        address init,
        bytes calldata initCalldata
    ) external;
}
