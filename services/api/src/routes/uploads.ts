import { StreamingJobError, type StreamingJobs } from '../services/streamingJobs.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { blake2b } from '@noble/hashes/blake2';
import { z } from 'zod';
import { checkArtistAuthority as defaultCheckArtistAuthority, type ArtistAuthorityResult } from '../services/chainAccess.js';
import {
  deriveContentKeyBytes as defaultDeriveContentKeyBytes,
  getActiveContentKeyVersion,
  type ContentKeyDerivationInput,
  type ContentKeyVersion
} from '../services/keyVault.js';
import { detectAudioMedia, detectImageMedia } from '../services/mediaValidation.js';
import { createResponsiveCover, type ResponsiveCover } from '../services/coverVariants.js';
import { PinataError, PinataUnconfiguredError, pinFilesToPinata, pinJsonToPinata, type PinataFile } from '../services/pinata.js';
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

const dotifyManifestSchema = z
  .object({
    schema: z.literal('dotify.track.v2'),
    createdAt: z.string().datetime(),
    assets: z
      .object({
        audioCID: z.string().min(1),
        coverCID: z.string(),
        encrypted: z.boolean().optional(),
        keyVersion: z.string().min(1).max(80).optional(),
        previewCID: z.string().optional()
      })
      .strict(),
    track: z
      .object({
        contentHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
        title: z.string().min(1).max(200),
        artistName: z.string().min(1).max(200),
        description: z.string().max(2000),
        durationSeconds: z
          .number()
          .positive()
          .max(24 * 60 * 60)
          .nullable(),
        accessMode: z.enum(['human-free', 'classic', 'free']),
        priceDot: z.string(),
        requiredPersonhood: z.string(),
        zone: z.string()
      })
      .strict(),
    editorial: z
      .object({
        releaseKind: z.enum(['single', 'album-track', 'ep-track', 'live', 'remix', 'other']),
        projectTitle: z.string().max(200),
        version: z.string().max(120),
        releaseDate: z.string().regex(/^(|\d{4}|\d{4}-\d{2}-\d{2})$/, 'releaseDate must be empty, YYYY or YYYY-MM-DD'),
        genres: z.array(z.string().min(1).max(80)).max(8),
        languages: z.array(z.string().min(1).max(80)).max(8),
        credits: z
          .array(
            z
              .object({
                name: z.string().min(1).max(200),
                role: z.enum(['performer', 'writer', 'composer', 'producer', 'featured-artist', 'engineer', 'other'])
              })
              .strict()
          )
          .max(20),
        label: z.string().max(200),
        productionLocation: z.string().max(200),
        explicitContent: z.boolean(),
        isrc: z.string().max(15),
        copyrightNotice: z.string().max(300),
        masterNotice: z.string().max(300)
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
  })
  .strict();

type PinFiles = (files: PinataFile[], name: string, keyvalues?: Record<string, string>, signal?: AbortSignal) => Promise<string>;
type PinJson = (json: unknown, name: string, keyvalues?: Record<string, string>, signal?: AbortSignal) => Promise<string>;

export type UploadRouteDeps = {
  verifySessionToken: (token: string) => SessionVerification | Promise<SessionVerification>;
  checkArtistAuthority: (requester: string) => Promise<ArtistAuthorityResult>;
  authorizations: UploadAuthorizationService;
  getActiveContentKeyVersion: () => ContentKeyVersion;
  deriveContentKeyBytes: (input: ContentKeyDerivationInput) => Buffer | null;
  createCover: (bytes: Uint8Array, originalExtension: string) => Promise<ResponsiveCover>;
  pinFiles: PinFiles;
  pinJson: PinJson;
};

const defaultDeps: UploadRouteDeps = {
  verifySessionToken: defaultVerifySessionToken,
  checkArtistAuthority: defaultCheckArtistAuthority,
  authorizations: uploadAuthorizationService,
  getActiveContentKeyVersion,
  deriveContentKeyBytes: defaultDeriveContentKeyBytes,
  createCover: createResponsiveCover,
  pinFiles: pinFilesToPinata,
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

async function beginAuthorizedUpload(
  request: FastifyRequest,
  reply: FastifyReply,
  purpose: UploadPurpose,
  authorizations: UploadAuthorizationService
): Promise<UploadLease | null> {
  const token = bearerToken(request);
  if (!token) {
    reply.status(401).send({ error: 'A scoped upload authorization is required.', code: 'UPLOAD_AUTH_REQUIRED' });
    return null;
  }
  const result = await authorizations.begin(token, purpose);
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

export function createUploadRoutes(deps: UploadRouteDeps = defaultDeps, jobs?: StreamingJobs) {
  return async function uploadRoutes(app: FastifyInstance): Promise<void> {
    const sessionForJob = async (request: FastifyRequest, reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-store');
      const token = bearerToken(request);
      const session = token ? await deps.verifySessionToken(token) : null;
      if (!session?.valid) {
        reply.status(401).send({ error: 'Sign in to continue preparing your music.', code: 'SESSION_REQUIRED' });
        return null;
      }
      if (!jobs) {
        reply.status(503).send({ error: 'Audio preparation is not configured.', code: 'STREAMING_NOT_CONFIGURED' });
        return null;
      }
      return session;
    };
    app.get<{ Params: { id: string } }>('/audio/jobs/:id', async (request, reply) => {
      const session = await sessionForJob(request, reply);
      if (!session) return;
      try {
        const job = jobs!.get(request.params.id, session.address, session.chainId);
        if (!job) return reply.status(404).send({ error: 'Audio preparation was not found for this account.', code: 'STREAMING_JOB_NOT_FOUND' });
        return reply.send(job);
      } catch (error) {
        if (error instanceof StreamingJobError)
          return reply.status(error.status).send({ error: 'Audio preparation is temporarily unavailable.', code: error.code });
        throw error;
      }
    });
    app.post<{ Params: { id: string } }>('/audio/jobs/:id/discard', async (request, reply) => {
      const session = await sessionForJob(request, reply);
      if (!session) return;
      try {
        await jobs!.discard(request.params.id, session.address, session.chainId);
        return reply.status(204).send();
      } catch (error) {
        if (error instanceof StreamingJobError)
          return reply.status(error.status).send({
            error:
              error.code === 'STREAMING_RECOVERY_REQUIRED'
                ? 'Your music is saved. A previous storage operation needs to be checked before this preparation can be removed. Please contact the Dotify operator.'
                : 'Only a failed preparation can be removed by its artist.',
            code: error.code
          });
        throw error;
      }
    });
    app.post<{ Params: { id: string } }>('/audio/jobs/:id/retry', async (request, reply) => {
      const session = await sessionForJob(request, reply);
      if (!session) return;
      try {
        return reply.send(await jobs!.retry(request.params.id, session.address, session.chainId));
      } catch (error) {
        if (error instanceof StreamingJobError)
          return reply.status(error.status).send({
            error:
              error.code === 'STREAMING_RETRY_LIMIT'
                ? 'This preparation has reached its retry limit. Your draft is safe. Please contact the Dotify operator to recover it.'
                : 'Audio preparation could not be restarted. Your upload is still saved.',
            code: error.code
          });
        throw error;
      }
    });
    app.post('/authorize', async (request: FastifyRequest, reply: FastifyReply) => {
      const token = bearerToken(request);
      if (!token) return reply.status(401).send({ error: 'Sign in before requesting upload capacity.', code: 'SESSION_REQUIRED' });

      const session = await deps.verifySessionToken(token);
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

      const issued = await deps.authorizations.issue({
        address: session.address,
        runtimeAddress: authority.runtime,
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
      if (!jobs) return reply.code(503).send({ code: 'STREAMING_UNAVAILABLE', error: 'Audio preparation is unavailable. Please try again later.' });
      const lease = await beginAuthorizedUpload(request, reply, 'audio', deps.authorizations);
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

        const keyVersion = deps.getActiveContentKeyVersion();
        const contentKey = deps.deriveContentKeyBytes({
          contentHash: normalizedHash,
          keyVersion,
          chainId: lease.payload.chainId,
          runtimeAddress: lease.payload.runtimeAddress
        });
        if (!contentKey) {
          return reply.status(503).send({
            error: `Server-side encryption is not configured for content-key version ${keyVersion}. Retain that version secret or configure a new active version.`,
            code: 'CONTENT_KEY_NOT_CONFIGURED'
          });
        }

        try {
          abort.signal.throwIfAborted();
          const job = await jobs.enqueue({
            owner: lease.payload.address,
            scope: { chainId: lease.payload.chainId, runtimeAddress: lease.payload.runtimeAddress.toLowerCase(), contentHash: normalizedHash, keyVersion },
            master: fileBuffer
          });
          completed = await lease.complete(fileBuffer.length);
          if (!completed) return reply.status(500).send({ error: 'Upload quota accounting failed.', code: 'UPLOAD_ACCOUNTING_FAILED' });
          return reply.header('Cache-Control', 'no-store').status(202).send(job);
        } catch (error) {
          if (error instanceof StreamingJobError)
            return reply.status(error.status).send({ error: 'Audio preparation is busy or unavailable. Please try again.', code: error.code });
          throw error;
        } finally {
          contentKey.fill(0);
          fileBuffer.fill(0);
        }
      } finally {
        abort.detach();
        if (!completed) await lease.abort();
      }
    });

    app.post('/cover', async (request: FastifyRequest, reply: FastifyReply) => {
      const lease = await beginAuthorizedUpload(request, reply, 'cover', deps.authorizations);
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

        let cover: ResponsiveCover;
        try {
          cover = await deps.createCover(new Uint8Array(fileBuffer), media.extension);
        } catch {
          request.log.info('Cover image processing rejected the uploaded bytes');
          return badRequest(reply, 'The cover image could not be prepared. Choose a valid JPEG, PNG, WebP, or GIF image.', 'UPLOAD_MEDIA_INVALID');
        }

        let cid: string;
        try {
          cid = await deps.pinFiles(
            cover.files,
            `${lease.payload.address.slice(2, 10)}-${lease.payload.jti}-cover`,
            {
              app: 'dotify',
              type: 'responsive-cover',
              variants: '64,160,320,640',
              original: 'preserved'
            },
            abort.signal
          );
        } catch (error) {
          return handleUploadError(error, reply);
        }

        completed = await lease.complete(fileBuffer.length);
        if (!completed) return reply.status(500).send({ error: 'Upload quota accounting failed.', code: 'UPLOAD_ACCOUNTING_FAILED' });
        return reply.status(200).send({
          ref: `ipfs://${cid}/${cover.primaryPath}`,
          responsive: {
            placeholder: `ipfs://${cid}/${cover.placeholderPath}`,
            widths: [64, 160, 320, 640],
            width: cover.width,
            height: cover.height,
            format: 'webp'
          }
        });
      } finally {
        abort.detach();
        if (!completed) await lease.abort();
      }
    });

    app.post('/metadata', { bodyLimit: META_MAX_BYTES }, async (request: FastifyRequest, reply: FastifyReply) => {
      const lease = await beginAuthorizedUpload(request, reply, 'metadata', deps.authorizations);
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

        completed = await lease.complete(actualBytes);
        if (!completed) return reply.status(500).send({ error: 'Upload quota accounting failed.', code: 'UPLOAD_ACCOUNTING_FAILED' });
        return reply.status(200).send({ ref: `ipfs://${cid}` });
      } finally {
        abort.detach();
        if (!completed) await lease.abort();
      }
    });
  };
}

export const uploadRoutes = createUploadRoutes();
