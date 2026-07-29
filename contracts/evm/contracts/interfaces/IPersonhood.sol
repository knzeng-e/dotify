// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IPersonhood — Proof of Personhood precompile (Individuality)
/// @notice Minimal interface for the `pallet-revive` personhood precompile, live on
///         Asset Hub at `0x000000000000000000000000000000000A010000`.
///
///         Mirrors the canonical declaration in
///         `paseo-network/runtimes/precompiles/personhood/sol/IPersonhood.sol`.
///         Only `personhoodStatus` is declared here: Dotify reads status, it does not
///         verify raw ring proofs, so `personhoodInfoByProof` is deliberately omitted
///         rather than carried as unused surface.
///
///         The precompile reads the alias-accounts pallet, which stores per-context
///         alias mappings backed by ring membership proofs. Ring roots arrive from the
///         People chain by XCM.
interface IPersonhood {
  /// @param status       Personhood tier: 0 = None, 1 = Lite, 2 = Full. Tiers are
  ///                     incremental, so a future tier leaves these values unchanged.
  /// @param contextAlias Per-context 32-byte pseudonym derived from the ring membership
  ///                     proof. Unique per person per context, which is what prevents
  ///                     cross-application linkability. Zero when status is None.
  struct PersonhoodInfo {
    uint8 status;
    bytes32 contextAlias;
  }

  /// @notice Personhood info for `account` within a specific application `context`.
  /// @param context A fixed 32-byte application identifier. The same person yields a
  ///        different `contextAlias` under a different context.
  function personhoodStatus(address account, bytes32 context) external view returns (PersonhoodInfo memory info);
}
