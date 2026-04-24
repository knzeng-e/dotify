// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { LibDiamond } from "./libraries/LibDiamond.sol";
import { IDiamondCut } from "./interfaces/IDiamondCut.sol";
import { IDiamondLoupe } from "./interfaces/IDiamondLoupe.sol";
import { IERC165 } from "./interfaces/IERC165.sol";

/// @title SmartRuntime
/// @notice The central Diamond Proxy for the Polkadot Smart Runtime system.
///
///         Smart Pallets (ERC-2535 facets) are registered here during construction
///         and can be hot-swapped later through `DiamondCutPallet.diamondCut` —
///         forkless upgrades without redeploying the Smart Runtime itself.
///
///         All function calls that are NOT defined directly on this contract are
///         routed by the fallback to the correct Smart Pallet via `delegatecall`,
///         so every pallet's logic executes in the context of this contract's
///         storage.
///
/// Deployment targets: AssetHub EVM (solc) and PolkaVM / pallet-revive (resolc).
contract SmartRuntime {
    // -------------------------------------------------------------------------
    // Constructor — wire up initial Smart Pallets
    // -------------------------------------------------------------------------

    /// @param owner         The initial owner (controls `diamondCut` upgrades).
    /// @param initialCuts   The first set of Smart Pallets to register.
    /// @param init          Optional initialisation contract (delegatecalled once).
    /// @param initCalldata  Calldata passed to `init`.
    constructor(
        address owner,
        IDiamondCut.FacetCut[] memory initialCuts,
        address init,
        bytes memory initCalldata
    ) payable {
        LibDiamond.setContractOwner(owner);

        // Mark ERC-165 interfaces supported by the core Smart Runtime
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;

        LibDiamond.diamondCut(initialCuts, init, initCalldata);
    }

    // -------------------------------------------------------------------------
    // Fallback — route all calls to the matching Smart Pallet
    // -------------------------------------------------------------------------

    /// @dev Looks up the Smart Pallet (facet) for `msg.sig`, then `delegatecall`s
    ///      it so the pallet's logic runs in this contract's storage context.
    ///      This is the heart of the Diamond Proxy pattern.
    // solhint-disable-next-line no-complex-fallback
    fallback() external payable {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            ds.slot := position
        }

        address pallet = ds.selectorToFacetAndPosition[msg.sig].facetAddress;
        require(pallet != address(0), "SmartRuntime: pallet not found");

        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Copy calldata into memory at position 0
            calldatacopy(0, 0, calldatasize())
            // Delegatecall to the pallet — logic runs in SmartRuntime's storage
            let result := delegatecall(gas(), pallet, 0, calldatasize(), 0, 0)
            // Copy return data
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}
