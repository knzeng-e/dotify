// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

import { LibDiamond } from '../libraries/LibDiamond.sol';
import { LibMusicRegistry } from '../libraries/LibMusicRegistry.sol';
import { LibMusicAccess } from '../libraries/LibMusicAccess.sol';
import { LibMusicNFT } from '../libraries/LibMusicNFT.sol';

/// @title MusicAccessPallet
/// @notice Smart Pallet for access control queries and proof-of-personhood management.
///
///         Access logic:
///           1. Inactive track            → denied
///           2. Caller is artist or owner → granted (always)
///           3. HumanFree track           → granted if caller meets personhood level
///           4. Classic track             → granted if caller has paid
///
///         Personhood (DIM1, DIM2) is read from the Individuality precompile at
///         0x000000000000000000000000000000000A010000, in Dotify's own application
///         context. DIM1 maps to Lite, DIM2 to Full.
///
///         The former admin registrar is retired. It defaulted to the artist, so an
///         artist could grant personhood to their own listeners — which made
///         `human-free` a claim the contract could not actually support. Reading the
///         precompile removes that path, and adds a per-context alias so Dotify can
///         recognise a distinct person without learning who they are in any other
///         application. Registrar entry points remain declared for ABI stability;
///         the setter reverts.
///
///         Storage: LibMusicAccess (owns), LibMusicRegistry (reads), LibMusicNFT (reads)
///         Prefix:  musicAcc — avoids selector collisions with other pallets
contract MusicAccessPallet {
  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  event MusicAccPersonhoodRegistrarSet(address indexed previous, address indexed next);
  event MusicAccPersonhoodLevelSet(address indexed account, LibMusicRegistry.PersonhoodLevel level);

  // -------------------------------------------------------------------------
  // Admin — personhood registrar management (owner-only)
  // -------------------------------------------------------------------------

  /// @notice Set the personhood registrar address.
  ///         Only the SmartRuntime owner can call this.
  function setPersonhoodRegistrar(address registrar) external {
    require(msg.sender == LibDiamond.contractOwner(), 'MusicAccess: not owner');
    LibMusicAccess.Storage storage as_ = LibMusicAccess.store();
    address previousRegistrar = LibMusicAccess.setPersonhoodRegistrar(as_, registrar);
    emit MusicAccPersonhoodRegistrarSet(previousRegistrar, registrar);
  }

  // -------------------------------------------------------------------------
  // Personhood level management (registrar-only)
  // -------------------------------------------------------------------------

  /// @notice DEPRECATED — personhood is read from the Individuality precompile and can
  ///         no longer be assigned by an operator.
  /// @dev Reverts rather than writing to storage no access decision reads. Accepting a
  ///      write that silently changes nothing would leave an operator believing a
  ///      listener was granted access they do not have. The parameters are retained so
  ///      the selector and ABI stay stable for already-deployed runtimes.
  function musicAccSetPersonhoodLevel(address, LibMusicRegistry.PersonhoodLevel) external pure {
    revert('MusicAccess: personhood is read from the Individuality precompile');
  }

  // -------------------------------------------------------------------------
  // View functions
  // -------------------------------------------------------------------------

  /// @notice Check whether `listener` is currently allowed to access `contentHash`.
  function musicAccCanAccess(bytes32 contentHash, address listener) external view returns (bool) {
    LibMusicAccess.Storage storage as_ = LibMusicAccess.store();
    LibMusicRegistry.Storage storage rs = LibMusicRegistry.store();
    LibMusicRegistry.TrackRecord storage track = rs.tracks[contentHash];

    if (!track.active) return false;

    // Artist and current NFT owner always have access.
    if (listener == track.artist) return true;
    if (LibMusicNFT.store().ownerOf[track.tokenId] == listener) return true;

    // Free: everyone may listen; the policy is the whole gate.
    if (track.accessMode == LibMusicRegistry.AccessMode.Free) return true;

    if (track.accessMode == LibMusicRegistry.AccessMode.HumanFree) {
      return LibMusicAccess.hasRequiredPersonhood(as_, listener, track.requiredPersonhood);
    }

    // Classic
    return as_.paidAccess[contentHash][listener];
  }

  /// @notice Returns true if `listener` has paid for access to a Classic track.
  function musicAccHasPaid(bytes32 contentHash, address listener) external view returns (bool) {
    return LibMusicAccess.store().paidAccess[contentHash][listener];
  }

  /// @notice Returns the verified personhood level for `account`, read from the
  ///         Individuality precompile in Dotify's application context.
  /// @dev Returns None when the precompile is unavailable, matching the access
  ///      decision. Use `musicAccPersonhoodInfo` to tell those two cases apart.
  function musicAccPersonhoodLevel(address account) external view returns (LibMusicRegistry.PersonhoodLevel) {
    (uint8 status, , bool live) = LibMusicAccess.personhoodOf(account);
    if (!live) return LibMusicRegistry.PersonhoodLevel.None;
    return LibMusicRegistry.PersonhoodLevel(status);
  }

  /// @notice Full personhood reading for `account`: tier, Dotify-context pseudonym, and
  ///         whether the precompile answered at all.
  /// @dev `live == false` means this chain cannot answer, which is a deployment
  ///      diagnosis, not a statement about the listener. `contextAlias` is the same
  ///      person under a different pseudonym in every other application, so it can
  ///      identify a returning listener without revealing who they are elsewhere.
  function musicAccPersonhoodInfo(address account) external view returns (uint8 status, bytes32 contextAlias, bool live) {
    return LibMusicAccess.personhoodOf(account);
  }

  /// @notice Returns true if `account` meets `required` personhood level.
  function musicAccHasPersonhood(address account, LibMusicRegistry.PersonhoodLevel required) external view returns (bool) {
    return LibMusicAccess.hasRequiredPersonhood(LibMusicAccess.store(), account, required);
  }

  /// @notice Returns the current personhood registrar address.
  function musicAccGetRegistrar() external view returns (address) {
    return LibMusicAccess.store().personhoodRegistrar;
  }
}
