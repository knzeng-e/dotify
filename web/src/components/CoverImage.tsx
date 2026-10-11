import { useEffect, useMemo, useRef, useState, type CSSProperties, type ImgHTMLAttributes } from 'react';
import {
  COVER_GATEWAY_TIMEOUT_MS,
  createCoverFallbackDataUri,
  resolveCoverPresentation,
  shouldArmCoverGatewayTimeout,
  shouldUseLocalCoverFallbackAfterGatewayTimeout
} from '../features/catalog/coverArtwork';
import { responsiveCoverSources } from '../features/catalog/responsiveCover';
import { getGatewayUrlsForAssetRef } from '../services/pinata';
import { artworkCacheKey, loadPublicArtwork } from '../services/publicArtworkCache';

type CoverImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'crossOrigin' | 'src'> & {
  src: string | undefined;
  fallbackLabel?: string;
};

export function CoverImage({
  src,
  alt = '',
  fallbackLabel,
  loading = 'lazy',
  decoding = 'async',
  sizes,
  onError,
  onLoad,
  className,
  style,
  ...props
}: CoverImageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const sources = useMemo(() => getGatewayUrlsForAssetRef(src ?? ''), [src]);
  const fallbackSource = useMemo(
    () => createCoverFallbackDataUri(fallbackLabel || alt || 'Dotify', src || fallbackLabel || alt || 'Dotify'),
    [alt, fallbackLabel, src]
  );
  const [sourceIndex, setSourceIndex] = useState(0);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [didExhaustSources, setDidExhaustSources] = useState(false);
  const [showLocalFallback, setShowLocalFallback] = useState(false);
  const [lazyLoadRangeSource, setLazyLoadRangeSource] = useState<string | null>(null);
  const [cachedSource, setCachedSource] = useState<{ ref: string; url: string } | null>(null);

  useEffect(() => {
    setSourceIndex(0);
    setLoadedSource(null);
    setDidExhaustSources(false);
    setShowLocalFallback(false);
  }, [src]);

  useEffect(() => {
    if (loading !== 'lazy') {
      setLazyLoadRangeSource(src ?? null);
      return;
    }

    setLazyLoadRangeSource(null);
    const image = imageRef.current;
    if (!image || typeof IntersectionObserver === 'undefined') {
      setLazyLoadRangeSource(src ?? null);
      return;
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting || entry.intersectionRatio > 0)) {
        setLazyLoadRangeSource(src ?? null);
        observer.disconnect();
      }
    });
    observer.observe(image);

    return () => observer.disconnect();
  }, [loading, src]);

  const lastSourceIndex = sources.length - 1;
  const boundedSourceIndex = Math.min(sourceIndex, Math.max(lastSourceIndex, 0));
  const gatewaySource = sources[boundedSourceIndex];
  const presentation = resolveCoverPresentation(gatewaySource, fallbackSource, loadedSource, didExhaustSources, showLocalFallback);
  const activeSource = cachedSource && cachedSource.ref === src ? cachedSource.url : presentation.source;
  const responsive = useMemo(() => responsiveCoverSources(activeSource), [activeSource]);
  const isInLoadRange = loading !== 'lazy' || lazyLoadRangeSource === (src ?? null);
  const canStartGatewayTimeout = shouldArmCoverGatewayTimeout(loading, isInLoadRange);

  useEffect(() => {
    if (!isInLoadRange || !src || !sources[0] || !artworkCacheKey(sources[0])) return;
    let cancelled = false;
    // Cache the width selected for this surface, rather than a 640px thumbnail.
    const width = Math.min(640, Math.max(64, (imageRef.current?.getBoundingClientRect().width || 320) * Math.min(window.devicePixelRatio || 1, 2)));
    const variant = [64, 160, 320, 640].find(candidate => candidate >= width) ?? 640;
    const urls = sources.map(url => url.replace(/\/cover\/640\.webp(?=([?#]|$))/, `/cover/${variant}.webp`));
    void loadPublicArtwork(urls)
      .then(url => {
        if (!cancelled) setCachedSource({ ref: src, url });
      })
      .catch(() => {
        // Image loading without CORS remains available through the native path.
      });
    return () => {
      cancelled = true;
    };
  }, [src, sources, isInLoadRange]);

  useEffect(() => {
    if (cachedSource?.ref === src || !canStartGatewayTimeout || !shouldUseLocalCoverFallbackAfterGatewayTimeout(gatewaySource, loadedSource, didExhaustSources))
      return;

    const timeoutId = window.setTimeout(() => {
      setShowLocalFallback(true);
      if (boundedSourceIndex < lastSourceIndex) setSourceIndex(index => Math.min(index + 1, lastSourceIndex));
    }, COVER_GATEWAY_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [canStartGatewayTimeout, didExhaustSources, gatewaySource, loadedSource, boundedSourceIndex, lastSourceIndex, cachedSource, src]);

  const showResponsivePlaceholder = Boolean(responsive && loadedSource !== activeSource && !didExhaustSources);
  const fallbackBackground = presentation.showFallbackBackground
    ? `url("${fallbackSource}")`
    : showResponsivePlaceholder
      ? `url("${responsive?.placeholder}"), url("${fallbackSource}")`
      : null;
  const localFallbackStyle: CSSProperties | undefined = fallbackBackground
    ? {
        backgroundImage: fallbackBackground,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover'
      }
    : undefined;

  return (
    <img
      {...props}
      ref={imageRef}
      src={activeSource}
      srcSet={responsive?.srcSet}
      sizes={responsive ? (sizes ?? '320px') : sizes}
      alt={alt}
      className={['cover-image', className].filter(Boolean).join(' ')}
      data-cover-loaded={loadedSource === activeSource || presentation.showFallbackBackground || showResponsivePlaceholder}
      data-cover-fallback={presentation.showFallbackBackground || undefined}
      loading={loading}
      decoding={decoding}
      style={localFallbackStyle ? { ...style, ...localFallbackStyle } : style}
      onLoad={event => {
        setLoadedSource(activeSource);
        setShowLocalFallback(false);
        onLoad?.(event);
      }}
      onError={event => {
        onError?.(event);
        if (cachedSource && cachedSource.ref === src && activeSource === cachedSource.url) {
          // Decoding failures or a Host policy rejecting blob URLs must not
          // strand the image on its cached source; resume native loading.
          setCachedSource(null);
          setShowLocalFallback(true);
          return;
        }
        if (didExhaustSources || activeSource === fallbackSource || sources.length === 0) return;
        if (boundedSourceIndex >= lastSourceIndex) {
          setDidExhaustSources(true);
          return;
        }
        setSourceIndex(index => Math.min(index + 1, sources.length - 1));
      }}
    />
  );
}
