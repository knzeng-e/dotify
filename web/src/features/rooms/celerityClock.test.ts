import { afterEach, expect, it, vi } from 'vitest';
import { measureRoomClock } from './celerityClock';
import type { RoomRealtimePort } from './roomRealtimePort';

afterEach(() => vi.restoreAllMocks());
it('estimates offset with a round-trip uncertainty bound through admitted Socket.IO', async () => {
  vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValue(1100);
  vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(100);
  const request = vi.fn((_event, _input, _options, ack) => ack(null, { ok: true, time: 1200, server: 'a'.repeat(32) }));
  const clock = await measureRoomClock({ id: 'socket', connected: true, request } as unknown as RoomRealtimePort);
  expect(clock).toMatchObject({ at: 1100, offsetMs: 150, uncertaintyMs: 76 });
  expect(request).toHaveBeenCalledWith('room:realtime-clock', {}, { timeoutMs: 1500 }, expect.any(Function));
});

it('rejects connection replacement, missing replies and wall-clock jumps', async () => {
  vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValue(3000);
  vi.spyOn(performance, 'now').mockReturnValue(100);
  const port = {
    id: 'socket',
    connected: true,
    request: vi.fn((_event, _input, _options, ack) => ack(null, { ok: true, time: 1200, server: 'a'.repeat(32) }))
  };
  await expect(measureRoomClock(port as unknown as RoomRealtimePort)).rejects.toThrow('clock changed');
  port.request.mockImplementation((_event, _input, _options, ack) => {
    port.id = 'replacement';
    ack(null, { ok: true, time: 1200, server: 'a'.repeat(32) });
  });
  await expect(measureRoomClock(port as unknown as RoomRealtimePort)).rejects.toThrow('unavailable');
  port.request.mockImplementation((_event, _input, _options, ack) => ack(null, { ok: false }));
  await expect(measureRoomClock(port as unknown as RoomRealtimePort)).rejects.toThrow('unavailable');
  port.connected = false;
  await expect(measureRoomClock(port as unknown as RoomRealtimePort)).rejects.toThrow('unavailable');
});
