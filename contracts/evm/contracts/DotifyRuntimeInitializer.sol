// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { LibDiamond } from "./libraries/LibDiamond.sol";
import { LibMusicAccess } from "./libraries/LibMusicAccess.sol";

/// @title DotifyRuntimeInitializer
/// @notice Diamond init contract — called once via `delegatecall` inside the
///         SmartRuntime constructor.
///
///         Bootstraps each new artist runtime so that:
///           - The personhood registrar is set to the artist (owner) so they
///             can immediately grant DIM levels to listeners without a separate
///             admin transaction.
///
///         This contract is deployed once and shared across all artist runtimes
///         created by the factory.  It executes in the SmartRuntime's storage
///         context via `delegatecall`, so `LibDiamond.contractOwner()` returns
///         the artist's address (set by SmartRuntime's constructor before the
///         init call is made).
contract DotifyRuntimeInitializer {
    function initialize() external {
        LibMusicAccess.store().personhoodRegistrar = LibDiamond.contractOwner();
    }
}
