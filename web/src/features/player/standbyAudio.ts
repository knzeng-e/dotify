import { configureStreamingAudioElement } from '../catalog/streamingMediaSource';
import { retireHostAudio } from './hostAudioOutput';

type Candidate = {
  identity: string;
  audio: HTMLAudioElement;
  controller: AbortController;
  detach: () => void;
  expires: number;
  url: string | null;
  ready: boolean;
};

/** One silent, authorized next source. Ownership transfers, never the key. */
export class StandbyAudio {
  private candidate: Candidate | null = null;
  private adopted = new Map<string, HTMLAudioElement>();

  clear() {
    const current = this.candidate;
    this.candidate = null;
    if (!current) return;
    current.detach();
    current.controller.abort();
    retireHostAudio(current.audio);
  }

  async prepare(identity: string, expires: number, parent: AbortSignal, load: (signal: AbortSignal, audio: HTMLAudioElement) => Promise<string>) {
    if (parent.aborted || !Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + 30_000) return;
    if (this.candidate?.identity === identity && this.candidate.expires > Date.now()) return;
    this.clear();
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    const controller = new AbortController();
    const cancel = () => {
      if (this.candidate === current) this.clear();
    };
    const deadline = setTimeout(cancel, Math.max(0, expires - Date.now()));
    const current: Candidate = {
      identity,
      audio,
      controller,
      expires,
      url: null,
      ready: false,
      detach: () => {
        clearTimeout(deadline);
        parent.removeEventListener('abort', cancel);
      }
    };
    this.candidate = current;
    parent.addEventListener('abort', cancel, { once: true });
    try {
      const url = await load(controller.signal, audio);
      controller.signal.throwIfAborted();
      if (this.candidate !== current) return;
      current.url = url;
      // No play/autoplay, normalization graph or room capture before adoption.
      configureStreamingAudioElement(audio, url);
      audio.src = url;
      audio.addEventListener(
        'canplay',
        () => {
          current.ready = true;
        },
        { once: true, signal: controller.signal }
      );
      audio.load();
    } catch {
      cancel(); // A speculative denial/failure must not interrupt current audio.
    }
  }

  take(identity: string, owner: AbortSignal): string | null {
    const current = this.candidate;
    if (
      !current ||
      !current.ready ||
      current.audio.error !== null ||
      current.audio.readyState < 3 ||
      current.identity !== identity ||
      current.expires <= Date.now() ||
      owner.aborted
    ) {
      this.clear();
      return null;
    }
    this.candidate = null;
    current.detach();
    const url = current.url!;
    this.adopted.set(url, current.audio);
    owner.addEventListener(
      'abort',
      () => {
        current.controller.abort();
        this.adopted.delete(url);
        retireHostAudio(current.audio);
      },
      { once: true }
    );
    return url;
  }

  adopt(url: string | null): HTMLAudioElement | null {
    if (!url) return null;
    const audio = this.adopted.get(url) ?? null;
    this.adopted.delete(url);
    return audio;
  }
}
