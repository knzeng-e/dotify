import { useEffect } from 'react';
import { getGatewayUrlsForAssetRef } from '../../services/pinata';
import { applyAura, auraForName, auraForTrack, auraFromHue } from '../../shared/utils/aura';
import { dominantCoverHue } from './coverHue';

const cache = new Map<string, number | null>();

export function useTrackAura(track: { id?: string; title?: string; artist?: string; imageRef?: string } | null, artistName: string | null) {
  const id = track?.id;
  const title = track?.title;
  const artist = track?.artist;
  const imageRef = track?.imageRef;
  useEffect(() => {
    const root = document.documentElement;
    if (artistName) {
      applyAura(auraForName(artistName));
      root.dataset.auraSource = 'artist';
      return;
    }
    const fallback = auraForTrack(id || title || artist ? { id, title, artist } : null);
    const apply = (hue: number | null) => {
      applyAura(hue === null ? fallback : auraFromHue(hue));
      root.dataset.auraSource = hue === null ? 'fallback' : 'cover';
    };
    apply(null);
    const url = imageRef ? getGatewayUrlsForAssetRef(imageRef)[0] : undefined;
    if (!url) return;
    if (cache.has(url)) {
      apply(cache.get(url)!);
      return;
    }
    const image = new Image();
    let finished = false;
    const finish = (hue: number | null) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (cache.size >= 32) cache.delete(cache.keys().next().value!);
      cache.set(url, hue);
      apply(hue);
    };
    const timer = window.setTimeout(() => {
      finish(null);
      image.src = '';
    }, 2000);
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 24;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return finish(null);
        context.drawImage(image, 0, 0, 24, 24);
        finish(dominantCoverHue(context.getImageData(0, 0, 24, 24).data));
      } catch {
        finish(null);
      }
    };
    image.onerror = () => finish(null);
    image.src = url;
    return () => {
      finished = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      image.src = '';
    };
  }, [id, title, artist, imageRef, artistName]);
}
