export type Mode = 'host' | 'listener';
export type PersonhoodLevel = 'DIM1' | 'DIM2';
export type View = 'listen' | 'player' | 'rooms' | 'you';
export type AccessMode = 'human-free' | 'classic' | 'free';
export type SocketStatus = 'offline' | 'connecting' | 'online' | 'error';
export type PeerStatus = 'waiting' | 'connecting' | 'connected' | 'disconnected';
export type SessionAction = 'idle' | 'creating' | 'joining';
export type AssetAction = 'idle' | 'audio' | 'cover';
export type ArtistTab = 'overview' | 'new' | 'releases' | 'royalties' | 'advanced';
export type ReleaseStep = 'assets' | 'metadata' | 'access' | 'review';
export type TransactionFeedbackTone = 'pending' | 'success' | 'error';

export type RoyaltySplit = {
  label: string;
  recipient: `0x${string}`;
  bps: number;
};

export type TrackInfo = {
  title: string;
  artist: string;
  duration: number;
  updatedAt: number;
  imageRef?: string;
  audioRef?: string;
  priceDot?: string;
  bulletinRef: string;
  metadataRef?: string;
  description?: string;
  accessMode?: AccessMode;
  hash: `0x${string}` | '';
  personhoodLevel?: PersonhoodLevel;
};

export type PlayerState = {
  playing: boolean;
  duration: number;
  updatedAt: number;
  currentTime: number;
};

export type ListenerRecord = {
  id: string;
  status: PeerStatus;
  displayName: string;
};

export type CatalogTrack = {
  id: string;
  zone: string;
  title: string;
  artist: string;
  artistAddress?: `0x${string}`;
  audioRef: string;
  imageRef: string;
  priceDot: string;
  localUrl?: string;
  duration?: number;
  hash: `0x${string}`;
  description: string;
  bulletinRef: string;
  metadataRef: string;
  royaltyBps: number;
  txHash?: `0x${string}`;
  durationLabel: string;
  accessMode: AccessMode;
  source: 'seed' | 'artist';
  royaltySplits: RoyaltySplit[];
  personhoodLevel: PersonhoodLevel;
  encrypted: boolean;
  registeredAtBlock?: number;
};

export type OnchainTrackRecord = {
  artist: `0x${string}`;
  tokenId: bigint;
  title: string;
  artistName: string;
  description: string;
  imageRef: string;
  audioRef: string;
  metadataRef: string;
  artistContractRef: string;
  royaltyBps: number;
  accessMode: number;
  pricePlanck: bigint;
  requiredPersonhood: number;
  registeredAtBlock: bigint;
  active: boolean;
};

export type RegistryCatalogTrack = CatalogTrack & {
  artistAddress: `0x${string}`;
  registeredAtBlock: number;
};

export type RoomPlaybackMode = 'full' | 'preview';

export type OpenRoom = {
  roomId: string;
  title?: string;
  hostName: string;
  hostAddress?: string | null;
  createdAt: number;
  expiresAt?: number;
  listenerCount: number;
  track: TrackInfo | null;
  playerState: PlayerState | null;
  // Host-based room access doctrine: the HOST satisfies the track policy;
  // listeners never need wallet access to listen inside a room.
  playbackMode?: RoomPlaybackMode;
  hostAccessRequired?: boolean;
  listenersNeedWalletAccess?: false;
};

export type CreateRoomResponse = { ok: true; roomId: string; hostName: string; expiresAt?: number } | { ok: false; error: string };

// Social layer message shapes. Deliberately transport-agnostic: nothing in
// here knows about sockets, so a Statement Store presence layer can adopt
// the same shapes later (see docs/backlog/20-room-social-layer.md).
export type RoomChatMessage = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  ts: number;
};

export type RoomReactionEvent = {
  id: string;
  emoji: string;
  senderId: string;
  senderName: string;
  ts: number;
};

// A collaborative request: a participant proposes a track to hear next. Text
// intent, attributed to a real display name; the host vetoes or clears.
// Transport-agnostic like the other social shapes.
export type RoomRequest = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  ts: number;
};

export type JoinRoomResponse =
  | {
      ok: true;
      roomId: string;
      hostId: string;
      hostName: string;
      listenerCount: number;
      track: TrackInfo | null;
      playerState: PlayerState | null;
      playbackMode?: RoomPlaybackMode;
      chatHistory?: RoomChatMessage[];
      requests?: RoomRequest[];
      expiresAt?: number;
    }
  | { ok: false; error: string; code?: string };

export type CapturableMediaElement = HTMLMediaElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

export type TransactionFeedback = {
  tone: TransactionFeedbackTone;
  title: string;
  message: string;
  txHash?: `0x${string}`;
};

export type AccessGate = {
  track: CatalogTrack;
  title: string;
  message: string;
  hint: string;
  actionType: 'personhood' | 'payment' | 'signin';
};

export type RoyaltyPayment = {
  id: string;
  trackHash: `0x${string}`;
  trackTitle: string;
  listener: `0x${string}`;
  amountWei: bigint;
  amountDot: string;
  paidAtMs: number | null;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
  logIndex: number;
};
