import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { NativeReceiptRequest, NativeReceiptResponse } from '../services/nativeReceipts.js';
import { NativeReceiptUnavailableError } from '../services/nativeReceipts.js';

const hash = z.string().regex(/^0x[\da-f]{64}$/i);
const schema = z
  .object({
    hash,
    block: z.object({ number: z.number().int().min(0).max(0xffff_ffff), hash: hash.optional(), index: z.number().int().min(0).optional() }).strict()
  })
  .strict();

export function createNativeReceiptRoutes(deps: { read: (input: NativeReceiptRequest) => Promise<NativeReceiptResponse> }) {
  return async (app: FastifyInstance): Promise<void> => {
    app.post('/api/contributions/native-receipt', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const input = schema.safeParse(request.body);
      if (!input.success)
        return reply
          .code(400)
          .send({ code: 'INVALID_NATIVE_RECEIPT', error: 'Choose a valid native transaction and receipt block.', requestId: String(request.id) });
      try {
        return await deps.read(input.data as NativeReceiptRequest);
      } catch (error) {
        const unavailable = error instanceof NativeReceiptUnavailableError;
        return reply.code(unavailable ? 503 : 409).send({
          code: unavailable ? 'NATIVE_RECEIPT_UNAVAILABLE' : 'NATIVE_RECEIPT_UNVERIFIED',
          error: unavailable ? error.message : 'The native receipt could not be verified for this transaction and block. Keep this contribution pending.',
          requestId: String(request.id)
        });
      }
    });
  };
}
