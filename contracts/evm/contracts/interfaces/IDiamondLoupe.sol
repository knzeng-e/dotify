// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IDiamondLoupe — ERC-2535 Diamond Loupe Interface
/// @notice Provides introspection functions to inspect which Smart Pallets are
///         registered in the Smart Runtime and which selectors they serve.
/// @dev https://eips.ethereum.org/EIPS/eip-2535
interface IDiamondLoupe {
    /// @notice A pallet address paired with all its registered function selectors.
    struct Facet {
        address facetAddress;
        bytes4[] functionSelectors;
    }

    /// @notice Returns all registered Smart Pallets and their selectors.
    function facets() external view returns (Facet[] memory facets_);

    /// @notice Returns all function selectors registered to a specific Smart Pallet.
    /// @param facet The pallet address to query.
    function facetFunctionSelectors(address facet) external view returns (bytes4[] memory facetFunctionSelectors_);

    /// @notice Returns the addresses of all registered Smart Pallets.
    function facetAddresses() external view returns (address[] memory facetAddresses_);

    /// @notice Returns the Smart Pallet address responsible for the given selector.
    /// @param functionSelector The 4-byte selector to look up.
    function facetAddress(bytes4 functionSelector) external view returns (address facetAddress_);
}
