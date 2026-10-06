import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { NativeContributionLedger } from '../services/nativeContributionLedger.js';
const query = z
  .object({
    runtimes: z
      .array(z.string().regex(/^0x[\da-f]{40}$/i))
      .min(1)
      .max(100),
    offset: z.number().int().min(0).max(10_000).default(0),
    revision: z.string().datetime().optional()
  })
  .strict();
export function createContributionHistoryRoutes(ledger: NativeContributionLedger, enabled: boolean) {
  return async (app: FastifyInstance) => {
    app.post('/api/contributions/history', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const input = query.safeParse(request.body);
      if (!input.success) return reply.code(400).send({ code: 'INVALID_HISTORY_QUERY', error: 'Choose valid artist accounts.', requestId: request.id });
      if (!enabled)
        return reply.code(503).send({ code: 'NATIVE_HISTORY_UNAVAILABLE', error: 'Native support history is not configured.', requestId: request.id });
      try {
        return await ledger.history(input.data.runtimes, input.data.offset, input.data.revision);
      } catch {
        return reply
          .code(503)
          .send({ code: 'NATIVE_HISTORY_UNAVAILABLE', error: 'Support history could not be read. Try refreshing again.', requestId: request.id });
      }
    });
  };
}
