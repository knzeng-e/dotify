import { afterEach, expect, it, vi } from 'vitest';
import { StandbyAudio } from './standbyAudio';

class FakeAudio extends EventTarget {
  error = null;
  readyState = 3;
  src = '';
  preload = '';
  crossOrigin = '';
  pause = vi.fn();
  play = vi.fn();
  load = vi.fn();
  removeAttribute() {
    this.src = '';
  }
}
afterEach(() => vi.unstubAllGlobals());

it('keeps preparation silent, transfers the exact ready node and separates cancellation lifetimes', async () => {
  vi.stubGlobal('Audio', FakeAudio);
  const standby = new StandbyAudio(),
    parent = new AbortController(),
    owner = new AbortController();
  let audio!: FakeAudio;
  await standby.prepare('identity', Date.now() + 30000, parent.signal, async (_signal, value) => {
    audio = value as unknown as FakeAudio;
    return 'blob:authorized';
  });
  expect(audio.play).not.toHaveBeenCalled();
  audio.dispatchEvent(new Event('canplay'));
  expect(standby.take('identity', owner.signal)).toBe('blob:authorized');
  parent.abort();
  expect(standby.adopt('blob:authorized')).toBe(audio);
  expect(audio.src).toBe('blob:authorized');
  owner.abort();
  expect(audio.pause).toHaveBeenCalled();
  expect(audio.src).toBe('');
});

it('rejects changed identities, expired or incomplete preparations and ignores late loads', async () => {
  vi.stubGlobal('Audio', FakeAudio);
  const standby = new StandbyAudio(),
    parent = new AbortController();
  let finish!: (url: string) => void;
  const pending = standby.prepare(
    'old',
    Date.now() + 30000,
    parent.signal,
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  parent.abort();
  finish('blob:late');
  await pending;
  expect(standby.take('old', new AbortController().signal)).toBeNull();
  await standby.prepare('current', Date.now() + 30000, new AbortController().signal, async () => 'blob:not-ready');
  expect(standby.take('other', new AbortController().signal)).toBeNull();
  expect(standby.adopt('blob:not-ready')).toBeNull();
});
