export const RESPONSIVE_COVER_WIDTHS = [64, 160, 320, 640] as const;

export type ResponsiveCoverSources = {
  srcSet: string;
  placeholder: string;
};

/**
 * New cover uploads use a stable directory layout. Legacy single-CID covers
 * return null and continue through the existing gateway/fallback path.
 */
export function responsiveCoverSources(primaryUrl: string | undefined): ResponsiveCoverSources | null {
  if (!primaryUrl || !/\/cover\/640\.webp(?:[?#].*)?$/.test(primaryUrl)) return null;
  const replaceWidth = (file: string) => primaryUrl.replace(/\/cover\/640\.webp(?=([?#]|$))/, `/cover/${file}`);
  return {
    srcSet: RESPONSIVE_COVER_WIDTHS.map(width => `${replaceWidth(`${width}.webp`)} ${width}w`).join(', '),
    placeholder: replaceWidth('placeholder.webp')
  };
}
