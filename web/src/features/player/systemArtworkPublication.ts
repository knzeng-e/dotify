import { beginSystemArtworkObservation } from './systemArtworkObservation';
import { preparedSystemArtwork, resolveSystemArtwork, systemArtworkCandidates, type SystemMediaTrack } from './systemArtwork';

/** One metadata owner. Artwork recovery never calls audio or system transport. */
export function publishSystemArtwork(session: MediaSession, track: SystemMediaTrack | null, isActive: () => boolean): () => void {
  const controller = new AbortController();
  const observe = track ? beginSystemArtworkObservation() : undefined;
  let metadata: MediaMetadata | null = null;
  let pending = false;
  let needsRecovery = false;
  let returnRequested = false;
  let retried = false;
  const matchesMetadata = () => {
    try {
      return session.metadata === metadata;
    } catch {
      observe?.('failed');
      return false;
    }
  };
  const ownsMetadata = () => !controller.signal.aborted && isActive() && matchesMetadata();
  const clearMetadata = () => {
    try {
      session.metadata = null;
      metadata = null;
    } catch {
      observe?.('failed');
      // A partial Host must not take down playback/account cleanup.
    }
  };
  const publish = (artwork: MediaImage[]) => {
    const next =
      track && typeof MediaMetadata !== 'undefined' ? new MediaMetadata({ title: track.title, artist: track.artist, album: 'Dotify', artwork }) : null;
    session.metadata = next;
    metadata = next;
    if (next) observe?.('metadata-published', artwork[0]?.type === 'image/png' ? 'png' : artwork.length ? 'url' : 'none');
  };
  const retryOnReturn = () => {
    if (!track || !returnRequested || retried || pending || !needsRecovery || document.visibilityState !== 'visible' || !ownsMetadata()) return;
    retried = true;
    returnRequested = false;
    observe?.('retry-requested');
    resolve();
  };
  const resolve = () => {
    if (!track) return;
    pending = true;
    void resolveSystemArtwork(track, controller.signal, observe)
      .then(artwork => {
        if (!ownsMetadata()) return;
        publish(artwork);
        needsRecovery = artwork[0]?.type !== 'image/png';
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          needsRecovery = true;
          observe?.('failed');
        }
      })
      .finally(() => {
        pending = false;
        retryOnReturn();
      });
  };
  try {
    const prepared = track ? preparedSystemArtwork(track) : null;
    if (prepared) observe?.('prepared-hit', 'png');
    publish(prepared ?? systemArtworkCandidates(track?.imageRef));
    if (metadata && track && !prepared) {
      needsRecovery = true;
      resolve();
    }
  } catch {
    observe?.('failed');
    needsRecovery = Boolean(track);
    clearMetadata();
  }
  const onVisibilityChange = () => {
    if (document.visibilityState !== 'visible' || !ownsMetadata()) return;
    // A return while decoding is pending may be serviced after it settles. A
    // successful PNG needs no repaint. No timers, per-tick work or retry loop.
    returnRequested = true;
    retryOnReturn();
  };
  if (track) document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    if (controller.signal.aborted) return;
    const owned = matchesMetadata();
    observe?.(pending ? 'cancelled' : 'retired');
    controller.abort();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (owned) clearMetadata();
  };
}
