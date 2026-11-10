// Pure profile binding metadata. No vault or application configuration import.
import { createHash } from 'node:crypto';
import { z } from 'zod';
export const freshContentKeySchema = z
  .object({
    version: z
      .string()
      .regex(/^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/)
      .max(80),
    masterSha256: z.string().regex(/^[0-9a-f]{64}$/)
  })
  .strict();
export const contentMasterDigest = (hex: string) => createHash('sha256').update(Buffer.from(hex, 'hex')).digest('hex');
