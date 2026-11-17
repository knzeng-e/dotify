import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { audioOutputObservations, bindAudioOutputLifecycle, clearAudioOutputObservations } from './audioOutputLifecycle';

class OutputContext extends EventTarget {
  state = 'running';
  currentTime = 12;
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  change(state: string) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}
class Media extends EventTarget {
  paused = false;
  ended = false;
  currentTime = 9;
  readyState = 4;
  pause = vi.fn(() => {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  });
}
let disposers: Array<() => void> = [];
beforeEach(() => {
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { audioSession: { type: 'auto', state: 'active' } });
  clearAudioOutputObservations();
});
afterEach(() => {
  disposers.forEach(dispose => dispose());
  disposers = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function setup() {
  const audio = new Media(),
    context = new OutputContext(),
    silence = vi.fn();
  const lifecycle = bindAudioOutputLifecycle(audio as unknown as HTMLMediaElement, context as unknown as AudioContext, silence);
  disposers.push(lifecycle.release);
  return { audio, context, silence, lifecycle };
}
it('requests playback policy and restores it only after the last output retires', () => {
  const one = setup(),
    two = setup();
  const session = Reflect.get(navigator, 'audioSession');
  expect(session.type).toBe('playback');
  one.lifecycle.release();
  expect(session.type).toBe('playback');
  two.lifecycle.release();
  expect(session.type).toBe('auto');
});
it('freezes an advancing media clock when the running shared output is interrupted', () => {
  const { audio, context, silence } = setup();
  const interrupted = vi.fn();
  audio.addEventListener('dotify:output-interrupted', interrupted);
  context.change('interrupted');
  expect(audio.paused).toBe(true);
  expect(audio.currentTime).toBe(9);
  expect(silence).toHaveBeenCalledOnce();
  expect(interrupted).toHaveBeenCalledOnce();
  context.change('running');
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('pageshow'));
  expect(context.resume).not.toHaveBeenCalled();
  expect(audio.paused).toBe(true);
});
it('never converts a voluntary pause into playback or a new interruption', () => {
  const { audio, context } = setup();
  audio.pause();
  const interrupted = vi.fn();
  audio.addEventListener('dotify:output-interrupted', interrupted);
  context.change('suspended');
  context.change('running');
  expect(interrupted).not.toHaveBeenCalled();
  expect(context.resume).not.toHaveBeenCalled();
});
it('bounds a stalled native resume and leaves no advancing silent source', async () => {
  vi.useFakeTimers();
  const { audio, context, lifecycle } = setup();
  context.state = 'suspended';
  context.resume.mockImplementation(() => new Promise(() => {}));
  const result = expect(lifecycle.resume()).rejects.toThrow('did not resume');
  await vi.advanceTimersByTimeAsync(3000);
  await result;
  expect(audio.paused).toBe(true);
  expect(audioOutputObservations().some(item => item.event === 'resume-failed')).toBe(true);
});
it('late state changes and visibility events cannot revive a retired source', () => {
  const { audio, context, silence, lifecycle } = setup();
  lifecycle.release();
  const count = audioOutputObservations().length;
  context.change('interrupted');
  audio.dispatchEvent(new Event('playing'));
  document.dispatchEvent(new Event('visibilitychange'));
  expect(silence).not.toHaveBeenCalled();
  expect(audioOutputObservations()).toHaveLength(count);
});
it('keeps bounded identifier-free clock/state snapshots and tolerates missing session policy', () => {
  vi.stubGlobal('navigator', {});
  const { audio } = setup();
  for (let i = 0; i < 150; i++) audio.dispatchEvent(new Event('playing'));
  expect(audioOutputObservations()).toHaveLength(96);
  expect(audioOutputObservations()[0]).toMatchObject({ contextSeconds: 12, mediaSeconds: 9, visibility: 'visible' });
  expect(Object.keys(audioOutputObservations()[0])).not.toContain('source');
});

it('does not overwrite a newer native session owner during cleanup', () => {
  const { lifecycle } = setup();
  const session = Reflect.get(navigator, 'audioSession');
  session.type = 'play-and-record';
  lifecycle.release();
  expect(session.type).toBe('play-and-record');
});

it('late native resume completion cannot resume or observe a retired media generation', async () => {
  const { audio, context, lifecycle } = setup();
  let finish!: () => void;
  context.resume.mockImplementation(
    () =>
      new Promise<void>(resolve => {
        finish = resolve;
      })
  );
  const resume = lifecycle.resume();
  lifecycle.release();
  const count = audioOutputObservations().length;
  finish();
  await resume;
  expect(audio.pause).not.toHaveBeenCalled();
  expect(audioOutputObservations()).toHaveLength(count);
  await expect(lifecycle.resume()).rejects.toThrow('retired');
  expect(context.resume).toHaveBeenCalledOnce();
});
