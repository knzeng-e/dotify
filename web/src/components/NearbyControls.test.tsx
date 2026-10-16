import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { NearbyControls } from './NearbyControls';
import { NearbySession } from '../features/rooms/nearbySession';
import type { RoomRealtimePort } from '../features/rooms/roomRealtimePort';

afterEach(() => vi.useRealTimers());

it('keeps the compact host control unconfirmed until the server removes its invitation', async () => {
  vi.useFakeTimers();
  let acknowledgeRemoval!: () => void;
  const port = {
    connected: true,
    request: (event: string, _input: unknown, _options: unknown, done: (error: null, reply: unknown) => void) => {
      if (event === 'nearby:off') acknowledgeRemoval = () => done(null, { ok: true });
      else done(null, { ok: true, expiresInMs: 90_000 });
    }
  } as unknown as RoomRealtimePort;
  const session = new NearbySession(port, true, true, {
    visible: () => true,
    supported: () => true,
    locate: async () => {
      throw new Error('Worldwide must not read location');
    },
    permission: async () => null
  });
  await session.start({ kind: 'worldwide' }, 5);
  session.stop();
  const render = () => renderToStaticMarkup(<NearbyControls nearby={{ session, state: session.snapshot() }} />);
  const pending = render();
  expect(pending).toContain('Updating visibility…');
  expect(pending).toContain('90 seconds');
  expect(pending).not.toContain('>Link only<');
  acknowledgeRemoval();
  await Promise.resolve();
  const confirmed = render();
  expect(confirmed).toContain('>Link only<');
  expect(confirmed).toContain('no longer visible worldwide');
  expect(confirmed).not.toContain('90 seconds');
  expect(vi.getTimerCount()).toBe(0);
});
