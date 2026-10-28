/** Browser capability and attachment contract for authorized AAC sources. */
export const STREAMING_AAC_MIME = 'audio/mp4; codecs="mp4a.40.2"';
export type ManagedAudioSource = MediaSource & { readonly streaming: boolean };
type MediaSourceConstructor = typeof MediaSource;
type Capabilities = { MediaSource?: MediaSourceConstructor; ManagedMediaSource?: MediaSourceConstructor };

export function streamingMediaSource(
  capabilities: Capabilities = globalThis as Capabilities
): { kind: 'standard' | 'managed'; ctor: MediaSourceConstructor } | null {
  // Preserve the established desktop path. Use managed streaming where standard
  // AAC MSE is unavailable, rather than inferring capability from a user agent.
  for (const [kind, ctor] of [
    ['standard', capabilities.MediaSource],
    ['managed', capabilities.ManagedMediaSource]
  ] as const) {
    try {
      if (ctor?.isTypeSupported(STREAMING_AAC_MIME)) return { kind, ctor };
    } catch {
      // A shell exposing an unusable constructor is not a supported reader.
    }
  }
  return null;
}

const managedUrls = new Set<string>();
export function ownManagedAudioUrl(url: string, signal: AbortSignal): () => void {
  const release = () => {
    managedUrls.delete(url);
    signal.removeEventListener('abort', release);
  };
  if (!signal.aborted) {
    managedUrls.add(url);
    signal.addEventListener('abort', release, { once: true });
  }
  return release;
}

/** Must run BEFORE src/load: WebKit requires this without an AirPlay URL.
 * Ciphertext/key access must never be replaced by a public clear-media URL.
 * This is per-source; ordinary sources and room guest streams are unaffected.
 */
export function configureStreamingAudioElement(audio: HTMLAudioElement, url: string) {
  if (managedUrls.has(url)) {
    audio.disableRemotePlayback = true;
    audio.setAttribute('disableRemotePlayback', '');
  }
}
