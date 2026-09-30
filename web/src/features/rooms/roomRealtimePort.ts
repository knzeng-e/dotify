import type {
  CreateRoomResponse,
  JoinRoomResponse,
  ResumeRoomResponse,
  TurnCapabilityResponse,
  OpenRoom,
  TrackInfo,
  PlayerState,
  RoomPlaybackMode,
  RoomLineupItem,
  RoomPresenceListener,
  RoomChatMessage,
  RoomReactionEvent,
  RoomRequest
} from '../../shared/types';
import type { RealtimeRegistration, RealtimeRoster } from './celerityPrivateTypes';

type ListenerJoined = { listenerId: string; displayName: string; listenerCount: number };

export type RoomIncomingEvents = {
  'room:realtime-roster': [roster: RealtimeRoster];
  connect: [];
  disconnect: [reason: string];
  connect_error: [error: Error];
  'rooms:updated': [rooms: OpenRoom[]];
  'presence:solo:updated': [counts: unknown];
  'listener:joined': [listener: ListenerJoined];
  'listener:ready': [listener: ListenerJoined];
  'listener:left': [listener: { listenerId: string; listenerCount: number }];
  'listener:renamed': [listener: { listenerId: string; displayName: string }];
  'room:listeners': [roster: { listenerCount: number; listeners: RoomPresenceListener[] }];
  'host:renamed': [host: { displayName: string }];
  'room:listener-count': [count: { listenerCount: number }];
  'room:track': [track: TrackInfo | null];
  'room:lineup': [lineup: RoomLineupItem[]];
  'player:state': [state: PlayerState | null];
  'room:playback-mode': [mode: { playbackMode?: RoomPlaybackMode }];
  'room:closed': [reason: { reason?: string }];
  'room:host-connection': [state: { status?: string }];
  'webrtc:offer': [offer: { from: string; offer: RTCSessionDescriptionInit }];
  'webrtc:answer': [answer: { from: string; answer: RTCSessionDescriptionInit }];
  'webrtc:ice-candidate': [ice: { from: string; candidate: RTCIceCandidateInit }];
  'peer:connected': [peer: { from: string }];
  'room:stream-ready': [];
  'room:chat': [message: RoomChatMessage];
  'room:reaction': [reaction: RoomReactionEvent];
  'room:requests': [requests: RoomRequest[]];
};

export type RoomOutgoingEvents = {
  'room:realtime-unregister': [membership: { scope: string; self: string }];
  'rooms:list': [reply: (rooms: OpenRoom[]) => void];
  'presence:solo': [presence: { trackHash: string | null }];
  'room:leave': [];
  'host:heartbeat': [];
  'listener:ready': [];
  'room:track': [track: TrackInfo | null];
  'room:lineup': [lineup: RoomLineupItem[]];
  'player:state': [state: PlayerState];
  'room:playback-mode': [mode: { playbackMode: RoomPlaybackMode }];
  'room:stream-ready': [];
  'room:reaction': [reaction: { emoji: string }];
  'room:request:remove': [request: { id: string }];
  'room:request:clear': [];
  'webrtc:offer': [offer: { targetId: string; offer: RTCSessionDescriptionInit }];
  'webrtc:answer': [answer: { targetId: string; answer: RTCSessionDescriptionInit | null }];
  'webrtc:ice-candidate': [ice: { targetId: string; candidate: RTCIceCandidateInit }];
  'peer:connected': [peer: { targetId: string }];
  'webrtc:diagnostic': [diagnostic: Record<string, unknown>];
};

export type RoomRequests = {
  'room:realtime-register': { input: { publicKey: string }; output: RealtimeRegistration };
  'room:create': { input: { displayName: string; track: TrackInfo | null; playbackMode: RoomPlaybackMode }; output: CreateRoomResponse };
  'room:join': { input: { roomId: string; displayName: string }; output: JoinRoomResponse };
  'room:resume': { input: { roomId: string; hostResumeToken: string }; output: ResumeRoomResponse };
  'room:turn-capability': { input: Record<string, never>; output: TurnCapabilityResponse };
  'room:rename': { input: { displayName: string }; output: { ok: boolean; displayName?: string; error?: string } };
  'room:chat': { input: { text: string }; output: { ok?: boolean; message?: string } };
  'room:request': { input: { text: string }; output: { ok?: boolean; message?: string } };
};

/** The event transport owns no media peers, access keys or room authority. */
export interface RoomRealtimePort {
  readonly id: string | undefined;
  readonly connected: boolean;
  readonly transportName: string | undefined;
  connect(): void;
  disconnect(): void;
  on<K extends keyof RoomIncomingEvents>(event: K, handler: (...args: RoomIncomingEvents[K]) => void): void;
  once<K extends keyof RoomIncomingEvents>(event: K, handler: (...args: RoomIncomingEvents[K]) => void): void;
  off<K extends keyof RoomIncomingEvents>(event: K, handler: (...args: RoomIncomingEvents[K]) => void): void;
  emit<K extends keyof RoomOutgoingEvents>(event: K, ...args: RoomOutgoingEvents[K]): void;
  emitVolatile<K extends keyof RoomOutgoingEvents>(event: K, ...args: RoomOutgoingEvents[K]): void;
  request<K extends keyof RoomRequests>(
    event: K,
    input: RoomRequests[K]['input'],
    options: { timeoutMs: number; volatile?: boolean },
    reply: (error: Error | null, response: RoomRequests[K]['output'] | undefined) => void
  ): void;
}

export type RoomTrackEmitter = <K extends 'room:track' | 'room:playback-mode'>(event: K, ...args: RoomOutgoingEvents[K]) => void;
