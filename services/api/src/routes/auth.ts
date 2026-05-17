import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createWalletNonceChallenge } from '../services/signatures.js';

const nonceRequestSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid EVM address'),
  chainId: z.number().int().positive().optional(),
});

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'Invalid nonce request',
    issues: issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/nonce', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = nonceRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return validationError(reply, parsed.error.issues);
    }

    return createWalletNonceChallenge(parsed.data);
  });
}
