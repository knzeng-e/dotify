// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

import { IPersonhood } from '../interfaces/IPersonhood.sol';

/// @title LibPersonhood
/// @notice Reads proof of personhood from the Individuality precompile.
///
///         This replaces Dotify's admin-registrar personhood, which could only ever be
///         as trustworthy as the account operating it — and that account defaults to
///         the artist, who therefore had the technical ability to grant personhood to
///         their own listeners. Reading the precompile removes that forgery path
///         entirely: personhood becomes a fact about a person on the People chain, not
///         a row an operator can write.
///
///         It also earns Dotify a property the registrar could not offer. The precompile
///         returns a per-context alias, so the same listener appears under a different
///         pseudonym in every application. Dotify learns "this is a distinct person"
///         without learning who they are anywhere else.
library LibPersonhood {
  /// @dev Fixed precompile address. `pallet-revive` left-shifts the user-defined
  ///      `AddressMatcher::Fixed(0x0A01)` index by 16 bits to form this suffix.
  ///      This integration expects a 64-byte PersonhoodInfo. Target deployment
  ///      must verify the address, supported ABI and real-proof availability.
  address internal constant PERSONHOOD_PRECOMPILE = 0x000000000000000000000000000000000a010000;

  /// @dev Dotify's application context. Fixed forever: changing it re-pseudonymises
  ///      every listener, so any change is an identity migration, not a config edit.
  bytes32 internal constant DOTIFY_CONTEXT = bytes32('dotify');

  uint8 internal constant STATUS_NONE = 0;
  uint8 internal constant STATUS_LITE = 1;
  uint8 internal constant STATUS_FULL = 2;

  /// @notice Read personhood for `account` in Dotify's context.
  /// @return status  Supported tier, or an unsupported uint8 diagnostic tier.
  ///                 Unavailable/malformed evidence returns 0.
  /// @return alias_  Per-context pseudonym; zero for unusable evidence.
  /// @return live    True only for a supported, correctly encoded response.
  ///
  /// @dev Deliberately a low-level staticcall rather than a typed call. The precompile
  ///      declares `HAS_CONTRACT_INFO = false`, so its `extcodesize` can be zero, and
  ///      Solidity's high-level call inserts an `extcodesize` check that would revert
  ///      against it. The staticcall also lets a chain without the precompile — a local
  ///      Hardhat node — resolve to "not live" instead of reverting every access query.
  ///
  ///      `live` is returned rather than swallowed so callers can distinguish "this
  ///      person has no personhood" from unusable evidence (unavailable, malformed
  ///      or unsupported). Both deny a personhood gate. An unsupported uint8 tier
  ///      remains diagnostic, but its alias must not be treated as verified.
  function readStatus(address account) internal view returns (uint8 status, bytes32 alias_, bool live) {
    bytes memory callData = abi.encodeWithSelector(IPersonhood.personhoodStatus.selector, account, DOTIFY_CONTEXT);

    (bool ok, bytes memory returnData) = PERSONHOOD_PRECOMPILE.staticcall(callData);

    // A call to an address with no code succeeds with empty returndata, so success
    // alone proves nothing. The declared ABI is exactly two static words.
    // Do not accept a changed response layout as if it were the old protocol.
    if (!ok || returnData.length != 64) {
      return (STATUS_NONE, bytes32(0), false);
    }

    // abi.decode(uint8) reverts for a dirty status word. Inspect the full word
    // before narrowing so malformed evidence denies rather than panicking.
    uint256 statusWord;
    bytes32 contextAlias;
    assembly {
      statusWord := mload(add(returnData, 32))
      contextAlias := mload(add(returnData, 64))
    }
    if (statusWord > type(uint8).max) return (STATUS_NONE, bytes32(0), false);
    status = uint8(statusWord);
    // A new ordinal is not permission to infer a stronger verified identity.
    // Retain the diagnostic tier, but never expose its alias as usable evidence.
    if (status > STATUS_FULL) return (status, bytes32(0), false);
    return (status, contextAlias, true);
  }

  /// @notice True when `account` holds at least `requiredStatus` in Dotify's context.
  /// @dev Fails closed: an unavailable precompile denies every gated track rather than
  ///      admitting everyone. Product invariant — ambiguous access decisions fail closed.
  function hasStatus(address account, uint8 requiredStatus) internal view returns (bool) {
    if (requiredStatus == STATUS_NONE) return true;
    if (requiredStatus > STATUS_FULL) return false;
    (uint8 status, , bool live) = readStatus(account);
    if (!live) return false;
    return status >= requiredStatus;
  }
}
