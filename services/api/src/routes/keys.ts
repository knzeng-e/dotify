// Content-key delivery route (Sprint 0, Ticket 03).
//
// POST /api/tracks/:contentHash/key-request
//   Wallet-signed request for a per-track content key. The signature, replay
//   protection, and on-chain access policy are all enforced server-side; a
//   denial is answered with a preview-mode response (the room is a doorway,
//   not a wallet checkpoint), never with the key.
//
// Note there is intentionally no publish-time key endpoint: artists upload
// raw audio to /api/uploads/audio and the backend encrypts server-side, so
// the derived key never has to leave this service except through this
// access-checked route.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  checkTrackAccess as defaultCheckTrackAccess,
  type TrackAccessRequest,
  type TrackAccessResult,
} from '../services/chainAccess.js';
import { deriveContentKey as defaultDeriveContentKey, type ContentKeyResult } from '../services/keyVault.js';
import {
  verifySignedRequest as defaultVerifySignedRequest,
  type KeySignatureRequest,
  type SignatureVerification,
} from '../services/signatures.js';

const PREVIEW_RATIO = 0.42;

const paramsSchema = z.object({
  contentHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid content hash'),
});

const signedBodySchema = z.object({
  requester: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid EVM address'),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, 'Invalid signature'),
  nonce: z.string().min(16, 'Nonce is required'),
  chainId: z.number().int().positive(),
  expiresAt: z.string().datetime(),
});

// 'room_listener' is intentionally not accepted; room listeners never get keys.
const keyRequestBodySchema = signedBodySchema.extend({
  purpose: z.enum(['individual', 'room_host']),
});

export type KeyRouteDeps = {
  verifySignedRequest: (request: KeySignatureRequest) => Promise<SignatureVerification>;
  checkTrackAccess: (request: TrackAccessRequest) => Promise<TrackAccessResult>;
  deriveContentKey: (contentHash: string) => ContentKeyResult;
};

const defaultDeps: KeyRouteDeps = {
  verifySignedRequest: defaultVerifySignedRequest,
  checkTrackAccess: defaultCheckTrackAccess,
  deriveContentKey: defaultDeriveContentKey,
};

function validationError(reply: FastifyReply, error: string, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error,
    issues: issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

function deniedResponse(denial: Extract<TrackAccessResult, { allowed: false }>, purpose: 'individual' | 'room_host') {
  const accessRequired = denial.code === 'HOST_ACCESS_REQUIRED' || denial.code === 'LISTENER_ACCESS_REQUIRED';
  return {
    access: 'denied' as const,
    playbackMode: 'preview' as const,
    previewRatio: PREVIEW_RATIO,
    reason: denial.code,
    message: denial.reason,
    hostAction: accessRequired
      ? { type: 'unlock' as const, label: purpose === 'room_host' ? 'Unlock full stream' : 'Unlock full track' }
      : { type: 'none' as const, label: '' },
  };
}

export function createKeyRoutes(deps: KeyRouteDeps = defaultDeps) {
  return async function keyRoutes(app: FastifyInstance): Promise<void> {
    app.post('/:contentHash/key-request', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = paramsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, 'Invalid key request path', params.error.issues);
      }

      const body = keyRequestBodySchema.safeParse(request.body);
      if (!body.success) {
        return validationError(reply, 'Invalid key request body', body.error.issues);
      }

      const signature = await deps.verifySignedRequest({
        action: 'REQUEST_CONTENT_KEY',
        purpose: body.data.purpose,
        contentHash: params.data.contentHash,
        requester: body.data.requester,
        chainId: body.data.chainId,
        nonce: body.data.nonce,
        expiresAt: body.data.expiresAt,
        signature: body.data.signature,
      });

      if (!signature.valid) {
        return reply.status(401).send({ error: signature.reason, code: signature.code });
      }

      const access = await deps.checkTrackAccess({
        contentHash: params.data.contentHash,
        requester: body.data.requester,
        purpose: body.data.purpose,
      });

      if (!access.allowed) {
        // Denial is a normal product state, not a transport error: the
        // listener (or room host) falls back to the 42% preview.
        return reply.status(200).send(deniedResponse(access, body.data.purpose));
      }

      const key = deps.deriveContentKey(params.data.contentHash);
      if (!key.ok) {
        return reply.status(503).send({ error: key.reason, code: key.code });
      }

      return reply.status(200).send({
        access: 'allowed' as const,
        playbackMode: 'full' as const,
        previewRatio: PREVIEW_RATIO,
        contentKey: key.contentKey,
        runtime: access.runtime,
      });
    });

  };
}

export const keyRoutes = createKeyRoutes();
