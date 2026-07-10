import { useEffect, useMemo, useState, type ImgHTMLAttributes } from 'react';
import { getGatewayUrlsForAssetRef } from '../services/pinata';

type CoverImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'crossOrigin' | 'src'> & {
  src: string | undefined;
};

export function CoverImage({ src, alt = '', ...props }: CoverImageProps) {
  const sources = useMemo(() => getGatewayUrlsForAssetRef(src ?? ''), [src]);
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [sources]);

  const activeSource = sources[sourceIndex];
  if (!activeSource) return null;

  return (
    <img
      {...props}
      src={activeSource}
      alt={alt}
      onError={() => {
        setSourceIndex(index => Math.min(index + 1, sources.length - 1));
      }}
    />
  );
}
