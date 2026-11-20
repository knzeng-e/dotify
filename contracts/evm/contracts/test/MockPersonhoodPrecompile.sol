// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

/// @dev TEST-ONLY stand-in for the Individuality personhood precompile.
///
///      The real precompile lives at a fixed address inside `pallet-revive` and has no
///      deployable bytecode, so a Hardhat node cannot host it. Tests install this
///      contract's runtime code at that same address with `hardhat_setCode`, then write
///      its storage through the ordinary setter below — the storage lands under the
///      precompile address, so the runtime's staticcall reads it exactly as it would
///      read the real thing.
///
///      This is the only way to exercise the fail-closed path and the granted path on a
///      chain that has no Individuality pallet.
contract MockPersonhoodPrecompile {
  struct PersonhoodInfo {
    uint8 status;
    bytes32 contextAlias;
  }

  // account => context => info
  mapping(address => mapping(bytes32 => PersonhoodInfo)) private _info;
  bytes private _rawResponse;
  bool private _rawEnabled;
  bool private _rawReverts;

  /// @notice TEST-ONLY arbitrary return bytes, including invalid ABI words.
  function setRawResponse(bytes calldata response, bool reverts_) external {
    _rawResponse = response;
    _rawEnabled = true;
    _rawReverts = reverts_;
  }

  /// @notice Set the personhood reading returned for `account` in `context`.
  function setPersonhood(address account, bytes32 context, uint8 status, bytes32 contextAlias) external {
    _info[account][context] = PersonhoodInfo({ status: status, contextAlias: contextAlias });
  }

  /// @notice Matches the real precompile's signature and return shape.
  function personhoodStatus(address account, bytes32 context) external view returns (PersonhoodInfo memory info) {
    if (_rawEnabled) {
      require(!_rawReverts, 'MockPersonhood: unavailable');
      bytes memory response = _rawResponse;
      assembly {
        return(add(response, 32), mload(response))
      }
    }
    return _info[account][context];
  }
}
