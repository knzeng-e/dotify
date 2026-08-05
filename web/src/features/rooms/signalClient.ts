import { Fetch as EngineFetch, WebSocket as EngineWebSocket } from 'engine.io-client';
import { io, type Socket } from 'socket.io-client';

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
