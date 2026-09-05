import { useEffect, useMemo, useState, type ImgHTMLAttributes } from 'react';
import { COVER_GATEWAY_TIMEOUT_MS, createCoverFallbackDataUri } from '../features/catalog/coverArtwork';
import { getGatewayUrlsForAssetRef } from '../services/pinata';

type CoverImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'crossOrigin' | 'src'> & {
  src: string | undefined;
  fallbackLabel?: string;
};

export function CoverImage({ src, alt = '', fallbackLabel, onError, onLoad, ...props }: CoverImageProps) {
  const sources = useMemo(() => getGatewayUrlsForAssetRef(src ?? ''), [src]);
  const fallbackSource = useMemo(
    () => createCoverFallbackDataUri(fallbackLabel || alt || 'Dotify', src || fallbackLabel || alt || 'Dotify'),
    [alt, fallbackLabel, src]
  );
  const [sourceIndex, setSourceIndex] = useState(0);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [didExhaustSources, setDidExhaustSources] = useState(false);

  useEffect(() => {
    setSourceIndex(0);
    setLoadedSource(null);
    setDidExhaustSources(false);
  }, [src]);

  const lastSourceIndex = sources.length - 1;
  const boundedSourceIndex = Math.min(sourceIndex, Math.max(lastSourceIndex, 0));
  const gatewaySource = sources[boundedSourceIndex];
  const activeSource = didExhaustSources || !gatewaySource ? fallbackSource : gatewaySource;

  useEffect(() => {
    if (!gatewaySource || didExhaustSources || loadedSource === gatewaySource) return;

    const timeoutId = window.setTimeout(() => {
      if (boundedSourceIndex >= lastSourceIndex) {
        setDidExhaustSources(true);
        return;
      }
      setSourceIndex(index => (index === boundedSourceIndex ? Math.min(index + 1, lastSourceIndex) : index));
    }, COVER_GATEWAY_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [boundedSourceIndex, didExhaustSources, gatewaySource, lastSourceIndex, loadedSource]);

  return (
    <img
      {...props}
      src={activeSource}
      alt={alt}
      onLoad={event => {
        setLoadedSource(activeSource);
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
