import { drawSystemBrandedArtwork } from './systemBrandedArtwork';
import { createCoverFallbackDataUri } from '../catalog/coverArtwork';
import { getGatewayUrlsForAssetRef } from '../../services/pinata';
import { artworkCacheKey, loadPublicArtwork } from '../../services/publicArtworkCache';

export type SystemMediaTrack = { title: string; artist: string; imageRef?: string };

/** Media Session takes image URLs, not IPFS references or Dotify cover markers. */
export function systemArtworkCandidates(imageRef: string | undefined): MediaImage[] {
  return getGatewayUrlsForAssetRef(imageRef ?? '')
    .filter(src => /^https?:\/\//i.test(src) || /^data:image\/(?:png|jpeg|webp);/i.test(src))
    .map(src => ({ src }));
}

function pngArtwork(src: string, signal: AbortSignal): Promise<MediaImage> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = (error?: unknown) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
    };
    const abort = () => {
      finish(signal.reason ?? new Error('Artwork cancelled'));
      image.src = '';
    };
    const timer = setTimeout(() => {
      finish(new Error('Artwork decoding timed out'));
      image.src = '';
    }, 5000);
    signal.addEventListener('abort', abort, { once: true });
    image.onerror = () => finish(new Error('Artwork could not decode'));
    image.onload = () => {
      try {
        signal.throwIfAborted();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 640;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Artwork canvas unavailable');
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 640, 640);
        const output = document.createElement('canvas');
        output.width = output.height = 640;
        const frame = output.getContext('2d');
        if (!frame) throw new Error('System artwork canvas unavailable');
        drawSystemBrandedArtwork(frame, canvas);
        const result = { src: output.toDataURL('image/png'), sizes: '640x640', type: 'image/png' };
        finish();
        resolve(result);
      } catch (error) {
        finish(error);
      }
    };
    if (/^https?:\/\//i.test(src)) image.crossOrigin = 'anonymous';
    image.src = src;
  });
}

/** Public artwork only. Reuse bounded IPFS/Host cache; never read audio or keys. */
export async function resolveSystemArtwork(track: SystemMediaTrack, signal: AbortSignal): Promise<MediaImage[]> {
  signal.throwIfAborted();
  const candidates = systemArtworkCandidates(track.imageRef);
  if (candidates.length) {
    if (!artworkCacheKey(candidates[0].src)) {
      try {
        return [await pngArtwork(candidates[0].src, signal)];
      } catch {
        signal.throwIfAborted();
        return candidates;
      }
    }
    try {
      const source = await loadPublicArtwork(candidates.map(candidate => candidate.src));
      signal.throwIfAborted();
      return [await pngArtwork(source, signal)];
    } catch {
      signal.throwIfAborted();
      // Ordinary image URLs remain usable by platforms that fetch directly.
      return candidates;
    }
  }
  // Match CoverImage's deterministic fallback, rasterized for native surfaces
  // that do not decode SVG or cannot resolve an in-page blob URL themselves.
  const fallback = /^data:image\/svg\+xml[;,]/i.test(track.imageRef ?? '')
    ? track.imageRef!
    : createCoverFallbackDataUri(track.title || 'Dotify', track.imageRef || track.title || 'Dotify');
  return [await pngArtwork(fallback, signal)];
}
