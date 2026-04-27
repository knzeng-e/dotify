// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ArtistDirectory
/// @notice Global on-chain index: artist address → their SmartRuntime address.
///
///         Only the registered factory can write to this directory, preventing
///         spurious registrations.  The factory address is set once by the
///         deployer after both contracts are deployed.
///
///         Anyone can query the directory to discover an artist's runtime without
///         relying on off-chain data.
contract ArtistDirectory {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  address public immutable deployer;
  address public factory;

  mapping(address => address) public runtimeOf; // artist → SmartRuntime
  address[] private _artists;

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  event FactorySet(address indexed factory);
  event ArtistRegistered(address indexed artist, address indexed runtime);

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  constructor() payable {
    deployer = msg.sender;
  }

  // -------------------------------------------------------------------------
  // Admin — wire the factory (once)
  // -------------------------------------------------------------------------

  /// @notice Set the factory address that is authorised to register artists.
  ///         Can only be called once by the original deployer.
  function setFactory(address _factory) external payable {
    require(msg.sender == deployer, 'Directory: not deployer');
    require(factory == address(0), 'Directory: factory already set');
    require(_factory != address(0), 'Directory: zero address');
    factory = _factory;
    emit FactorySet(_factory);
  }

  // -------------------------------------------------------------------------
  // Write (factory only)
  // -------------------------------------------------------------------------

  /// @notice Register an artist → runtime mapping.  Called by the factory.
  function register(address artist, address runtime) external payable {
    require(msg.sender == factory, 'Directory: only factory');
    require(runtimeOf[artist] == address(0), 'Directory: already registered');
    runtimeOf[artist] = runtime;
    _artists.push(artist);
    emit ArtistRegistered(artist, runtime);
  }

  // -------------------------------------------------------------------------
  // View
  // -------------------------------------------------------------------------

  function artistCount() external view returns (uint256) {
    return _artists.length;
  }

  function artistAtIndex(uint256 index) external view returns (address) {
    return _artists[index];
  }

  /// @notice Returns (artists[], runtimes[]) slices for pagination.
  function artistsPage(uint256 offset, uint256 limit) external view returns (address[] memory artists, address[] memory runtimes) {
    uint256 total = _artists.length;
    if (offset >= total) return (new address[](0), new address[](0));
    uint256 end = offset + limit > total ? total : offset + limit;
    uint256 len = end - offset;
    artists = new address[](len);
    runtimes = new address[](len);
    for (uint256 i; i < len; i++) {
      artists[i] = _artists[offset + i];
      runtimes[i] = runtimeOf[_artists[offset + i]];
    }
  }
}
