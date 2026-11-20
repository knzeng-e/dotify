// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

import { LibDiamond } from '../libraries/LibDiamond.sol';
import { LibMusicRegistry } from '../libraries/LibMusicRegistry.sol';
import { LibMusicAccess } from '../libraries/LibMusicAccess.sol';

/// @title MusicAccessPallet
/// @notice Smart Pallet for access control queries and proof-of-personhood management.
///
///         Access logic:
///           1. Inactive track            → denied
///           2. Listener is original artist → granted
///           3. Prior paid grant          → granted across access-mode changes
///           4. HumanFree track           → granted if caller meets personhood level
///           5. Free track                → granted
///           6. Otherwise                 → denied
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
///         Storage: LibMusicAccess (owns), LibMusicRegistry (reads)
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

    // Active-release authorship and prior paid access are independent grants.
    if (listener == track.artist) return true;
    // A Classic purchase survives later mode changes for this same release/account.
    if (as_.paidAccess[contentHash][listener]) return true;

    // Free: everyone may listen; the policy is the whole gate.
    if (track.accessMode == LibMusicRegistry.AccessMode.Free) return true;

    if (track.accessMode == LibMusicRegistry.AccessMode.HumanFree) {
      return LibMusicAccess.hasRequiredPersonhood(as_, listener, track.requiredPersonhood);
    }

    // Unpaid Classic listeners have no grant.
    return false;
  }

  /// @notice Returns the recorded Classic payment grant, preserved across mode changes
  ///         and deactivation. Use musicAccCanAccess for current playable access.
  function musicAccHasPaid(bytes32 contentHash, address listener) external view returns (bool) {
    return LibMusicAccess.store().paidAccess[contentHash][listener];
  }

  /// @notice Returns the verified personhood level for `account`, read from the
  ///         Individuality precompile in Dotify's application context.
  /// @dev Returns None for unavailable, malformed or unsupported evidence.
  ///      The raw getter distinguishes a supported None from unusable evidence.
  function musicAccPersonhoodLevel(address account) external view returns (LibMusicRegistry.PersonhoodLevel) {
    (uint8 status, , bool live) = LibMusicAccess.personhoodOf(account);
    if (!live) return LibMusicRegistry.PersonhoodLevel.None;
    if (status == 1) return LibMusicRegistry.PersonhoodLevel.DIM1;
    if (status == 2) return LibMusicRegistry.PersonhoodLevel.DIM2;
    return LibMusicRegistry.PersonhoodLevel.None;
  }

  /// @notice Full personhood reading for `account`: tier, Dotify-context pseudonym, and
  ///         whether the response is supported and usable by this implementation.
  /// @dev `live == false` means unavailable/malformed evidence or an unsupported
  ///      uint8 tier (retained in status). Its alias is zero; this is not a claim
  ///      that the listener has no identity. `contextAlias` is the same
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
