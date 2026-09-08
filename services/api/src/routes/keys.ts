// Content-key delivery route (Sprint 0, Ticket 03).
//
// POST /api/tracks/:contentHash/key-request
//   Wallet-signed request for a per-track content key. The signature, replay
//   protection, and on-chain access policy are all enforced server-side; a
//   denial is answered with an unlock/personhood CTA response, never with the
//   key.
//
// Note there is intentionally no publish-time key endpoint: artists upload
// raw audio to /api/uploads/audio and the backend encrypts server-side, so
// the derived key never has to leave this service except through this
// access-checked route.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { checkDotifyChainId } from '../services/chainDomain.js';
import {
  checkPublicAccess as defaultCheckPublicAccess,
  checkTrackAccess as defaultCheckTrackAccess,
  type PublicTrackAccessRequest,
  type ReleaseKeyIdentity,
  type TrackAccessRequest,
  type TrackAccessResult
} from '../services/chainAccess.js';
import { deriveContentKey as defaultDeriveContentKey, type ContentKeyDerivationInput, type ContentKeyResult } from '../services/keyVault.js';
import {
  EIP191_SIGNATURE_SCHEME,
  PRODUCT_SR25519_SIGNATURE_SCHEME,
  verifySignedRequest as defaultVerifySignedRequest,
  type KeySignatureRequest,
  type SignatureVerification
} from '../services/signatures.js';
import { verifySessionToken as defaultVerifySessionToken, type SessionVerification } from '../services/sessionTokens.js';

const paramsSchema = z.object({
  contentHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid content hash')
});

const signedBaseBodySchema = z.object({
  requester: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid EVM address'),
  nonce: z.string().min(16, 'Nonce is required'),
  chainId: z.number().int().positive(),
  expiresAt: z.string().datetime()
});

const releaseIdentityBodySchema = z.object({
  releaseId: z.string().min(1).max(256).optional(),
  runtimeAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid runtime address').optional(),
  artistAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid artist address').optional(),
  audioRef: z.string().min(1).max(2048).optional(),
  keyVersion: z.string().min(1).max(80).optional()
});

// 'room_listener' is intentionally not accepted; room listeners never get keys.
const keyRequestPurposeSchema = z.object({
  purpose: z.enum(['individual', 'room_host'])
});

const eip191KeyRequestBodySchema = signedBaseBodySchema.merge(keyRequestPurposeSchema).merge(releaseIdentityBodySchema).extend({
  signatureScheme: z.literal(EIP191_SIGNATURE_SCHEME).optional(),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, 'Invalid signature')
});

// 128 hex = bare 64-byte sr25519; 130 hex = MultiSignature-tagged 65-byte
// value. The tag itself is validated in verifySignedRequest, not here.
const productSr25519KeyRequestBodySchema = signedBaseBodySchema.merge(keyRequestPurposeSchema).merge(releaseIdentityBodySchema).extend({
  signatureScheme: z.literal(PRODUCT_SR25519_SIGNATURE_SCHEME),
  signature: z.string().regex(/^0x([0-9a-fA-F]{128}|[0-9a-fA-F]{130})$/, 'Invalid Product sr25519 signature'),
  productPublicKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid Product account public key')
});

const keyRequestBodySchema = z.union([productSr25519KeyRequestBodySchema, eip191KeyRequestBodySchema]);

// Session path (ticket 24 P2): after the one-per-session sign-in, a key
// request carries the bearer token instead of a fresh wallet signature. The
// on-chain access check still runs on every request.
const sessionKeyRequestBodySchema = z.object({
  sessionToken: z.string().min(16),
  purpose: z.enum(['individual', 'room_host'])
}).merge(releaseIdentityBodySchema);

export type KeyRouteDeps = {
  verifySignedRequest: (request: KeySignatureRequest) => Promise<SignatureVerification>;
  verifySessionToken: (token: string) => SessionVerification;
  checkTrackAccess: (request: TrackAccessRequest) => Promise<TrackAccessResult>;
  checkPublicAccess: (request: PublicTrackAccessRequest) => Promise<TrackAccessResult>;
  deriveContentKey: (input: ContentKeyDerivationInput) => ContentKeyResult;
};

const defaultDeps: KeyRouteDeps = {
  verifySignedRequest: defaultVerifySignedRequest,
  verifySessionToken: defaultVerifySessionToken,
  checkTrackAccess: defaultCheckTrackAccess,
  checkPublicAccess: defaultCheckPublicAccess,
  deriveContentKey: defaultDeriveContentKey
};

function validationError(reply: FastifyReply, error: string, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error,
    issues: issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message
    }))
  });
}

function releaseIdentityFromBody(body: Record<string, unknown>): { ok: true; release?: ReleaseKeyIdentity } | { ok: false; issues: z.ZodIssue[] } {
  const names = ['releaseId', 'runtimeAddress', 'artistAddress', 'audioRef', 'keyVersion'] as const;
  const present = names.filter(name => body[name] !== undefined);
  if (present.length === 0) return { ok: true };
  if (present.length !== names.length) {
    const missing = names.filter(name => body[name] === undefined);
    return {
      ok: false,
      issues: missing.map(name => ({
        code: z.ZodIssueCode.custom,
        path: [name],
        message: 'Release identity fields must be supplied together'
      }))
    };
  }

  return {
    ok: true,
    release: {
      releaseId: body.releaseId as string,
      runtimeAddress: body.runtimeAddress as string,
      artistAddress: body.artistAddress as string,
      audioRef: body.audioRef as string,
      keyVersion: body.keyVersion as string
    }
  };
}

// Access model v2 (ticket 24 P1): a denial carries the reason and the action
// the user can take - never a degraded playback mode. The 42% preview framing
// (playbackMode/previewRatio) is retired; unauthorized playback is an unlock
// CTA, not a truncated file.
function deniedResponse(denial: Extract<TrackAccessResult, { allowed: false }>, purpose: 'individual' | 'room_host') {
  const accessRequired = denial.code === 'HOST_ACCESS_REQUIRED' || denial.code === 'LISTENER_ACCESS_REQUIRED';
  return {
    access: 'denied' as const,
    reason: denial.code,
    message: denial.reason,
    hostAction: accessRequired
      ? { type: 'unlock' as const, label: purpose === 'room_host' ? 'Unlock full stream' : 'Unlock full track' }
      : { type: 'none' as const, label: '' }
  };
}

export function createKeyRoutes(deps: KeyRouteDeps = defaultDeps) {
  return async function keyRoutes(app: FastifyInstance): Promise<void> {
    app.post('/:contentHash/key-request', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = paramsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, 'Invalid key request path', params.error.issues);
      }

      // Session-token path first: bodies carrying sessionToken never include a
      // signature, so the two shapes cannot be confused.
      const sessionBody = sessionKeyRequestBodySchema.safeParse(request.body);
      if (sessionBody.success) {
        const release = releaseIdentityFromBody(sessionBody.data);
        if (!release.ok) {
          return validationError(reply, 'Invalid release identity', release.issues);
        }

        const session = deps.verifySessionToken(sessionBody.data.sessionToken);
        if (!session.valid) {
          return reply.status(401).send({ error: session.reason, code: session.code });
        }

        const domain = checkDotifyChainId(session.chainId);
        if (!domain.ok) {
          return reply.status(401).send({ error: domain.reason, code: domain.code });
        }

        const access = await deps.checkTrackAccess({
          contentHash: params.data.contentHash,
          requester: session.address,
          purpose: sessionBody.data.purpose,
          release: release.release
        });
        if (!access.allowed) {
          return reply.status(200).send(deniedResponse(access, sessionBody.data.purpose));
        }

        const key = deps.deriveContentKey(access.keyScope);
        if (!key.ok) {
          return reply.status(503).send({ error: key.reason, code: key.code });
        }

        return reply.status(200).send({
          access: 'allowed' as const,
          playbackMode: 'full' as const,
          contentKey: key.contentKey,
          runtime: access.runtime
        });
      }

      const body = keyRequestBodySchema.safeParse(request.body);
      if (!body.success) {
        return validationError(reply, 'Invalid key request body', body.error.issues);
      }

      const release = releaseIdentityFromBody(body.data);
      if (!release.ok) {
        return validationError(reply, 'Invalid release identity', release.issues);
      }

      const domain = checkDotifyChainId(body.data.chainId);
      if (!domain.ok) {
        return reply.status(401).send({ error: domain.reason, code: domain.code });
      }

      const signatureRequest: KeySignatureRequest =
        body.data.signatureScheme === PRODUCT_SR25519_SIGNATURE_SCHEME
          ? {
              action: 'REQUEST_CONTENT_KEY',
              purpose: body.data.purpose,
              contentHash: params.data.contentHash,
              requester: body.data.requester,
              chainId: body.data.chainId,
              nonce: body.data.nonce,
              expiresAt: body.data.expiresAt,
              release: release.release,
              signature: body.data.signature,
              signatureScheme: PRODUCT_SR25519_SIGNATURE_SCHEME,
              productPublicKey: body.data.productPublicKey
            }
          : {
              action: 'REQUEST_CONTENT_KEY',
              purpose: body.data.purpose,
              contentHash: params.data.contentHash,
              requester: body.data.requester,
              chainId: body.data.chainId,
              nonce: body.data.nonce,
              expiresAt: body.data.expiresAt,
              release: release.release,
              signature: body.data.signature,
              signatureScheme: EIP191_SIGNATURE_SCHEME
            };

      const signature = await deps.verifySignedRequest(signatureRequest);

      if (!signature.valid) {
        return reply.status(401).send({ error: signature.reason, code: signature.code });
      }

      const access = await deps.checkTrackAccess({
        contentHash: params.data.contentHash,
        requester: body.data.requester,
        purpose: body.data.purpose,
        release: release.release
      });

      if (!access.allowed) {
        // Denial is a normal product state, not a transport error: the
        // listener (or room host) sees the next valid action, never a key.
        return reply.status(200).send(deniedResponse(access, body.data.purpose));
      }

      const key = deps.deriveContentKey(access.keyScope);
      if (!key.ok) {
        return reply.status(503).send({ error: key.reason, code: key.code });
      }

      return reply.status(200).send({
        access: 'allowed' as const,
        playbackMode: 'full' as const,
        contentKey: key.contentKey,
        runtime: access.runtime
      });
    });

    // Free-track key delivery (access model v2): no signature, no wallet, no
    // session. The service verifies on-chain that the track's CURRENT mode
    // grants access to everyone (musicAccCanAccess with the zero address) and
    // only then releases the key. Free must feel free - but the check is
    // still chain-authoritative and fail-closed, so a track flipped back to
    // paid stops being served here on the next request. Covered by the
    // API-wide rate limit.
    app.post('/:contentHash/free-key', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = paramsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, 'Invalid key request path', params.error.issues);
      }

      const body = releaseIdentityBodySchema.safeParse(request.body ?? {});
      if (!body.success) {
        return validationError(reply, 'Invalid free key request body', body.error.issues);
      }
      const release = releaseIdentityFromBody(body.data);
      if (!release.ok) {
        return validationError(reply, 'Invalid release identity', release.issues);
      }

      const access = await deps.checkPublicAccess({ contentHash: params.data.contentHash, release: release.release });
      if (!access.allowed) {
        return reply.status(200).send(deniedResponse(access, 'individual'));
      }

      const key = deps.deriveContentKey(access.keyScope);
      if (!key.ok) {
        return reply.status(503).send({ error: key.reason, code: key.code });
      }

      return reply.status(200).send({
        access: 'allowed' as const,
        playbackMode: 'full' as const,
        contentKey: key.contentKey,
        runtime: access.runtime
      });
    });
  };
}

export const keyRoutes = createKeyRoutes();
