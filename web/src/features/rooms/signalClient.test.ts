import { describe, expect, it, vi } from 'vitest';

const { ioMock } = vi.hoisted(() => ({
  ioMock: vi.fn((_url: string, _options: unknown) => ({ connected: false }))
}));

vi.mock('socket.io-client', () => ({
  io: ioMock
}));

import { createSignalClient, describeSignalConnectError, shouldUseStableSignalTransport, type SignalRuntime } from './signalClient';

const browserRuntime: SignalRuntime = {
  protocol: 'https:',
  embedded: false,
  hostWebView: false,
  hostApiPort: false
};

describe('createSignalClient', () => {
  it('uses fetch polling before the optional WebSocket transport', () => {
    createSignalClient('https://dotify-signal.fly.dev', browserRuntime);

    expect(ioMock).toHaveBeenCalledOnce();
    const [, options] = ioMock.mock.calls[0] as [string, { autoConnect: boolean; tryAllTransports: boolean; transports: Array<{ name: string }> }];
    expect(options).toMatchObject({
      autoConnect: false,
      tryAllTransports: true
    });
    expect(options.transports.map((transport: { name: string }) => transport.name)).toEqual(['Fetch', 'WS']);
  });

  it('stays on fetch polling inside a Product host container', () => {
    createSignalClient('https://dotify-signal.fly.dev', { ...browserRuntime, hostWebView: true });

    const [, options] = ioMock.mock.calls[ioMock.mock.calls.length - 1] as [
      string,
      { autoConnect: boolean; upgrade: boolean; transports: Array<{ name: string }> }
    ];
    expect(options).toMatchObject({
      autoConnect: false,
      upgrade: false
    });
    expect(options.transports.map((transport: { name: string }) => transport.name)).toEqual(['Fetch']);
  });
});

describe('shouldUseStableSignalTransport', () => {
  it('recognizes native, iframe, and injected Product host runtimes', () => {
    expect(shouldUseStableSignalTransport({ ...browserRuntime, protocol: 'polkadot:' })).toBe(true);
    expect(shouldUseStableSignalTransport({ ...browserRuntime, embedded: true })).toBe(true);
    expect(shouldUseStableSignalTransport({ ...browserRuntime, hostWebView: true })).toBe(true);
    expect(shouldUseStableSignalTransport({ ...browserRuntime, hostApiPort: true })).toBe(true);
    expect(shouldUseStableSignalTransport(browserRuntime)).toBe(false);
  });
});

describe('describeSignalConnectError', () => {
  it('keeps the useful transport and HTTP details for host diagnostics', () => {
    const error = Object.assign(new Error('fetch read error'), {
      description: 'Forbidden',
      context: { status: 403 }
    });

    expect(describeSignalConnectError(error)).toBe('fetch read error - Forbidden - HTTP 403');
  });
});
