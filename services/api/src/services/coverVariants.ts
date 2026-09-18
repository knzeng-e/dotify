import sharp from 'sharp';

export const COVER_VARIANT_WIDTHS = [64, 160, 320, 640] as const;
export const COVER_PLACEHOLDER_WIDTH = 24;
export const COVER_DIRECTORY = 'cover';

export type CoverVariantFile = {
  path: string;
  bytes: Uint8Array;
  mime: string;
};

export type ResponsiveCover = {
  files: CoverVariantFile[];
  primaryPath: string;
  placeholderPath: string;
  width: number;
  height: number;
};

function variantPath(width: number): string {
  return `${COVER_DIRECTORY}/${width}.webp`;
}

/**
 * Normalize one artist-supplied cover into a small immutable responsive set.
 *
 * Album artwork is presented in square surfaces throughout Dotify. We crop
 * around Sharp's attention point once, server-side, so every client gets the
 * same composition and the browser never has to download the multi-megabyte
 * archival original for a thumbnail.
 */
export async function createResponsiveCover(source: Uint8Array, originalExtension: string): Promise<ResponsiveCover> {
  const input = Buffer.from(source);
  const base = sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 }).rotate();
  const metadata = await base.metadata();
  if (!metadata.width || !metadata.height) throw new Error('Cover dimensions are unavailable');

  const variants = await Promise.all(
    COVER_VARIANT_WIDTHS.map(async width => ({
      path: variantPath(width),
      bytes: new Uint8Array(
        await base
          .clone()
          .resize(width, width, { fit: 'cover', position: sharp.strategy.attention })
          .webp({ quality: width <= 160 ? 72 : 78, effort: 5, smartSubsample: true })
          .toBuffer()
      ),
      mime: 'image/webp'
    }))
  );

  const placeholder = await base
    .clone()
    .resize(COVER_PLACEHOLDER_WIDTH, COVER_PLACEHOLDER_WIDTH, { fit: 'cover', position: sharp.strategy.attention })
    .blur(1.2)
    .webp({ quality: 36, effort: 4 })
    .toBuffer();

  return {
    files: [
      { path: `${COVER_DIRECTORY}/placeholder.webp`, bytes: new Uint8Array(placeholder), mime: 'image/webp' },
      ...variants,
      {
        path: `${COVER_DIRECTORY}/original.${originalExtension}`,
        bytes: new Uint8Array(input),
        mime: originalExtension === 'jpg' ? 'image/jpeg' : `image/${originalExtension}`
      }
    ],
    primaryPath: variantPath(640),
    placeholderPath: `${COVER_DIRECTORY}/placeholder.webp`,
    width: 640,
    height: 640
  };
}
