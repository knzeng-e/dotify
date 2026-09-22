import { expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { publishPlayerState } from './signalClient';

// Exercise Socket.IO's real volatile discard logic, with only the Engine.IO
// transport boundary replaced. No network or socket implementation mock.
function connectedSocket(writable: boolean) {
  const socket = io('http://localhost', { autoConnect: false, forceNew: true });
  socket.connected = true;
  Object.defineProperty(socket.io, 'engine', { value: { transport: { writable }, _hasPingExpired: () => false } });
  const packets = vi.spyOn(socket.io, '_packet').mockImplementation(() => undefined);
  return { socket, packets };
}

it('preserves a forced paused seek when the connected transport is not writable', () => {
  const { socket, packets } = connectedSocket(false);
  const state = { playing: false, currentTime: 42, duration: 60, updatedAt: 1 };
  publishPlayerState(socket, state, true);
  expect(packets).toHaveBeenCalledWith(expect.objectContaining({ data: ['player:state', state] }));
  expect(socket.sendBuffer).toHaveLength(0);
});

it('drops periodic samples under backpressure and sends the next writable sample', () => {
  const { socket, packets } = connectedSocket(false);
  const state = { playing: true, currentTime: 42, duration: 60, updatedAt: 1 };
  publishPlayerState(socket, state, false);
  expect(packets).not.toHaveBeenCalled();
  socket.io.engine.transport.writable = true;
  publishPlayerState(socket, { ...state, currentTime: 43 }, false);
  expect(packets).toHaveBeenCalledOnce();
});

it('does not buffer old transitions while disconnected', () => {
  const { socket, packets } = connectedSocket(false);
  socket.connected = false;
  const state = { playing: false, currentTime: 42, duration: 60, updatedAt: 1 };
  publishPlayerState(socket, state, true);
  publishPlayerState(socket, state, false);
  publishPlayerState(null, state, true);
  expect(packets).not.toHaveBeenCalled();
  expect(socket.sendBuffer).toHaveLength(0);
});
