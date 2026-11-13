import { drawSystemBrandedArtwork } from './systemBrandedArtwork';
import { createCoverFallbackDataUri } from '../catalog/coverArtwork';
import { getGatewayUrlsForAssetRef } from '../../services/pinata';
import { artworkCacheKey, loadPublicArtwork } from '../../services/publicArtworkCache';

export type SystemMediaTrack = { title: string; artist: string; imageRef?: string };

// Public derived pixels only, shared by solo/Room. Change this identity when
// the output size or badge composition changes. No browser/disk persistence.
const COMPOSITION = '640-cover-badge-v1';
const MAX_PREPARED_ENTRIES = 8;
const MAX_PREPARED_BYTES = 8 * 1024 * 1024;
const MAX_IDENTITY_CHARS = 16 * 1024;
const prepared = new Map<string, { artwork: MediaImage; bytes: number }>();
let preparedBytes = 0;

function preparationKey(track: SystemMediaTrack): string | null {
  const ref = track.imageRef ?? '';
  const candidate = systemArtworkCandidates(ref)[0]?.src;
  const immutable = candidate ? artworkCacheKey(candidate) : null;
  const source = immutable
    ? ['ipfs', immutable]
    : candidate?.startsWith('data:')
      ? ['inline', candidate]
      : /^data:image\/svg\+xml[;,]/i.test(ref)
        ? ['inline', ref]
        : !ref || ref.startsWith('dotify:cover:')
          ? ['generated', track.title || 'Dotify', ref || track.title || 'Dotify']
          : null;
  if (!source) return null; // Mutable HTTP, blobs and unknown/private schemes.
  const key = JSON.stringify([COMPOSITION, ...source]);
  return key.length <= MAX_IDENTITY_CHARS ? key : null;
}

/** A fresh metadata owner may publish an already composed cover immediately. */
export function preparedSystemArtwork(track: SystemMediaTrack): MediaImage[] | null {
  const key = preparationKey(track);
  const hit = key ? prepared.get(key) : undefined;
  if (!key || !hit) return null;
  prepared.delete(key);
  prepared.set(key, hit);
  return [{ ...hit.artwork }];
}

function rememberPreparedArtwork(track: SystemMediaTrack, artwork: MediaImage) {
  const key = preparationKey(track);
  if (!key) return;
  // Conservative UTF-16 string accounting; decoded canvases are not retained.
  const bytes = 2 * (key.length + artwork.src.length + (artwork.sizes?.length ?? 0) + (artwork.type?.length ?? 0));
  if (bytes > MAX_PREPARED_BYTES) return;
  const previous = prepared.get(key);
  if (previous) preparedBytes -= previous.bytes;
  prepared.delete(key);
  prepared.set(key, { artwork: { ...artwork }, bytes });
  preparedBytes += bytes;
  while (prepared.size > MAX_PREPARED_ENTRIES || preparedBytes > MAX_PREPARED_BYTES) {
    const oldest = prepared.entries().next().value;
    if (!oldest) break;
    prepared.delete(oldest[0]);
    preparedBytes -= oldest[1].bytes;
  }
}

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
  const hit = preparedSystemArtwork(track);
  if (hit) return hit;
  const compose = async (src: string) => {
    const artwork = await pngArtwork(src, signal);
    signal.throwIfAborted();
    rememberPreparedArtwork(track, artwork);
    return [artwork];
  };
  const candidates = systemArtworkCandidates(track.imageRef);
  if (candidates.length) {
    if (!artworkCacheKey(candidates[0].src)) {
      try {
        return await compose(candidates[0].src);
      } catch {
        signal.throwIfAborted();
        return candidates;
      }
    }
    try {
      const source = await loadPublicArtwork(candidates.map(candidate => candidate.src));
      signal.throwIfAborted();
      return await compose(source);
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
  return compose(fallback);
}
