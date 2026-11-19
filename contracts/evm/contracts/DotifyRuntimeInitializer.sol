// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

import { LibDiamond } from './libraries/LibDiamond.sol';
import { LibMusicAccess } from './libraries/LibMusicAccess.sol';
import { LibRuntimeArtist } from './libraries/LibRuntimeArtist.sol';

/// @notice One-time creation finalizer. Factory completion is initiated by the
/// bound artist's signed installRuntimeStep, before directory publication.
/// Subsequent administration changes use OwnershipPallet's pending/accept flow.
contract DotifyRuntimeInitializer {
  function initialize() external {
    _finish(LibRuntimeArtist.store().artist);
  }

  function initializeFor(address artist) external {
    _finish(artist);
  }

  function _finish(address artist) private {
    require(artist != address(0) && artist == LibRuntimeArtist.store().artist, 'RuntimeArtist: bootstrap identity mismatch');
    require(!LibRuntimeArtist.store().ready, 'RuntimeArtist: bootstrap complete');
    LibMusicAccess.setPersonhoodRegistrar(LibMusicAccess.store(), artist);
    LibRuntimeArtist.store().ready = true;
    LibDiamond.setContractOwner(artist);
  }
}
