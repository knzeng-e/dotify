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
  const activeSource = presentation.source;
  const responsive = useMemo(() => responsiveCoverSources(activeSource), [activeSource]);
  const isInLoadRange = loading !== 'lazy' || lazyLoadRangeSource === (src ?? null);
  const canStartGatewayTimeout = shouldArmCoverGatewayTimeout(loading, isInLoadRange);

  useEffect(() => {
    if (!canStartGatewayTimeout || !shouldUseLocalCoverFallbackAfterGatewayTimeout(gatewaySource, loadedSource, didExhaustSources)) return;

    const timeoutId = window.setTimeout(() => {
      setShowLocalFallback(true);
    }, COVER_GATEWAY_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [canStartGatewayTimeout, didExhaustSources, gatewaySource, loadedSource]);

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
      data-cover-loaded={presentation.isReady || showResponsivePlaceholder}
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
