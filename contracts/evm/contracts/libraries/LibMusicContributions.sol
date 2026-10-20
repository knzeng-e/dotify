// SPDX-License-Identifier: GPL-3.0-only WITH Classpath-exception-2.0
pragma solidity ^0.8.28;

library LibMusicContributions {
  bytes32 constant SLOT = keccak256('dotify.music.contributions.v1');
  struct Policy {
    uint64 version;
    uint64 startsAt;
    uint64 endsAt;
    uint16 hostBps;
    address roomAttestor;
    bytes32 campaign;
    string description;
    address[] recipients;
    uint16[] shares;
  }
  struct Store {
    mapping(bytes32 => Policy) policies;
    mapping(address => mapping(bytes32 => bool)) used;
    mapping(bytes32 => mapping(address => uint256)) pending;
  }
  function store() internal pure returns (Store storage s) {
    bytes32 slot = SLOT;
    assembly {
      s.slot := slot
    }
  }
}
