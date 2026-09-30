import { Fetch as EngineFetch, WebSocket as EngineWebSocket } from 'engine.io-client';
import { io, type Socket } from 'socket.io-client';
import type { PlayerState } from '../../shared/types';
import type { RoomRealtimePort, RoomRequests } from './roomRealtimePort';

export type SignalRuntime = {
  protocol: string;
  embedded: boolean;
  hostWebView: boolean;
  hostApiPort: boolean;
};

function detectSignalRuntime(): SignalRuntime {
  if (typeof window === 'undefined') {
    return { protocol: '', embedded: false, hostWebView: false, hostApiPort: false };
  }
  const hostWindow = window as Window & {
    __HOST_WEBVIEW_MARK__?: boolean;
    __HOST_API_PORT__?: MessagePort;
  };

  return {
    protocol: window.location.protocol,
    embedded: window.self !== window.top,
    hostWebView: hostWindow.__HOST_WEBVIEW_MARK__ === true,
    hostApiPort: hostWindow.__HOST_API_PORT__ != null
  };
}

export function shouldUseStableSignalTransport(runtime: SignalRuntime): boolean {
  return runtime.protocol === 'polkadot:' || runtime.embedded || runtime.hostWebView || runtime.hostApiPort;
}

/**
 * In the failing Product Mobile runtime, the fetch-based /health probe reached
 * signaling while Socket.IO's XMLHttpRequest polling did not. Engine.IO fetch
 * polling keeps both paths on the primitive observed to work. Product host
 * containers stay on that transport for the whole room because a WebSocket
 * upgrade can be accepted and then torn down by the native webview. Regular
 * browsers may still upgrade to WebSocket.
 */
export function createSignalClient(signalUrl: string, runtime: SignalRuntime = detectSignalRuntime()): Socket {
  if (shouldUseStableSignalTransport(runtime)) {
    return io(signalUrl, {
      autoConnect: false,
      transports: [EngineFetch],
      upgrade: false
    });
  }

  return io(signalUrl, {
    autoConnect: false,
    transports: [EngineFetch, EngineWebSocket],
    tryAllTransports: true
  });
}

/** Socket.IO is the sole authoritative adapter; Celerity observation cannot call this port. */
export function adaptSocketRealtime(socket: Socket): RoomRealtimePort {
  return {
    get id() {
      return socket.id;
    },
    get connected() {
      return socket.connected;
    },
    get transportName() {
      return socket.io.engine?.transport.name;
    },
    connect: () => {
      socket.connect();
    },
    disconnect: () => {
      socket.disconnect();
    },
    on: (event, handler) => {
      socket.on(event as string, handler as (...args: unknown[]) => void);
    },
    once: (event, handler) => {
      socket.once(event as string, handler as (...args: unknown[]) => void);
    },
    off: (event, handler) => {
      socket.off(event as string, handler as (...args: unknown[]) => void);
    },
    emit: (event, ...args) => {
      socket.emit(event, ...args);
    },
    emitVolatile: (event, ...args) => {
      socket.volatile.emit(event, ...args);
    },
    request: (event, input, options) =>
      new Promise((resolve, reject) => {
        const sender = socket.timeout(options.timeoutMs);
        (options.volatile ? sender.volatile : sender).emit(
          event,
          input,
          (error: Error | null, response: RoomRequests[typeof event]['output'] | null | undefined) => {
            if (error || response == null) reject(error ?? new Error('Room acknowledgement missing'));
            else resolve(response);
          }
        );
      })
  };
}

export function createRoomRealtime(signalUrl: string): RoomRealtimePort {
  return adaptSocketRealtime(createSignalClient(signalUrl));
}

export function describeSignalConnectError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const transportError = error as Error & {
    description?: unknown;
    context?: { status?: unknown };
  };
  const details = [
    transportError.message,
    typeof transportError.description === 'string' ? transportError.description : '',
    transportError.context?.status === undefined ? '' : `HTTP ${String(transportError.context.status)}`
  ].filter(Boolean);

  return [...new Set(details)].join(' - ');
}

/** Periodic samples may be dropped; explicit host transitions must survive backpressure. */
export function publishPlayerState(socket: Pick<RoomRealtimePort, 'connected' | 'emit' | 'emitVolatile'> | null, state: PlayerState, force: boolean): void {
  if (!socket?.connected) return;
  // Keep disconnected commands out of Socket.IO's reconnect buffer, but let
  // connected forced transitions wait for an occupied transport to drain.
  if (force) socket.emit('player:state', state);
  else socket.emitVolatile('player:state', state);
}
