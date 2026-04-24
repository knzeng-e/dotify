// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ERC-165 Standard Interface Detection
/// @dev https://eips.ethereum.org/EIPS/eip-165
interface IERC165 {
    /// @notice Returns true if this contract implements the interface defined by `interfaceId`.
    /// @param interfaceId The interface identifier, as specified in ERC-165.
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
