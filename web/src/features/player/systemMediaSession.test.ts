import { expect, it, vi } from 'vitest';
import { bindMediaSession } from './systemMediaSession';

it('binds idempotent actions, absolute/relative seeking, and cleans every handler', () => {
  const handlers = new Map<string, MediaSessionActionHandler | null>();
  const session = { setActionHandler: (key: string, handler: MediaSessionActionHandler | null) => handlers.set(key, handler) } as unknown as MediaSession;
  const play = vi.fn(),
    pause = vi.fn(),
    next = vi.fn(),
    seek = vi.fn();
  const clear = bindMediaSession(session, { play, pause, next, seek, position: () => 40 });
  handlers.get('play')!({ action: 'play' });
  handlers.get('pause')!({ action: 'pause' });
  handlers.get('nexttrack')!({ action: 'nexttrack' });
  handlers.get('seekto')!({ action: 'seekto', seekTime: 12 });
  handlers.get('seekbackward')!({ action: 'seekbackward', seekOffset: 5 });
  expect(play).toHaveBeenCalledOnce();
  expect(pause).toHaveBeenCalledOnce();
  expect(next).toHaveBeenCalledOnce();
  expect(seek.mock.calls).toEqual([[12], [35]]);
  clear();
  expect([...handlers.values()].every(value => value === null)).toBe(true);
});

it('does not offer guest skip/seek and tolerates partially implemented Hosts', () => {
  const setActionHandler = vi.fn((action: string) => {
    if (action === 'seekto') throw new Error('unsupported');
  });
  const clear = bindMediaSession({ setActionHandler } as unknown as MediaSession, { play: vi.fn(), pause: vi.fn(), position: () => 0 });
  expect(setActionHandler).toHaveBeenCalledWith('nexttrack', null);
  expect(setActionHandler).toHaveBeenCalledWith('seekforward', null);
  expect(() => clear()).not.toThrow();
});
