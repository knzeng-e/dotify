// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

/// @notice UTF-8 byte limits, not character counts. Constants occupy no storage.
library LibMusicBounds {
  uint256 internal constant TITLE_BYTES = 800;
  uint256 internal constant ARTIST_BYTES = 800;
  uint256 internal constant DESCRIPTION_BYTES = 8000;
  uint256 internal constant REFERENCE_BYTES = 512;
  uint256 internal constant SPLIT_RECIPIENTS = 16;
  uint256 internal constant TRACK_PAGE_SIZE = 100;
}
