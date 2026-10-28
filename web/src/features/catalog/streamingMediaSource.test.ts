import { expect, it, vi } from 'vitest';
import { configureStreamingAudioElement, ownManagedAudioUrl, streamingMediaSource } from './streamingMediaSource';
const ctor = (supported: boolean) => ({ isTypeSupported: () => supported }) as unknown as typeof MediaSource;
it('prefers standard AAC, otherwise selects managed AAC and only then compatibility', () => {
  const standard = ctor(true),
    managed = ctor(true);
  expect(streamingMediaSource({ MediaSource: standard, ManagedMediaSource: managed })).toEqual({ kind: 'standard', ctor: standard });
  expect(streamingMediaSource({ MediaSource: ctor(false), ManagedMediaSource: managed })).toEqual({ kind: 'managed', ctor: managed });
  expect(streamingMediaSource({ ManagedMediaSource: ctor(false) })).toBeNull();
  expect(streamingMediaSource({})).toBeNull();
});
it('configures only owned managed URLs and retires their attachment contract', () => {
  const controller = new AbortController();
  ownManagedAudioUrl('blob:managed', controller.signal);
  const fresh = () => ({ disableRemotePlayback: false, setAttribute: vi.fn() });
  const managed = fresh();
  configureStreamingAudioElement(managed as unknown as HTMLAudioElement, 'blob:managed');
  expect(managed.disableRemotePlayback).toBe(true);
  const ordinary = fresh();
  configureStreamingAudioElement(ordinary as unknown as HTMLAudioElement, 'https://ordinary');
  expect(ordinary.disableRemotePlayback).toBe(false);
  controller.abort();
  const retired = fresh();
  configureStreamingAudioElement(retired as unknown as HTMLAudioElement, 'blob:managed');
  expect(retired.disableRemotePlayback).toBe(false);
});
