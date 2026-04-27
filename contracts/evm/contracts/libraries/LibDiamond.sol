// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IDiamondCut } from '../interfaces/IDiamondCut.sol';

/// @title LibDiamond
/// @notice Internal library that owns the Diamond storage slot and all mutation
///         logic for the Smart Runtime.  Every Smart Pallet shares this storage
///         through the delegatecall mechanism — storage lives in the SmartRuntime
///         proxy, logic lives in the Pallets.
///
/// Storage slot: keccak256("dotify.contract.storage")
library LibDiamond {
  // -------------------------------------------------------------------------
  // Storage
  // -------------------------------------------------------------------------

  bytes32 constant DIAMOND_STORAGE_POSITION = keccak256('dotify.contract.storage');

  /// @dev Per-selector metadata stored in the diamond mapping.
  struct FacetAddressAndPosition {
    address facetAddress;
    uint96 functionSelectorPosition; // index in the facet's own selector array
  }

  /// @dev Per-facet metadata: its selector list + its index in facetAddresses[].
  struct FacetFunctionSelectors {
    bytes4[] functionSelectors;
    uint256 facetAddressPosition;
  }

  struct DiamondStorage {
    // selector => facet address + position in that facet's selector list
    mapping(bytes4 => FacetAddressAndPosition) selectorToFacetAndPosition;
    // facet address => its selectors + position in facetAddresses[]
    mapping(address => FacetFunctionSelectors) facetFunctionSelectors;
    // ordered list of all registered facet addresses
    address[] facetAddresses;
    // ERC-165 support flags
    mapping(bytes4 => bool) supportedInterfaces;
    // owner of the Smart Runtime
    address contractOwner;
  }

  function diamondStorage() internal pure returns (DiamondStorage storage ds) {
    bytes32 position = DIAMOND_STORAGE_POSITION;
    // solhint-disable-next-line no-inline-assembly
    assembly {
      ds.slot := position
    }
  }

  // -------------------------------------------------------------------------
  // Ownership helpers
  // -------------------------------------------------------------------------

  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  function setContractOwner(address newOwner) internal {
    DiamondStorage storage ds = diamondStorage();
    address previousOwner = ds.contractOwner;
    ds.contractOwner = newOwner;
    emit OwnershipTransferred(previousOwner, newOwner);
  }

  function contractOwner() internal view returns (address owner_) {
    owner_ = diamondStorage().contractOwner;
  }

  function enforceIsContractOwner() internal view {
    require(msg.sender == diamondStorage().contractOwner, 'LibDiamond: not owner');
  }

  // -------------------------------------------------------------------------
  // Diamond cut — core upgrade logic
  // -------------------------------------------------------------------------

  event DiamondCut(IDiamondCut.FacetCut[] cuts, address init, bytes initCalldata);

  /// @notice Apply a list of Smart Pallet upgrades and optionally run init logic.
  function diamondCut(IDiamondCut.FacetCut[] memory cuts, address init, bytes memory initCalldata) internal {
    uint256 nbOfCuts = cuts.length;

    for (uint256 i; i < nbOfCuts; i++) {
      IDiamondCut.FacetCutAction action = cuts[i].action;
      if (_isAddingAction(action)) {
        _addFunctions(cuts[i].facetAddress, cuts[i].functionSelectors);
      } else if (_isReplaceAction(action)) {
        _replaceFunctions(cuts[i].facetAddress, cuts[i].functionSelectors);
      } else if (_isRemoveAction(action)) {
        _removeFunctions(cuts[i].facetAddress, cuts[i].functionSelectors);
      } else {
        revert('LibDiamond: bad FacetCutAction');
      }
    }
    emit DiamondCut(cuts, init, initCalldata);
    _initializeDiamondCut(init, initCalldata);
  }

  // -------------------------------------------------------------------------
  // Internal mutation helpers
  // -------------------------------------------------------------------------

  function _isAddingAction(IDiamondCut.FacetCutAction upgradeAction) private pure returns (bool) {
    return upgradeAction == IDiamondCut.FacetCutAction.Add;
  }

  function _isReplaceAction(IDiamondCut.FacetCutAction upgradeAction) private pure returns (bool) {
    return upgradeAction == IDiamondCut.FacetCutAction.Replace;
  }

  function _isRemoveAction(IDiamondCut.FacetCutAction upgradeAction) private pure returns (bool) {
    return upgradeAction == IDiamondCut.FacetCutAction.Remove;
  }

  function _addFunctions(address facetAddress, bytes4[] memory selectors) private {
    require(selectors.length > 0, 'LibDiamond: no selectors');
    require(facetAddress != address(0), 'LibDiamond: add facet = address(0)');
    DiamondStorage storage ds = diamondStorage();
    uint96 pos = uint96(ds.facetFunctionSelectors[facetAddress].functionSelectors.length);
    if (pos == 0) {
      _addFacet(ds, facetAddress);
    }
    for (uint256 i; i < selectors.length; i++) {
      bytes4 sel = selectors[i];
      require(ds.selectorToFacetAndPosition[sel].facetAddress == address(0), 'LibDiamond: selector already exists');
      _registerSelector(ds, sel, pos, facetAddress);
      pos++;
    }
  }

  function _replaceFunctions(address facetAddress, bytes4[] memory selectors) private {
    require(selectors.length > 0, 'LibDiamond: no selectors');
    require(facetAddress != address(0), 'LibDiamond: replace facet = address(0)');
    DiamondStorage storage ds = diamondStorage();
    uint96 pos = uint96(ds.facetFunctionSelectors[facetAddress].functionSelectors.length);
    if (pos == 0) {
      _addFacet(ds, facetAddress);
    }
    for (uint256 i; i < selectors.length; i++) {
      bytes4 sel = selectors[i];
      address oldFacet = ds.selectorToFacetAndPosition[sel].facetAddress;
      require(oldFacet != facetAddress, 'LibDiamond: replace with same facet');
      _unregisterSelector(ds, oldFacet, sel);
      _registerSelector(ds, sel, pos, facetAddress);
      pos++;
    }
  }

  function _removeFunctions(address facetAddress, bytes4[] memory selectors) private {
    require(selectors.length > 0, 'LibDiamond: no selectors');
    // ERC-2535: facetAddress MUST be address(0) for Remove action
    require(facetAddress == address(0), 'LibDiamond: remove facet must be address(0)');
    DiamondStorage storage ds = diamondStorage();
    for (uint256 i; i < selectors.length; i++) {
      bytes4 sel = selectors[i];
      address oldFacet = ds.selectorToFacetAndPosition[sel].facetAddress;
      _unregisterSelector(ds, oldFacet, sel);
    }
  }

  function _addFacet(DiamondStorage storage ds, address facetAddress) private {
    _enforceHasContractCode(facetAddress, 'LibDiamond: facet has no code');
    ds.facetFunctionSelectors[facetAddress].facetAddressPosition = ds.facetAddresses.length;
    ds.facetAddresses.push(facetAddress);
  }

  function _registerSelector(DiamondStorage storage ds, bytes4 selector, uint96 selectorPosition, address facetAddress) private {
    ds.selectorToFacetAndPosition[selector].functionSelectorPosition = selectorPosition;
    ds.facetFunctionSelectors[facetAddress].functionSelectors.push(selector);
    ds.selectorToFacetAndPosition[selector].facetAddress = facetAddress;
  }

  function _unregisterSelector(DiamondStorage storage ds, address facetAddress, bytes4 selector) private {
    require(facetAddress != address(0), "LibDiamond: selector doesn't exist");
    require(facetAddress != address(this), "LibDiamond: can't remove immutable fn");

    uint256 selectorPos = ds.selectorToFacetAndPosition[selector].functionSelectorPosition;
    uint256 lastPos = ds.facetFunctionSelectors[facetAddress].functionSelectors.length - 1;

    // Swap last selector into vacated slot, then pop
    if (selectorPos != lastPos) {
      bytes4 lastSel = ds.facetFunctionSelectors[facetAddress].functionSelectors[lastPos];
      ds.facetFunctionSelectors[facetAddress].functionSelectors[selectorPos] = lastSel;
      ds.selectorToFacetAndPosition[lastSel].functionSelectorPosition = uint96(selectorPos);
    }
    ds.facetFunctionSelectors[facetAddress].functionSelectors.pop();
    delete ds.selectorToFacetAndPosition[selector];

    // If the facet has no more selectors, remove it from facetAddresses[]
    if (lastPos == 0) {
      uint256 lastFacetPos = ds.facetAddresses.length - 1;
      uint256 facetPos = ds.facetFunctionSelectors[facetAddress].facetAddressPosition;
      if (facetPos != lastFacetPos) {
        address lastFacet = ds.facetAddresses[lastFacetPos];
        ds.facetAddresses[facetPos] = lastFacet;
        ds.facetFunctionSelectors[lastFacet].facetAddressPosition = facetPos;
      }
      ds.facetAddresses.pop();
      delete ds.facetFunctionSelectors[facetAddress].facetAddressPosition;
    }
  }

  function _initializeDiamondCut(address init, bytes memory initCalldata) private {
    if (init == address(0)) return;
    _enforceHasContractCode(init, 'LibDiamond: init has no code');
    (bool success, bytes memory err) = init.delegatecall(initCalldata);
    if (!success) {
      if (err.length > 0) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
          let len := mload(err)
          revert(add(err, 0x20), len)
        }
      } else {
        revert('LibDiamond: init reverted');
      }
    }
  }

  function _enforceHasContractCode(address target, string memory errorMsg) private view {
    uint256 size;
    // solhint-disable-next-line no-inline-assembly
    assembly {
      size := extcodesize(target)
    }
    require(size > 0, errorMsg);
  }
}
