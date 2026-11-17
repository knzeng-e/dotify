import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { usePlaybackPrefetch } from '../../src/features/player/usePlaybackPrefetch';

export function mount() {
  const audio = document.createElement('audio');
  let headroom = false;
  Object.defineProperties(audio, {
    paused: { get: () => false },
    seeking: { get: () => false },
    currentTime: { get: () => 1 },
    duration: { get: () => 180 },
    readyState: { get: () => 4 },
    buffered: { get: () => ({ length: 1, start: () => 0, end: () => (headroom ? 30 : 1) }) }
  });
  const signals: AbortSignal[] = [];
  let setEnabled!: (enabled: boolean) => void;
  function Harness() {
    const [enabled, set] = useState(true);
    setEnabled = set;
    usePlaybackPrefetch({ current: audio }, enabled, 0, 'dotify:enc:v3:key-v2:ipfs://Qm' + 'a'.repeat(44), undefined, async signal => {
      signals.push(signal);
      await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
    });
    return createElement('p', null, enabled ? 'Host playback' : 'Room guest');
  }
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  root.render(createElement(Harness));
  return {
    headroom(value: boolean) {
      headroom = value;
      audio.dispatchEvent(new Event('timeupdate'));
    },
    enabled(value: boolean) {
      setEnabled(value);
    },
    count: () => signals.length,
    aborted: () => signals.map(signal => signal.aborted),
    unmount: () => root.unmount()
  };
}
