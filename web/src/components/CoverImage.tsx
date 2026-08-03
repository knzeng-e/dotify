import { useEffect, useMemo, useState, type ImgHTMLAttributes } from 'react';
import { getGatewayUrlsForAssetRef } from '../services/pinata';

const IMAGE_GATEWAY_TIMEOUT_MS = 4_000;

type CoverImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'crossOrigin' | 'src'> & {
  src: string | undefined;
};

export function CoverImage({ src, alt = '', onError, onLoad, ...props }: CoverImageProps) {
  const sources = useMemo(() => getGatewayUrlsForAssetRef(src ?? ''), [src]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);

  useEffect(() => {
    setSourceIndex(0);
    setLoadedSource(null);
  }, [src]);

  const lastSourceIndex = sources.length - 1;
  const boundedSourceIndex = Math.min(sourceIndex, Math.max(lastSourceIndex, 0));
  const activeSource = sources[boundedSourceIndex];

  useEffect(() => {
    if (!activeSource || loadedSource === activeSource || boundedSourceIndex >= lastSourceIndex) return;

    const timeoutId = window.setTimeout(() => {
      setSourceIndex(index => (index === boundedSourceIndex ? Math.min(index + 1, lastSourceIndex) : index));
    }, IMAGE_GATEWAY_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeSource, boundedSourceIndex, lastSourceIndex, loadedSource]);

  if (!activeSource) return null;

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
        setSourceIndex(index => Math.min(index + 1, sources.length - 1));
      }}
    />
  );
}
