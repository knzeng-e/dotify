import { beforeEach, expect, it, vi } from 'vitest';
import { useHostTipBinding } from './useHostTipBinding';
import type { ConnectedWallet } from '../../hooks/useWallet';
import type { RoomRealtimePort } from '../rooms/roomRealtimePort';

const harness = vi.hoisted(() => ({ cleanup: undefined as undefined | (() => void), setState: vi.fn(), ensure: vi.fn(), getWallet: vi.fn(), clear: vi.fn() }));
vi.mock('react', () => ({
  useEffect: (run: () => (() => void) | undefined) => {
    harness.cleanup = run();
  },
  useLayoutEffect: (run: () => void) => run(),
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [value, harness.setState]
}));
vi.mock('../../services/keyService', () => ({
  clearStoredSession: harness.clear,
  ensureDotifySessionForSigner: harness.ensure,
  ensureDotifySession: harness.ensure
}));
const account = '0x0000000000000000000000000000000000000001';
const signer = { address: account, signMessage: vi.fn() };
const wallet = { method: 'product-host', evmAddress: account, keyRequestSigner: signer } as unknown as ConnectedWallet;
const request = vi.fn((_event, _payload, _options, callback) => callback(null, { ok: true }));
const socket = { id: 'socket', connected: true, request } as unknown as RoomRealtimePort;
const input = { mode: 'host', roomId: 'room', socketStatus: 'online', socket, wallet, chainId: 42, getWallet: harness.getWallet };
beforeEach(() => {
  vi.clearAllMocks();
  harness.ensure.mockResolvedValue('exact-token');
  harness.cleanup = undefined;
});
it('binds a connected Product host automatically using its exact signing identity', async () => {
  useHostTipBinding(input);
  await vi.waitFor(() => expect(request).toHaveBeenLastCalledWith('room:tip-bind', { token: 'exact-token' }, expect.anything(), expect.any(Function)));
  expect(harness.ensure).toHaveBeenCalledWith(signer, 42);
  expect(harness.getWallet).not.toHaveBeenCalled();
});
it('never binds a late token after the account/room effect was cancelled', async () => {
  let resolve!: (value: string) => void;
  harness.ensure.mockReturnValue(
    new Promise<string>(done => {
      resolve = done;
    })
  );
  useHostTipBinding(input);
  harness.cleanup?.();
  useHostTipBinding({ ...input, wallet: null });
  resolve('old-token');
  await Promise.resolve();
  expect(request.mock.calls.every(call => call[1].token === '')).toBe(true);
});
it('clears an unconnected recipient without prompting a wallet or binding guests', () => {
  useHostTipBinding({ ...input, wallet: null });
  expect(harness.ensure).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
  useHostTipBinding({ ...input, mode: 'listener' });
  expect(request).toHaveBeenCalledTimes(1);
});

it('renews a rejected cached session once and binds the fresh identity', async () => {
  let count = 0;
  const renewalSocket = {
    ...socket,
    request: vi.fn((_event, payload, _opts, callback) => {
      if (!payload.token) callback(null, { ok: true });
      else callback(null, ++count === 1 ? { ok: false, code: 'SESSION_INVALID' } : { ok: true });
    })
  } as unknown as RoomRealtimePort;
  harness.ensure.mockResolvedValueOnce('expired').mockResolvedValueOnce('fresh');
  useHostTipBinding({ ...input, socket: renewalSocket });
  await vi.waitFor(() => expect(harness.ensure).toHaveBeenCalledTimes(2));
  expect(harness.clear).toHaveBeenCalledWith(account, 'expired');
  await vi.waitFor(() => expect(harness.setState).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ready' })));
});
it('does not renew identity on a service outage', async () => {
  const failedSocket = {
    ...socket,
    request: vi.fn((_event, payload, _opts, callback) => callback(null, payload.token ? { ok: false, error: 'Temporarily unavailable' } : { ok: true }))
  } as unknown as RoomRealtimePort;
  useHostTipBinding({ ...input, socket: failedSocket });
  await vi.waitFor(() => expect(harness.setState).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'unavailable' })));
  expect(harness.ensure).toHaveBeenCalledOnce();
  expect(harness.clear).not.toHaveBeenCalled();
});
