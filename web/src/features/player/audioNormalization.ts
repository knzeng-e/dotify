import { registerHostAudioOutput } from './hostAudioOutput';
const gains = new Map<string, number>();
const captures = new WeakMap<HTMLMediaElement, { stream: MediaStream; sync: () => void; resume: () => Promise<void> }>();
export function registerAudioGain(url: string, gainDb: number) {
  if (!Number.isFinite(gainDb) || gainDb < -24 || gainDb > 12) throw new Error('Invalid authenticated audio gain');
  gains.set(url, gainDb);
}
export function forgetAudioGain(url: string) {
  gains.delete(url);
}
export function normalizedAudioCapture(audio: HTMLMediaElement) {
  return captures.get(audio);
}
/** One graph owns both normalized local audio and the unmuted WebRTC leg. */
export function attachAudioNormalization(audio: HTMLAudioElement) {
  const gainDb = gains.get(audio.getAttribute('src') ?? '');
  if (gainDb === undefined || captures.has(audio)) return;
  const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return; // Native audio remains usable; physical-host acceptance records this limit.
  const context = new Context();
  const source = context.createMediaElementSource(audio);
  const gain = context.createGain(),
    monitor = context.createGain(),
    destination = context.createMediaStreamDestination();
  source.connect(gain);
  gain.connect(destination);
  gain.connect(monitor).connect(context.destination);
  const sync = () => {
    const playing = !audio.paused && !audio.ended && !audio.seeking && audio.readyState >= 3;
    gain.gain.value = playing ? 10 ** (gainDb / 20) : 0;
    monitor.gain.value = playing && !audio.muted ? audio.volume : 0;
  };
  const events = ['playing', 'play', 'pause', 'seeking', 'seeked', 'volumechange', 'ended', 'canplay'];
  for (const event of events) audio.addEventListener(event, sync);
  sync();
  captures.set(audio, { stream: destination.stream, sync, resume: () => context.resume() });
  registerHostAudioOutput(audio, {
    context,
    sync,
    silence: () => {
      gain.gain.value = 0;
      monitor.gain.value = 0;
    },
    release: () => {
      captures.delete(audio);
      for (const event of events) audio.removeEventListener(event, sync);
      source.disconnect();
      gain.disconnect();
      monitor.disconnect();
      destination.disconnect();
      destination.stream.getTracks().forEach(track => track.stop());
      void context.close().catch(() => undefined);
    }
  });
}
