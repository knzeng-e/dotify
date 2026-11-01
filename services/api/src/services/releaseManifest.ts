import { z } from 'zod';
export const dotifyManifestSchema = z
  .object({
    schema: z.literal('dotify.track.v2'),
    createdAt: z.string().datetime(),
    assets: z
      .object({
        audioCID: z.string().min(1),
        coverCID: z.string(),
        encrypted: z.boolean().optional(),
        keyVersion: z.string().min(1).max(80).optional(),
        previewCID: z.string().optional()
      })
      .strict(),
    track: z
      .object({
        contentHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
        title: z.string().min(1).max(200),
        artistName: z.string().min(1).max(200),
        description: z.string().max(2000),
        durationSeconds: z
          .number()
          .positive()
          .max(24 * 60 * 60)
          .nullable(),
        accessMode: z.enum(['human-free', 'classic', 'free']),
        priceDot: z.string(),
        requiredPersonhood: z.string(),
        zone: z.string()
      })
      .strict(),
    editorial: z
      .object({
        releaseKind: z.enum(['single', 'album-track', 'ep-track', 'live', 'remix', 'other']),
        projectTitle: z.string().max(200),
        version: z.string().max(120),
        releaseDate: z.string().regex(/^(|\d{4}|\d{4}-\d{2}-\d{2})$/, 'releaseDate must be empty, YYYY or YYYY-MM-DD'),
        genres: z.array(z.string().min(1).max(80)).max(8),
        languages: z.array(z.string().min(1).max(80)).max(8),
        credits: z
          .array(
            z
              .object({
                name: z.string().min(1).max(200),
                role: z.enum(['performer', 'writer', 'composer', 'producer', 'featured-artist', 'engineer', 'other'])
              })
              .strict()
          )
          .max(20),
        label: z.string().max(200),
        productionLocation: z.string().max(200),
        explicitContent: z.boolean(),
        isrc: z.string().max(15),
        copyrightNotice: z.string().max(300),
        masterNotice: z.string().max(300)
      })
      .strict(),
    royalties: z
      .array(
        z
          .object({
            recipient: z.string().min(1),
            bps: z.number().int().min(0).max(10000)
          })
          .strict()
      )
      .max(20),
    settlement: z
      .object({
        target: z.literal('evm'),
        royaltyBps: z.number().int().min(0).max(10000),
        pricePlanck: z.string()
      })
      .strict(),
    evm: z
      .object({
        txHash: z.string(),
        contractAddress: z.string()
      })
      .strict()
      .optional()
  })
  .strict();
