export const RESPONSIVE_COVER_WIDTHS = [64, 160, 320, 640] as const;

export type ResponsiveCoverSources = {
  srcSet: string;
};

/**
 * New cover uploads use a stable directory layout. Legacy single-CID covers
 * return null and continue through the existing gateway/fallback path.
 */
export function responsiveCoverSources(primaryUrl: string | undefined): ResponsiveCoverSources | null {
  if (!primaryUrl || !/\/(?:cover\/)?640\.webp(?:[?#].*)?$/.test(primaryUrl)) return null;
  const replaceWidth = (file: string) => primaryUrl.replace(/640\.webp(?=([?#]|$))/, file);
  return {
    srcSet: RESPONSIVE_COVER_WIDTHS.map(width => `${replaceWidth(`${width}.webp`)} ${width}w`).join(', ')
  };
}

/** Earlier directory pins stripped their common cover/ root. Try only the
 * known variant at the same immutable CID; never search another artist/CID. */
export function coverGatewaySources(urls: string[]): string[] {
  return urls.flatMap(url => {
    const flat = url.replace(/(\/ipfs\/[^/]+)\/cover\/(640\.webp)(?=([?#]|$))/, '$1/$2');
    return flat === url ? [url] : [url, flat];
  });
}
