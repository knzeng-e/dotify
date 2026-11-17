// Shared offline envelope only. Never imports application configuration or vaults.
import { z } from 'zod';

export const recoveredContentKeySchema = z
  .object({
    schema: z.literal('dotify.content-key-recovery.v1'),
    masters: z.record(
      z
        .string()
        .max(80)
        .regex(/^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/),
      z
        .string()
        .min(64)
        .max(1024)
        .regex(/^(?:[0-9a-fA-F]{2})+$/)
    )
  })
  .strict()
  .refine(value => Object.keys(value.masters).length > 0 && Object.keys(value.masters).length <= 64);
