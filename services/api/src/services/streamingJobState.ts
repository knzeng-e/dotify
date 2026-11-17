// Pure durable queue schema, shared by runtime and stopped-writer inspection.
import { z } from 'zod';
export const MAX_STREAMING_JOBS = 64;
export const streamingOwnerAddressSchema = z.string().regex(/^0x[0-9a-f]{40}$/);
const scopeSchema = z
  .object({
    chainId: z.number().int().positive(),
    runtimeAddress: streamingOwnerAddressSchema,
    contentHash: z.string().regex(/^0x[0-9a-f]{64}$/),
    keyVersion: z.string().regex(/^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/)
  })
  .strict();
export const streamingJobSchema = z
  .object({
    id: z.string().uuid(),
    owner: streamingOwnerAddressSchema,
    scope: scopeSchema,
    state: z.enum(['queued', 'encoding', 'encrypting', 'publishing', 'ready', 'failed', 'expired']),
    attempts: z.number().int().min(0).max(3),
    createdAt: z.number().int().positive(),
    updatedAt: z.number().int().positive(),
    sourceBytes: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024),
    sourceGeneration: z.string().regex(/^[0-9a-f]{16}$/),
    ref: z.string().max(256).optional(),
    reason: z.enum(['PREPARATION_FAILED', 'RETRY_LIMIT', 'PUBLICATION_NOT_ADMITTED']).optional()
  })
  .strict();
export const streamingJobsSchema = z
  .object({ schema: z.literal('dotify.streaming.jobs.v1'), jobs: z.array(streamingJobSchema).max(MAX_STREAMING_JOBS) })
  .strict();
export type StreamingJob = z.infer<typeof streamingJobSchema>;
