import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { checkTrackAccess } from '../services/chainAccess.js';
import { getContentKeyStatus } from '../services/keyVault.js';
import { verifyKeyRequestSignature } from '../services/signatures.js';

const paramsSchema = z.object({
  contentHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid content hash'),
});

const keyRequestSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid EVM address'),
  signature: z.string().min(1, 'Signature is required'),
  nonce: z.string().min(16, 'Nonce is required'),
  chainId: z.number().int().positive(),
  expiresAt: z.string().datetime(),
});

function validationError(reply: FastifyReply, error: string, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error,
    issues: issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

export async function keyRoutes(app: FastifyInstance): Promise<void> {
  app.post('/:contentHash/key-request', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = paramsSchema.safeParse(request.params);

    if (!params.success) {
      return validationError(reply, 'Invalid key request path', params.error.issues);
    }

    const body = keyRequestSchema.safeParse(request.body);

    if (!body.success) {
      return validationError(reply, 'Invalid key request body', body.error.issues);
    }

    const signature = await verifyKeyRequestSignature({
      contentHash: params.data.contentHash,
      ...body.data,
    });

    if (!signature.valid) {
      return reply.status(401).send({ error: signature.reason });
    }

    const access = await checkTrackAccess({
      contentHash: params.data.contentHash,
      listenerAddress: body.data.address,
      chainId: body.data.chainId,
    });

    if (!access.allowed) {
      return reply.status(403).send({ error: access.reason });
    }

    const keyStatus = getContentKeyStatus(params.data.contentHash);

    return reply.status(501).send({
      error: 'Content-key delivery is not implemented in this skeleton',
      code: 'KEY_DELIVERY_NOT_IMPLEMENTED',
      keyStatus,
    });
  });
}
