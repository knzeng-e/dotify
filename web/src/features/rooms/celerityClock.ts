import type { RoomRealtimePort } from './roomRealtimePort';

export type CelerityClock = { at: number; server: string; offsetMs: number; uncertaintyMs: number };
export type ClockSample = CelerityClock & { monotonicAt: number };

export function measureRoomClock(port: RoomRealtimePort): Promise<ClockSample> {
  const socket = port.id;
  const sent = Date.now();
  const start = performance.now();
  return new Promise((resolve, reject) => {
    if (!socket || !port.connected) {
      reject(new Error('Room connection unavailable'));
      return;
    }
    port.request('room:realtime-clock', {}, { timeoutMs: 1500 }, (error, reply) => {
      const at = Date.now();
      const monotonicAt = performance.now();
      const elapsed = monotonicAt - start;
      if (error || !reply?.ok || port.id !== socket || !port.connected || !Number.isSafeInteger(reply.time) || !/^[a-f0-9]{32}$/.test(reply.server)) {
        reject(new Error('Room clock calibration unavailable'));
        return;
      }
      if (elapsed < 0 || elapsed > 1500 || Math.abs(at - sent - elapsed) > 25) {
        reject(new Error('Local clock changed during calibration'));
        return;
      }
      resolve({ at, monotonicAt, server: reply.server, offsetMs: reply.time - (sent + at) / 2, uncertaintyMs: elapsed / 2 + 26 });
    });
  });
}
