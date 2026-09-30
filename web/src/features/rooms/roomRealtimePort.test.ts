import { describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { adaptSocketRealtime } from './signalClient';

function setup(writable = true) {
  const socket = io('http://localhost', { autoConnect: false, forceNew: true });
  socket.connected = true;
  Object.defineProperty(socket.io, 'engine', { value: { transport: { name: 'polling', writable }, _hasPingExpired: () => false } });
  const packet = vi.spyOn(socket.io, '_packet').mockImplementation(() => undefined);
  return { socket, packet, port: adaptSocketRealtime(socket) };
}

describe('Socket.IO realtime port', () => {
  it('preserves ack success and does not reinterpret application denials', async () => {
    const { socket, port } = setup();
    const result = port.request('room:join', { roomId: 'ABC123', displayName: 'Guest' }, { timeoutMs: 100 });
    Reflect.get(socket, 'acks')[0](null, { ok: false, error: 'Room full' });
    expect(await result).toEqual({ ok: false, error: 'Room full' });
    expect(port.transportName).toBe('polling');
  });

  it('times out dropped volatile text without buffering an automatic resend', async () => {
    const { socket, packet, port } = setup(false);
    const result = port.request('room:chat', { text: 'Hello' }, { timeoutMs: 5, volatile: true });
    await expect(result).rejects.toThrow();
    expect(packet).not.toHaveBeenCalled();
    expect(socket.sendBuffer).toHaveLength(0);
  });

  it('treats an empty acknowledgement as unconfirmed delivery', async () => {
    const { socket, port } = setup();
    const result = port.request('room:chat', { text: 'Hello' }, { timeoutMs: 100 });
    Reflect.get(socket, 'acks')[0](null, null);
    await expect(result).rejects.toThrow('Room acknowledgement missing');
  });

  it('unsubscribes and keeps latest full snapshots on the authoritative path', () => {
    const { socket, port } = setup();
    const onLineup = vi.fn();
    port.on('room:lineup', onLineup);
    // Deliberately missing an intermediate snapshot does not require applying deltas.
    socket.listeners('room:lineup').forEach(handler => handler([{ trackId: 'newest' }]));
    expect(onLineup).toHaveBeenLastCalledWith([{ trackId: 'newest' }]);
    port.off('room:lineup', onLineup);
    socket.listeners('room:lineup').forEach(handler => handler([]));
    expect(onLineup).toHaveBeenCalledOnce();
  });
});
