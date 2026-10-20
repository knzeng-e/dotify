import { afterEach, expect, it, vi } from 'vitest';
import { readAudioBody } from './readAudioBody';

afterEach(() => vi.useRealTimers());

it('fails and cancels a response whose body stops after headers', async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const promise = readAudioBody(new Response(new ReadableStream({ cancel })), undefined, 100);
  const failure = expect(promise).rejects.toThrow('stopped making progress');
  await vi.advanceTimersByTimeAsync(100);
  await failure;
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('allows a progressing body to exceed the idle deadline in total', async () => {
  vi.useFakeTimers();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const promise = readAudioBody(
    new Response(
      new ReadableStream({
        start(value) {
          controller = value;
        }
      })
    ),
    undefined,
    100
  );
  for (let index = 0; index < 4; index++) {
    await vi.advanceTimersByTimeAsync(90);
    controller!.enqueue(new Uint8Array([index]));
  }
  controller!.close();
  await expect(promise).resolves.toEqual(new Uint8Array([0, 1, 2, 3]));
  expect(vi.getTimerCount()).toBe(0);
});

it('cancels a pending body immediately on selection change', async () => {
  const controller = new AbortController();
  const cancel = vi.fn();
  const promise = readAudioBody(new Response(new ReadableStream({ cancel })), controller.signal);
  controller.abort();
  await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  expect(cancel).toHaveBeenCalledTimes(1);
});

it('rejects empty and oversized responses before exposing audio bytes', async () => {
  await expect(readAudioBody(new Response())).rejects.toThrow('no content');
  const cancel = vi.fn();
  await expect(readAudioBody(new Response(new ReadableStream({ cancel }), { headers: { 'content-length': String(65 * 1024 * 1024) } }))).rejects.toThrow(
    'supported size'
  );
  expect(cancel).toHaveBeenCalledOnce();
});

it('does not equate the decoded body size with a possibly compressed Content-Length', async () => {
  await expect(readAudioBody(new Response('decoded audio', { headers: { 'content-length': '5' } }))).resolves.toEqual(
    new TextEncoder().encode('decoded audio')
  );
});
