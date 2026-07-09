import { createCipheriv, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { deriveContentKeyBytes } from '../services/keyVault.js';
import { PinataError, PinataUnconfiguredError, pinFileToPinata, pinJsonToPinata } from '../services/pinata.js';

// ---------------------------------------------------------------------------
// Size limits
// ---------------------------------------------------------------------------
const AUDIO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const COVER_MAX_BYTES = 5 * 1024 * 1024;  //  5 MB
const META_MAX_BYTES  = 50 * 1024;         // 50 KB

// ---------------------------------------------------------------------------
// MIME allowlists
// ---------------------------------------------------------------------------
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'audio/wav',
  'audio/aac',
  'audio/x-wav',
  'audio/x-m4a',
  'audio/x-flac',
]);

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// ---------------------------------------------------------------------------
// Content hash format
// ---------------------------------------------------------------------------
const contentHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'contentHash must be 0x-prefixed 32-byte hex');

// ---------------------------------------------------------------------------
// Canonical Dotify manifest schema (Ticket 02 validation surface)
// ---------------------------------------------------------------------------
const dotifyManifestSchema = z.object({
  schema: z.literal('dotify.track.v1'),
  createdAt: z.string().datetime(),
  assets: z.object({
    audioCID: z.string().min(1),
    coverCID: z.string(),
    encrypted: z.boolean().optional(),
    // Retired 42% preview asset (ticket 18, removed by access model v2).
    // Kept optional so already-pinned manifests still validate.
    previewCID: z.string().optional(),
  }),
  track: z.object({
    contentHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    title: z.string().min(1).max(200),
    artistName: z.string().min(1).max(200),
    description: z.string().max(2000),
    accessMode: z.enum(['human-free', 'classic', 'free']),
    priceDot: z.string(),
    requiredPersonhood: z.string(),
    zone: z.string(),
  }),
  royalties: z.array(
    z.object({
      recipient: z.string().min(1),
      bps: z.number().int().min(0).max(10000),
    }),
  ).max(20),
  settlement: z.object({
    target: z.literal('evm'),
    royaltyBps: z.number().int().min(0).max(10000),
    pricePlanck: z.string(),
  }),
  evm: z.object({
    txHash: z.string(),
    contractAddress: z.string(),
  }).optional(),
});

// ---------------------------------------------------------------------------
// Server-side AES-256-GCM encryption
//
// Key derivation lives in services/keyVault.ts and is shared with the
// content-key delivery route: a key delivered after an access check MUST
// decrypt bytes encrypted here.
// Wire format: nonce(12) || ciphertext || authTag(16)
//   — identical to the Web Crypto AES-GCM layout used by the frontend.
// ---------------------------------------------------------------------------
function encryptAesGcm(plaintext: Buffer, key: Buffer): Buffer {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag(); // always 16 bytes
  return Buffer.concat([nonce, ciphertext, authTag]);
}

// ---------------------------------------------------------------------------
// Shared error helpers
// ---------------------------------------------------------------------------
function badRequest(reply: FastifyReply, error: string) {
  return reply.status(400).send({ error });
}

function handleUploadError(error: unknown, reply: FastifyReply) {
  if (error instanceof PinataUnconfiguredError) {
    return reply.status(503).send({ error: 'Upload service is not configured. Contact the operator.' });
  }
  if (error instanceof PinataError) {
    return reply.status(502).send({ error: 'Upload to storage failed. Please try again.' });
  }
  throw error;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
export async function uploadRoutes(app: FastifyInstance): Promise<void> {

  /**
   * POST /api/uploads/audio
   *
   * Accepts multipart form data:
   *   audio       — audio file (required)
   *   contentHash — 0x-prefixed blake2b-256 hash of the raw audio bytes (required)
   *
   * Encrypts audio server-side with HKDF-derived AES-256-GCM key, pins
   * the encrypted blob to Pinata, and returns the Dotify audio ref URI.
   *
   * Returns: { ref: "dotify:enc:ipfs://<CID>", contentHash: string }
   *
   * TODO: add virus scanning / content moderation before pinning.
   */
  app.post('/audio', async (request: FastifyRequest, reply: FastifyReply) => {
    let fileBuffer: Buffer | undefined;
    let fileMime = '';
    let contentHash = '';

    try {
      for await (const part of request.parts({ limits: { fileSize: AUDIO_MAX_BYTES, files: 1 } })) {
        if (part.type === 'file' && part.fieldname === 'audio') {
          fileMime = part.mimetype;
          fileBuffer = await part.toBuffer();
        } else if (part.type === 'field' && part.fieldname === 'contentHash') {
          contentHash = typeof part.value === 'string' ? part.value.trim() : '';
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('file size limit') || msg.includes('FST_MULTIPART')) {
        return badRequest(reply, `Audio file exceeds the ${AUDIO_MAX_BYTES / 1024 / 1024} MB limit.`);
      }
      throw err;
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return badRequest(reply, 'No audio file received. Include the file as field "audio".');
    }

    if (!ALLOWED_AUDIO_MIMES.has(fileMime)) {
      return badRequest(reply, `MIME type "${fileMime}" is not an accepted audio format.`);
    }

    const hashCheck = contentHashSchema.safeParse(contentHash);
    if (!hashCheck.success) {
      return badRequest(reply, 'contentHash field is required and must be a 0x-prefixed 32-byte hex string.');
    }

    const contentKey = deriveContentKeyBytes(hashCheck.data);
    if (!contentKey) {
      return reply.status(503).send({
        error: 'Server-side encryption is not configured. Set CONTENT_KEY_MASTER_SECRET (32+ bytes of hex).',
      });
    }

    let encrypted: Buffer;
    try {
      encrypted = encryptAesGcm(fileBuffer, contentKey);
    } catch {
      request.log.error('Audio encryption failed');
      return reply.status(500).send({ error: 'Audio encryption failed.' });
    }

    let cid: string;
    try {
      cid = await pinFileToPinata(
        new Uint8Array(encrypted),
        `${hashCheck.data.slice(2, 10)}.enc`,
        { app: 'dotify', type: 'audio', encrypted: 'true', contentHash: hashCheck.data },
      );
    } catch (err) {
      return handleUploadError(err, reply);
    }

    return reply.status(200).send({
      ref: `dotify:enc:ipfs://${cid}`,
      contentHash: hashCheck.data,
    });
  });

  /**
   * POST /api/uploads/cover
   *
   * Accepts multipart form data:
   *   cover — image file (required)
   *
   * Pins the cover image to Pinata and returns the IPFS ref.
   *
   * Returns: { ref: "ipfs://<CID>" }
   *
   * TODO: add image content moderation before pinning.
   */
  app.post('/cover', async (request: FastifyRequest, reply: FastifyReply) => {
    let fileBuffer: Buffer | undefined;
    let fileMime = '';
    let filename = 'cover';

    try {
      for await (const part of request.parts({ limits: { fileSize: COVER_MAX_BYTES, files: 1 } })) {
        if (part.type === 'file' && part.fieldname === 'cover') {
          fileMime = part.mimetype;
          filename = part.filename || filename;
          fileBuffer = await part.toBuffer();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('file size limit') || msg.includes('FST_MULTIPART')) {
        return badRequest(reply, `Cover image exceeds the ${COVER_MAX_BYTES / 1024 / 1024} MB limit.`);
      }
      throw err;
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return badRequest(reply, 'No cover image received. Include the file as field "cover".');
    }

    if (!ALLOWED_IMAGE_MIMES.has(fileMime)) {
      return badRequest(reply, `MIME type "${fileMime}" is not an accepted image format.`);
    }

    let cid: string;
    try {
      cid = await pinFileToPinata(
        new Uint8Array(fileBuffer),
        filename,
        { app: 'dotify', type: 'cover' },
      );
    } catch (err) {
      return handleUploadError(err, reply);
    }

    return reply.status(200).send({ ref: `ipfs://${cid}` });
  });

  /**
   * POST /api/uploads/metadata
   *
   * Accepts a JSON body conforming to the dotify.track.v1 manifest schema.
   * Validates the shape, pins to Pinata, and returns the IPFS ref.
   *
   * Returns: { ref: "ipfs://<CID>" }
   */
  app.post('/metadata', { bodyLimit: META_MAX_BYTES }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = dotifyManifestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid Dotify track manifest',
        issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const manifest = parsed.data;
    const name = `${manifest.track.title || 'track'}.json`;

    let cid: string;
    try {
      cid = await pinJsonToPinata(
        manifest,
        name,
        { app: 'dotify', type: 'track-metadata', contentHash: manifest.track.contentHash },
      );
    } catch (err) {
      return handleUploadError(err, reply);
    }

    return reply.status(200).send({ ref: `ipfs://${cid}` });
  });
}
