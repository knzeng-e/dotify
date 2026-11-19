// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

/// @notice Artist identity and publication readiness, separate from upgrade ownership.
/// Owner-controlled delegatecall upgrades remain a trust boundary; this storage
/// is stable under the reviewed API, not protected against arbitrary owner code.
library LibRuntimeArtist {
  bytes32 constant POSITION = keccak256('dotify.runtime.artist.storage');

  struct Store {
    address artist;
    bool ready;
  }

  function store() internal pure returns (Store storage s) {
    bytes32 position = POSITION;
    assembly {
      s.slot := position
    }
  }

  function initialize(address artist) internal {
    require(artist != address(0) && artist != address(this), 'RuntimeArtist: invalid artist');
    require(store().artist == address(0), 'RuntimeArtist: already initialized');
    store().artist = artist;
  }

  function requireReady() internal view {
    require(store().ready, 'RuntimeArtist: bootstrap pending');
  }

  function enforceArtist() internal view {
    requireReady();
    require(msg.sender == store().artist, 'RuntimeArtist: not artist');
  }
}
