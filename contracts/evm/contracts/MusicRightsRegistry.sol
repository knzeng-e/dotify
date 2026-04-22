// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import './LibDotify.sol';

/// @title MusicRightsRegistry
/// @notice Dotify registry for artist-owned track NFTs, access rules, and royalty settlement.
contract MusicRightsRegistry {
  struct Track {
    uint256 tokenId;
    address artist;
    string title;
    string artistName;
    string description;
    string imageRef;
    string audioRef;
    string metadataRef;
    string artistContractRef;
    uint16 royaltyBps;
    LibDotify.AccessMode accessMode;
    uint128 pricePlanck;
    LibDotify.PersonhoodLevel requiredPersonhood;
    uint256 registeredAtBlock;
    bool active;
  }

  struct RoyaltySplit {
    address recipient;
    uint16 bps;
  }

  struct TrackRegistration {
    bytes32 contentHash;
    string title;
    string artistName;
    string description;
    string imageRef;
    string audioRef;
    string metadataRef;
    string artistContractRef;
    LibDotify.AccessMode accessMode;
    uint128 pricePlanck;
    LibDotify.PersonhoodLevel requiredPersonhood;
  }

  address public personhoodRegistrar;
  uint256 public nextTokenId = 1;

  mapping(bytes32 => Track) private tracks;
  mapping(bytes32 => RoyaltySplit[]) private royaltySplits;
  mapping(bytes32 => mapping(address => bool)) public hasPaidAccess;
  mapping(uint256 => bytes32) public tokenContentHash;
  mapping(uint256 => address) public ownerOf;
  mapping(address => uint256) public balanceOf;
  mapping(address => LibDotify.PersonhoodLevel) public personhoodLevelOf;
  bytes32[] private trackHashes;

  event TrackRegistered(
    bytes32 indexed contentHash,
    uint256 indexed tokenId,
    address indexed artist,
    string title,
    LibDotify.AccessMode accessMode,
    uint128 pricePlanck,
    LibDotify.PersonhoodLevel requiredPersonhood
  );
  event TrackDeactivated(bytes32 indexed contentHash, address indexed artist);
  event TrackTransferred(uint256 indexed tokenId, address indexed from, address indexed to);
  event AccessPaid(bytes32 indexed contentHash, address indexed listener, uint256 amount);
  event HumanFreeListenRecorded(bytes32 indexed contentHash, address indexed listener, LibDotify.PersonhoodLevel requiredPersonhood);
  event PersonhoodRegistrarUpdated(address indexed previousRegistrar, address indexed nextRegistrar);
  event PersonhoodLevelUpdated(address indexed account, LibDotify.PersonhoodLevel level);
  event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

  modifier onlyRegistrar() {
    require(msg.sender == personhoodRegistrar, 'Not registrar');
    _;
  }

  constructor() {
    personhoodRegistrar = msg.sender;
  }

  function setPersonhoodRegistrar(address nextRegistrar) external onlyRegistrar {
    require(nextRegistrar != address(0), 'Invalid registrar');
    emit PersonhoodRegistrarUpdated(personhoodRegistrar, nextRegistrar);
    personhoodRegistrar = nextRegistrar;
  }

  function setPersonhoodLevel(address account, LibDotify.PersonhoodLevel level) external onlyRegistrar {
    require(account != address(0), 'Invalid account');
    personhoodLevelOf[account] = level;
    emit PersonhoodLevelUpdated(account, level);
  }

  function registerTrack(TrackRegistration calldata registration, address[] calldata recipients, uint16[] calldata bps) external {
    validateRegistration(registration);
    uint16 totalBps = storeRoyaltySplits(registration.contentHash, recipients, bps);
    uint256 tokenId = mintTrackToken(registration.contentHash, msg.sender);
    storeTrack(registration, totalBps, tokenId);
    emitTrackRegistered(registration.contentHash, registration.title, tokenId);
  }

  function deactivateTrack(bytes32 contentHash) external {
    Track storage track = tracks[contentHash];
    require(track.artist != address(0), 'Track not found');
    require(track.artist == msg.sender, 'Not artist');
    require(track.active, 'Inactive track');

    track.active = false;
    emit TrackDeactivated(contentHash, msg.sender);
  }

  function transferTrack(uint256 tokenId, address to) external {
    address from = ownerOf[tokenId];
    require(from == msg.sender, 'Not owner');
    require(to != address(0), 'Invalid recipient');

    bytes32 contentHash = tokenContentHash[tokenId];
    Track storage track = tracks[contentHash];
    require(track.active, 'Inactive track');
    if (track.accessMode == LibDotify.AccessMode.HumanFree) {
      require(hasRequiredPersonhood(to, track.requiredPersonhood), 'Recipient lacks personhood');
    }

    ownerOf[tokenId] = to;
    balanceOf[from] -= 1;
    balanceOf[to] += 1;

    emit Transfer(from, to, tokenId);
    emit TrackTransferred(tokenId, from, to);
  }

  function payForAccess(bytes32 contentHash) external payable {
    Track storage track = tracks[contentHash];
    require(track.artist != address(0), 'Track not found');
    require(track.active, 'Inactive track');
    require(track.accessMode == LibDotify.AccessMode.Classic, 'Not classic');
    require(msg.value >= track.pricePlanck, 'Insufficient payment');

    hasPaidAccess[contentHash][msg.sender] = true;
    distributeRoyalties(contentHash, track.artist, msg.value);

    emit AccessPaid(contentHash, msg.sender, msg.value);
  }

  function recordHumanFreeListen(bytes32 contentHash) external {
    Track storage track = tracks[contentHash];
    require(track.artist != address(0), 'Track not found');
    require(track.active, 'Inactive track');
    require(track.accessMode == LibDotify.AccessMode.HumanFree, 'Not human free');
    require(hasRequiredPersonhood(msg.sender, track.requiredPersonhood), 'Personhood required');

    emit HumanFreeListenRecorded(contentHash, msg.sender, track.requiredPersonhood);
  }

  function canAccess(bytes32 contentHash, address listener) external view returns (bool) {
    Track storage track = tracks[contentHash];
    if (!track.active) return false;
    if (track.artist == listener || ownerOf[track.tokenId] == listener) return true;
    if (track.accessMode == LibDotify.AccessMode.HumanFree) {
      return hasRequiredPersonhood(listener, track.requiredPersonhood);
    }
    return hasPaidAccess[contentHash][listener];
  }

  function hasPersonhood(address account, LibDotify.PersonhoodLevel requiredPersonhood) external view returns (bool) {
    return hasRequiredPersonhood(account, requiredPersonhood);
  }

  function getTrack(bytes32 contentHash) external view returns (Track memory track, address tokenOwner) {
    track = tracks[contentHash];
    tokenOwner = ownerOf[track.tokenId];
  }

  function getRoyaltySplitCount(bytes32 contentHash) external view returns (uint256) {
    return royaltySplits[contentHash].length;
  }

  function getRoyaltySplitAt(bytes32 contentHash, uint256 index) external view returns (address recipient, uint16 bps) {
    RoyaltySplit storage split = royaltySplits[contentHash][index];
    return (split.recipient, split.bps);
  }

  function getTrackCount() external view returns (uint256) {
    return trackHashes.length;
  }

  function getTrackHashAtIndex(uint256 index) external view returns (bytes32) {
    return trackHashes[index];
  }

  function getWorkCount() external view returns (uint256) {
    return trackHashes.length;
  }

  function getWorkHashAtIndex(uint256 index) external view returns (bytes32) {
    return trackHashes[index];
  }

  function validateRegistration(TrackRegistration calldata registration) private view {
    require(registration.contentHash != bytes32(0), 'Invalid hash');
    require(bytes(registration.title).length > 0, 'Missing title');
    require(bytes(registration.artistName).length > 0, 'Missing artist');
    require(bytes(registration.description).length > 0, 'Missing description');
    require(bytes(registration.imageRef).length > 0, 'Missing image');
    require(bytes(registration.audioRef).length > 0, 'Missing audio');
    require(bytes(registration.metadataRef).length > 0, 'Missing metadata');
    require(bytes(registration.artistContractRef).length > 0, 'Missing artist contract');
    require(tracks[registration.contentHash].artist == address(0), 'Already registered');
    require(registration.accessMode == LibDotify.AccessMode.HumanFree || registration.pricePlanck > 0, 'Missing price');
    require(registration.accessMode == LibDotify.AccessMode.Classic || registration.requiredPersonhood != LibDotify.PersonhoodLevel.None, 'Missing personhood');
  }

  function mintTrackToken(bytes32 contentHash, address to) private returns (uint256 tokenId) {
    tokenId = nextTokenId++;
    tokenContentHash[tokenId] = contentHash;
    ownerOf[tokenId] = to;
    balanceOf[to] += 1;
    trackHashes.push(contentHash);
    emit Transfer(address(0), to, tokenId);
  }

  function storeTrack(TrackRegistration calldata registration, uint16 totalBps, uint256 tokenId) private {
    Track storage track = tracks[registration.contentHash];
    track.tokenId = tokenId;
    track.artist = msg.sender;
    track.title = registration.title;
    track.artistName = registration.artistName;
    track.description = registration.description;
    track.imageRef = registration.imageRef;
    track.audioRef = registration.audioRef;
    track.metadataRef = registration.metadataRef;
    track.artistContractRef = registration.artistContractRef;
    track.royaltyBps = totalBps;
    track.accessMode = registration.accessMode;
    track.pricePlanck = registration.accessMode == LibDotify.AccessMode.Classic ? registration.pricePlanck : 0;
    track.requiredPersonhood = registration.accessMode == LibDotify.AccessMode.HumanFree ? registration.requiredPersonhood : LibDotify.PersonhoodLevel.None;
    track.registeredAtBlock = block.number;
    track.active = true;
  }

  function emitTrackRegistered(bytes32 contentHash, string calldata title, uint256 tokenId) private {
    Track storage track = tracks[contentHash];
    emit TrackRegistered(contentHash, tokenId, track.artist, title, track.accessMode, track.pricePlanck, track.requiredPersonhood);
  }

  function storeRoyaltySplits(bytes32 contentHash, address[] calldata recipients, uint16[] calldata bps) private returns (uint16 totalBps) {
    require(recipients.length > 0, 'Missing royalties');
    require(recipients.length == bps.length, 'Royalty mismatch');

    for (uint256 index = 0; index < recipients.length; index += 1) {
      require(recipients[index] != address(0), 'Invalid recipient');
      require(bps[index] > 0, 'Invalid split');
      totalBps += bps[index];
      require(totalBps <= 10_000, 'Royalty overflow');
      royaltySplits[contentHash].push(RoyaltySplit({ recipient: recipients[index], bps: bps[index] }));
    }
  }

  function distributeRoyalties(bytes32 contentHash, address artist, uint256 amount) private {
    uint256 distributed = 0;
    RoyaltySplit[] storage splits = royaltySplits[contentHash];

    for (uint256 index = 0; index < splits.length; index += 1) {
      uint256 share = (amount * splits[index].bps) / 10_000;
      distributed += share;
      transferNative(splits[index].recipient, share);
    }

    if (amount > distributed) {
      transferNative(artist, amount - distributed);
    }
  }

  function transferNative(address recipient, uint256 amount) private {
    if (amount == 0) return;

    (bool sent, ) = payable(recipient).call{ value: amount }('');
    require(sent, 'Payment failed');
  }

  function hasRequiredPersonhood(address account, LibDotify.PersonhoodLevel requiredPersonhood) private view returns (bool) {
    if (requiredPersonhood == LibDotify.PersonhoodLevel.None) return true;
    return uint8(personhoodLevelOf[account]) >= uint8(requiredPersonhood);
  }
}
