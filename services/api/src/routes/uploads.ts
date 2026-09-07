import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { blake2b } from '@noble/hashes/blake2';
import { z } from 'zod';
import { encryptAudioV2Container } from '../services/audioV2.js';
import { checkArtistAuthority as defaultCheckArtistAuthority, type ArtistAuthorityResult } from '../services/chainAccess.js';
import { deriveContentKeyBytes as defaultDeriveContentKeyBytes } from '../services/keyVault.js';
import { detectAudioMedia, detectImageMedia } from '../services/mediaValidation.js';
import { PinataError, PinataUnconfiguredError, pinFileToPinata, pinJsonToPinata } from '../services/pinata.js';
import { verifySessionToken as defaultVerifySessionToken, type SessionVerification } from '../services/sessionTokens.js';
import {
  uploadAuthorizationService,
  type UploadAuthorizationErrorCode,
  type UploadAuthorizationService,
  type UploadLease,
  type UploadPurpose
} from '../services/uploadAuthorizations.js';

export const AUDIO_MAX_BYTES = 50 * 1024 * 1024;
export const COVER_MAX_BYTES = 5 * 1024 * 1024;
export const META_MAX_BYTES = 50 * 1024;

const PURPOSE_LIMITS: Record<UploadPurpose, number> = {
  audio: AUDIO_MAX_BYTES,
  cover: COVER_MAX_BYTES,
  metadata: META_MAX_BYTES
};

const contentHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'contentHash must be 0x-prefixed 32-byte hex');
const authorizationRequestSchema = z.object({
  purpose: z.enum(['audio', 'cover', 'metadata']),
  bytes: z.number().int().positive()
});

const dotifyManifestSchema = z.object({
  schema: z.literal('dotify.track.v1'),
  createdAt: z.string().datetime(),
  assets: z
    .object({
      audioCID: z.string().min(1),
      coverCID: z.string(),
      encrypted: z.boolean().optional(),
      previewCID: z.string().optional()
    })
    .strict(),
  track: z
    .object({
      contentHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
      title: z.string().min(1).max(200),
      artistName: z.string().min(1).max(200),
      description: z.string().max(2000),
      accessMode: z.enum(['human-free', 'classic', 'free']),
      priceDot: z.string(),
      requiredPersonhood: z.string(),
      zone: z.string()
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
}).strict();

type PinFile = (bytes: Uint8Array, filename: string, keyvalues?: Record<string, string>, signal?: AbortSignal) => Promise<string>;
type PinJson = (json: unknown, name: string, keyvalues?: Record<string, string>, signal?: AbortSignal) => Promise<string>;

export type UploadRouteDeps = {
  verifySessionToken: (token: string) => SessionVerification;
  checkArtistAuthority: (requester: string) => Promise<ArtistAuthorityResult>;
  authorizations: UploadAuthorizationService;
  deriveContentKeyBytes: (contentHash: string) => Buffer | null;
  encryptAudio: typeof encryptAudioV2Container;
  pinFile: PinFile;
  pinJson: PinJson;
};

const defaultDeps: UploadRouteDeps = {
  verifySessionToken: defaultVerifySessionToken,
  checkArtistAuthority: defaultCheckArtistAuthority,
  authorizations: uploadAuthorizationService,
  deriveContentKeyBytes: defaultDeriveContentKeyBytes,
  encryptAudio: encryptAudioV2Container,
  pinFile: pinFileToPinata,
  pinJson: pinJsonToPinata
};

function badRequest(reply: FastifyReply, error: string, code = 'UPLOAD_INVALID') {
  return reply.status(400).send({ error, code });
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  return match?.[1] ?? null;
}

function authorizationError(reply: FastifyReply, code: UploadAuthorizationErrorCode, reason: string) {
  const status =
    code === 'UPLOAD_AUTH_NOT_CONFIGURED'
      ? 503
      : code.includes('QUOTA') || code.includes('CONCURRENCY')
        ? 429
        : code === 'UPLOAD_PURPOSE_MISMATCH'
          ? 403
          : code === 'UPLOAD_AUTH_REPLAYED'
            ? 409
            : 401;
  return reply.status(status).send({ error: reason, code });
}

function handleUploadError(error: unknown, reply: FastifyReply) {
  if (error instanceof PinataUnconfiguredError) {
    return reply.status(503).send({ error: 'Upload service is not configured. Contact the operator.', code: 'UPLOAD_STORAGE_NOT_CONFIGURED' });
  }
  if (error instanceof PinataError) {
    return reply.status(502).send({ error: 'Upload to storage failed. Please try again.', code: 'UPLOAD_STORAGE_FAILED' });
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return reply.status(499).send({ error: 'Upload was cancelled before storage completed.', code: 'UPLOAD_CANCELLED' });
  }
  throw error;
}

function beginAuthorizedUpload(
  request: FastifyRequest,
  reply: FastifyReply,
  purpose: UploadPurpose,
  authorizations: UploadAuthorizationService
): UploadLease | null {
  const token = bearerToken(request);
  if (!token) {
    reply.status(401).send({ error: 'A scoped upload authorization is required.', code: 'UPLOAD_AUTH_REQUIRED' });
    return null;
  }
  const result = authorizations.begin(token, purpose);
  if (!result.ok) {
    authorizationError(reply, result.code, result.reason);
    return null;
  }
  return result.lease;
}

function requestAbortController(request: FastifyRequest): { signal: AbortSignal; detach: () => void } {
  const controller = new AbortController();
  const onAborted = () => controller.abort();
  request.raw.once('aborted', onAborted);
  return {
    signal: controller.signal,
    detach: () => request.raw.off('aborted', onAborted)
  };
}

function multipartLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return message.toLowerCase().includes('file size limit') || message.includes('FST_MULTIPART');
}

export function createUploadRoutes(deps: UploadRouteDeps = defaultDeps) {
  return async function uploadRoutes(app: FastifyInstance): Promise<void> {
    app.post('/authorize', async (request: FastifyRequest, reply: FastifyReply) => {
      const token = bearerToken(request);
      if (!token) return reply.status(401).send({ error: 'Sign in before requesting upload capacity.', code: 'SESSION_REQUIRED' });

      const session = deps.verifySessionToken(token);
      if (!session.valid) return reply.status(401).send({ error: session.reason, code: session.code });

      const parsed = authorizationRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid upload authorization request',
          code: 'UPLOAD_AUTH_REQUEST_INVALID',
          issues: parsed.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }))
        });
      }
      const purposeLimit = PURPOSE_LIMITS[parsed.data.purpose];
      if (parsed.data.bytes > purposeLimit) {
        return reply.status(413).send({
          error: `${parsed.data.purpose} upload exceeds the ${purposeLimit} byte limit.`,
          code: 'UPLOAD_TOO_LARGE'
        });
      }

      const authority = await deps.checkArtistAuthority(session.address);
      if (!authority.allowed) {
        const status = authority.code === 'RPC_UNAVAILABLE' ? 503 : 403;
        return reply.status(status).send({ error: authority.reason, code: authority.code });
      }

      const issued = deps.authorizations.issue({
        address: session.address,
        chainId: session.chainId,
        purpose: parsed.data.purpose,
        maxBytes: parsed.data.bytes
      });
      if (!issued.ok) return authorizationError(reply, issued.code, issued.reason);
      return reply.status(200).send({
        uploadAuthorization: issued.token,
        expiresAt: issued.expiresAt,
        purpose: issued.purpose,
        maxBytes: issued.maxBytes
      });
    });

    app.post('/audio', async (request: FastifyRequest, reply: FastifyReply) => {
      const lease = beginAuthorizedUpload(request, reply, 'audio', deps.authorizations);
      if (!lease) return;
      const abort = requestAbortController(request);
      let completed = false;

      try {
        let fileBuffer: Buffer | undefined;
        let contentHash = '';
        try {
          for await (const part of request.parts({ limits: { fileSize: Math.min(AUDIO_MAX_BYTES, lease.payload.maxBytes), files: 1 } })) {
            if (part.type === 'file' && part.fieldname === 'audio') {
              fileBuffer = await part.toBuffer();
            } else if (part.type === 'file') {
              part.file.resume();
            } else if (part.type === 'field' && part.fieldname === 'contentHash') {
              contentHash = typeof part.value === 'string' ? part.value.trim() : '';
            }
          }
        } catch (error) {
          if (multipartLimitError(error)) {
            return reply.status(413).send({ error: 'Audio file exceeds its authorized byte budget.', code: 'UPLOAD_BUDGET_EXCEEDED' });
          }
          throw error;
        }

        if (!fileBuffer || fileBuffer.length === 0) return badRequest(reply, 'No audio file received. Include the file as field "audio".');
        if (fileBuffer.length > lease.payload.maxBytes) {
          return reply.status(413).send({ error: 'Audio file exceeds its authorized byte budget.', code: 'UPLOAD_BUDGET_EXCEEDED' });
        }
        const media = detectAudioMedia(fileBuffer);
        if (!media) return badRequest(reply, 'Received bytes are not a supported audio file.', 'UPLOAD_MEDIA_INVALID');

        const hashCheck = contentHashSchema.safeParse(contentHash);
        if (!hashCheck.success) return badRequest(reply, 'contentHash field is required and must be a 0x-prefixed 32-byte hex string.');
        const normalizedHash = hashCheck.data.toLowerCase();
        const uploadedContentHash = `0x${Buffer.from(blake2b(fileBuffer, { dkLen: 32 })).toString('hex')}`;
        if (uploadedContentHash !== normalizedHash) {
          return badRequest(reply, 'contentHash does not match the uploaded audio file. Select the file again and retry.');
        }

        const contentKey = deps.deriveContentKeyBytes(normalizedHash);
        if (!contentKey) {
          return reply.status(503).send({
            error: 'Server-side encryption is not configured. Set CONTENT_KEY_MASTER_SECRET (32+ bytes of hex).',
            code: 'CONTENT_KEY_NOT_CONFIGURED'
          });
        }

        let encrypted: Buffer;
        try {
          encrypted = deps.encryptAudio(fileBuffer, contentKey, { contentHash: normalizedHash, mediaMime: media.mime });
        } catch {
          request.log.error('Audio encryption failed');
          return reply.status(500).send({ error: 'Audio encryption failed.', code: 'AUDIO_ENCRYPTION_FAILED' });
        }

        let cid: string;
        try {
          cid = await deps.pinFile(
            new Uint8Array(encrypted),
            `${normalizedHash.slice(2, 10)}.dav2`,
            {
              app: 'dotify',
              type: 'audio',
              encrypted: 'true',
              container: 'dotify.audio.v2',
              contentHash: normalizedHash
            },
            abort.signal
          );
        } catch (error) {
          return handleUploadError(error, reply);
        }

        completed = lease.complete(fileBuffer.length);
        if (!completed) return reply.status(500).send({ error: 'Upload quota accounting failed.', code: 'UPLOAD_ACCOUNTING_FAILED' });
        return reply.status(200).send({ ref: `dotify:enc:v2:ipfs://${cid}`, contentHash: normalizedHash });
      } finally {
        abort.detach();
        if (!completed) lease.abort();
      }
    });

    app.post('/cover', async (request: FastifyRequest, reply: FastifyReply) => {
      const lease = beginAuthorizedUpload(request, reply, 'cover', deps.authorizations);
      if (!lease) return;
      const abort = requestAbortController(request);
      let completed = false;

      try {
        let fileBuffer: Buffer | undefined;
        try {
          for await (const part of request.parts({ limits: { fileSize: Math.min(COVER_MAX_BYTES, lease.payload.maxBytes), files: 1 } })) {
            if (part.type === 'file' && part.fieldname === 'cover') fileBuffer = await part.toBuffer();
            else if (part.type === 'file') part.file.resume();
          }
        } catch (error) {
          if (multipartLimitError(error)) {
            return reply.status(413).send({ error: 'Cover image exceeds its authorized byte budget.', code: 'UPLOAD_BUDGET_EXCEEDED' });
          }
          throw error;
        }

        if (!fileBuffer || fileBuffer.length === 0) return badRequest(reply, 'No cover image received. Include the file as field "cover".');
        if (fileBuffer.length > lease.payload.maxBytes) {
          return reply.status(413).send({ error: 'Cover image exceeds its authorized byte budget.', code: 'UPLOAD_BUDGET_EXCEEDED' });
        }
        const media = detectImageMedia(fileBuffer);
        if (!media) return badRequest(reply, 'Received bytes are not a supported cover image.', 'UPLOAD_MEDIA_INVALID');

        let cid: string;
        try {
          cid = await deps.pinFile(
            new Uint8Array(fileBuffer),
            `${lease.payload.address.slice(2, 10)}-${lease.payload.jti}.${media.extension}`,
            {
              app: 'dotify',
              type: 'cover'
            },
            abort.signal
          );
        } catch (error) {
          return handleUploadError(error, reply);
        }

        completed = lease.complete(fileBuffer.length);
        if (!completed) return reply.status(500).send({ error: 'Upload quota accounting failed.', code: 'UPLOAD_ACCOUNTING_FAILED' });
        return reply.status(200).send({ ref: `ipfs://${cid}` });
      } finally {
        abort.detach();
        if (!completed) lease.abort();
      }
    });

    app.post('/metadata', { bodyLimit: META_MAX_BYTES }, async (request: FastifyRequest, reply: FastifyReply) => {
      const lease = beginAuthorizedUpload(request, reply, 'metadata', deps.authorizations);
      if (!lease) return;
      const abort = requestAbortController(request);
      let completed = false;

      try {
        const contentLength = Number(request.headers['content-length']);
        if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > lease.payload.maxBytes) {
          return reply.status(413).send({ error: 'Track manifest exceeds its authorized byte budget.', code: 'UPLOAD_BUDGET_EXCEEDED' });
        }
        const parsed = dotifyManifestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            error: 'Invalid Dotify track manifest',
            code: 'UPLOAD_MANIFEST_INVALID',
            issues: parsed.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }))
          });
        }
        const manifest = parsed.data;
        const actualBytes = Buffer.byteLength(JSON.stringify(manifest));
        if (actualBytes > lease.payload.maxBytes) {
          return reply.status(413).send({ error: 'Track manifest exceeds its authorized byte budget.', code: 'UPLOAD_BUDGET_EXCEEDED' });
        }

        let cid: string;
        try {
          cid = await deps.pinJson(
            manifest,
            `${manifest.track.contentHash.slice(2, 10)}.json`,
            {
              app: 'dotify',
              type: 'track-metadata',
              contentHash: manifest.track.contentHash
            },
            abort.signal
          );
        } catch (error) {
          return handleUploadError(error, reply);
        }

        completed = lease.complete(actualBytes);
        if (!completed) return reply.status(500).send({ error: 'Upload quota accounting failed.', code: 'UPLOAD_ACCOUNTING_FAILED' });
        return reply.status(200).send({ ref: `ipfs://${cid}` });
      } finally {
        abort.detach();
        if (!completed) lease.abort();
      }
    });
  };
}

export const uploadRoutes = createUploadRoutes();
