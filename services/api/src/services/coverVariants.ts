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

// Cover normalization can require a full decode when attention cropping is
// used. Keep that expensive stage process-wide and serial: upload grants allow
// several artists to upload concurrently, while the production API currently
// runs in a 512 MB machine and also serves listener-facing key requests.
let coverProcessingTail: Promise<void> = Promise.resolve();

async function withCoverProcessingSlot<T>(task: () => Promise<T>): Promise<T> {
  const previous = coverProcessingTail;
  let release: () => void = () => {};
  coverProcessingTail = new Promise<void>(resolve => {
    release = resolve;
  });

  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}

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
  return withCoverProcessingSlot(async () => {
    const input = Buffer.from(source);

    // Decode and attention-crop the artist source exactly once. The smaller
    // variants derive sequentially from this bounded 640 px canonical image,
    // rather than starting five concurrent decodes of a potentially 40 MP
    // upload.
    const canonical = await sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize(640, 640, { fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: 78, effort: 5, smartSubsample: true })
      .toBuffer();

    const variants: CoverVariantFile[] = [];
    for (const width of COVER_VARIANT_WIDTHS) {
      const bytes =
        width === 640
          ? canonical
          : await sharp(canonical)
              .resize(width, width)
              .webp({ quality: width <= 160 ? 72 : 78, effort: 5, smartSubsample: true })
              .toBuffer();
      variants.push({ path: variantPath(width), bytes: new Uint8Array(bytes), mime: 'image/webp' });
    }

    const placeholder = await sharp(canonical)
      .resize(COVER_PLACEHOLDER_WIDTH, COVER_PLACEHOLDER_WIDTH)
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
  });
}
