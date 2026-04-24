// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IDiamondLoupe } from "../interfaces/IDiamondLoupe.sol";
import { IERC165 } from "../interfaces/IERC165.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";

/// @title DiamondLoupePallet
/// @notice Smart Pallet for introspecting the Smart Runtime.
///
///         Implements the ERC-2535 Loupe interface so tooling (block explorers,
///         frontends, other contracts) can discover which Smart Pallets are
///         registered and which function selectors they serve.
///
///         Also implements ERC-165 `supportsInterface` using the flags written
///         into DiamondStorage during SmartRuntime construction.
contract DiamondLoupePallet is IDiamondLoupe, IERC165 {
    /// @inheritdoc IDiamondLoupe
    function facets() external view override returns (Facet[] memory facets_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint256 numFacets = ds.facetAddresses.length;
        facets_ = new Facet[](numFacets);
        for (uint256 i; i < numFacets; i++) {
            address facetAddr = ds.facetAddresses[i];
            facets_[i].facetAddress = facetAddr;
            facets_[i].functionSelectors =
                ds.facetFunctionSelectors[facetAddr].functionSelectors;
        }
    }

    /// @inheritdoc IDiamondLoupe
    function facetFunctionSelectors(address facet)
        external
        view
        override
        returns (bytes4[] memory facetFunctionSelectors_)
    {
        facetFunctionSelectors_ =
            LibDiamond.diamondStorage().facetFunctionSelectors[facet].functionSelectors;
    }

    /// @inheritdoc IDiamondLoupe
    function facetAddresses()
        external
        view
        override
        returns (address[] memory facetAddresses_)
    {
        facetAddresses_ = LibDiamond.diamondStorage().facetAddresses;
    }

    /// @inheritdoc IDiamondLoupe
    function facetAddress(bytes4 functionSelector)
        external
        view
        override
        returns (address facetAddress_)
    {
        facetAddress_ = LibDiamond
            .diamondStorage()
            .selectorToFacetAndPosition[functionSelector]
            .facetAddress;
    }

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId)
        external
        view
        override
        returns (bool)
    {
        return LibDiamond.diamondStorage().supportedInterfaces[interfaceId];
    }
}
